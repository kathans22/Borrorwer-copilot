/**
 * `computeResult` - the whole engine, in dependency order.
 *
 * income -> affordability -> tenure and pricing per product -> routing ->
 * refinance -> verdict -> actions.
 *
 * The verdict is computed last on purpose: it consumes everything above it,
 * including the refinance result, because for some borrowers the right
 * headline is not about the loan they asked for at all.
 */

import {
  FIELD_DEFAULTS,
  LAP_LTV_BY_PROPERTY_KIND,
  PRODUCTS,
  type ConstraintId,
  type SupportedProduct,
} from '../rules/rules.config'
import type {
  AnswerFieldId,
  AnnualRatePct,
  BorrowerAnswers,
  CopilotResult,
  LoanPurpose,
  NumericOutput,
  PropertyKind,
  Reason,
  RupeesPerMonth,
} from '../types'
import { assessAffordability, buildMaxAmount, type Affordability } from './affordability'
import { buildActionPlan, type ActionContext } from './actionPlan'
import { assessTenure, stressTest, tenureTradeOff, type StressCase, type TenureOption } from './emi'
import { percent, rateBand as rateBandText, reason, rupees } from './format'
import { assessIncome, type IncomeAssessment } from './incomeAssessment'
import { emiFor, principalFor } from './money'
import { priceProduct, type Pricing } from './pricing'
import { rankProducts, type ProductOffer, type ProductRanking } from './productRouting'
import { assessRefinance, type RefinanceAssessment, type RefinanceTarget } from './refinance'
import { readChoice, readNumeric } from './resolve'
import { decideVerdict, type VerdictAssessment } from './verdict'

const ALL_PRODUCTS: SupportedProduct[] = ['personal', 'lap', 'business_unsecured', 'two_wheeler_ev']

/** Everything the engine worked out, for the persona CLI and later the UI. */
export type EngineTrace = {
  income: IncomeAssessment
  affordability: Affordability
  ranking: ProductRanking
  pricing: Pricing | null
  tenureMonths: number
  tenureCappedBy: 'product' | 'age' | 'asset_life'
  tenureOptions: TenureOption[]
  stress: StressCase | null
  refinance: RefinanceAssessment
  verdict: VerdictAssessment
  purpose: LoanPurpose
  reasons: Reason[]
}

export type ComputeOutput = { result: CopilotResult; trace: EngineTrace }

function midOf(band: { low: number; high: number }): number {
  return (band.low + band.high) / 2
}

/** What collateral alone will support, before income is considered. */
function collateralCap(answers: BorrowerAnswers, product: SupportedProduct): number | null {
  if (product === 'lap') {
    const value = readNumeric(answers, 'propertyValue', 'income')
    if (!value?.stated) return null
    const kind = readChoice<PropertyKind>(answers, 'propertyKind') ?? 'residential'
    return value.underwriting * (LAP_LTV_BY_PROPERTY_KIND[kind].high as number)
  }
  if (product === 'two_wheeler_ev') {
    const price = readNumeric(answers, 'vehicleOnRoadPrice', 'income')
    if (!price?.stated) return null
    const ltv = PRODUCTS.two_wheeler_ev.ltvRatio
    return price.underwriting * (ltv ? (ltv.high as number) : 1)
  }
  return null
}

function buildOffer(
  answers: BorrowerAnswers,
  income: IncomeAssessment,
  affordability: Affordability,
  product: SupportedProduct,
): { offer: ProductOffer; pricing: Pricing; tenureCappedBy: 'product' | 'age' | 'asset_life'; tenureReasons: Reason[]; constraints: ConstraintId[] } {
  const tenure = assessTenure(answers, income, product)
  const rules = PRODUCTS[product]

  // Fees are proportional, so a provisional principal is enough to establish
  // the rate band; the amount is then recomputed on that rate and the loan
  // repriced once so the APR reflects the amount actually being discussed.
  const provisional = principalFor(
    Math.max(affordability.lenderEmiCeiling, 1),
    midOf({ low: rules.rateFloorAnnualPct as number, high: rules.rateCeilingAnnualPct as number }),
    tenure.maxTenureMonths,
  )
  const firstPass = priceProduct(answers, product, Math.max(provisional, 1), tenure.maxTenureMonths)

  const byIncome = principalFor(
    affordability.lenderEmiCeiling,
    midOf(firstPass.rateBand),
    tenure.maxTenureMonths,
  )
  const byCollateral = collateralCap(answers, product)
  const ceiling = rules.ticketSizeInr.high as number

  let maxAmountInr = byIncome
  let limitedBy: ProductOffer['limitedBy'] = 'income'
  if (byCollateral !== null && byCollateral < maxAmountInr) {
    maxAmountInr = byCollateral
    limitedBy = 'collateral'
  }
  if (ceiling < maxAmountInr) {
    maxAmountInr = ceiling
    limitedBy = 'ticket_ceiling'
  }

  const pricing = priceProduct(answers, product, Math.max(maxAmountInr, 1), tenure.maxTenureMonths)

  return {
    offer: {
      product,
      maxAmountInr,
      limitedBy,
      rateBand: pricing.rateBand,
      aprBand: pricing.aprBand,
      tenureMonths: tenure.maxTenureMonths,
      tenureAvailable: tenure.available,
      unsecuredAvailable: pricing.unsecuredAvailable,
    },
    pricing,
    tenureCappedBy: tenure.cappedBy,
    tenureReasons: tenure.reasons,
    constraints: [...tenure.constraints, ...pricing.constraints],
  }
}

export function computeResult(answers: BorrowerAnswers): CopilotResult {
  return computeWithTrace(answers).result
}

export function computeWithTrace(answers: BorrowerAnswers): ComputeOutput {
  const purpose =
    readChoice<LoanPurpose>(answers, 'loanPurpose') ??
    (FIELD_DEFAULTS.loanPurpose.value as LoanPurpose)

  const income = assessIncome(answers)
  const affordability = assessAffordability(answers, income, purpose)

  const requested = readNumeric(answers, 'requestedAmount', 'income')
  const requestedAmountInr = requested?.stated ? requested.underwriting : null

  // --- one offer per product ------------------------------------------
  const built = ALL_PRODUCTS.map((p) => buildOffer(answers, income, affordability, p))
  const ranking = rankProducts({
    answers,
    income,
    offers: built.map((b) => b.offer),
    requestedAmount: requestedAmountInr,
  })

  const topProduct = ranking.routedProduct
  const top = topProduct ? built.find((b) => b.offer.product === topProduct)! : null

  // --- refinance -------------------------------------------------------
  // Routed to whichever eligible product is cheapest for consolidating, which
  // in practice is a personal loan where the borrower qualifies for one.
  const refinanceCandidateProduct =
    ranking.ranked.find((r) => r.product === 'personal') ?? ranking.ranked[0] ?? null
  const refinanceBuild = refinanceCandidateProduct
    ? built.find((b) => b.offer.product === refinanceCandidateProduct.product)!
    : null
  const refinanceTarget: RefinanceTarget | null = refinanceBuild
    ? {
        label: labelFor(refinanceBuild.offer.product),
        annualRatePct: midOf(refinanceBuild.offer.rateBand),
        tenureMonths: Math.min(refinanceBuild.offer.tenureMonths, 36),
        processingFeePct: refinanceBuild.pricing.processingFeePct,
        otherChargesInr: refinanceBuild.pricing.otherCharges,
      }
    : null
  const refinance = assessRefinance(answers, refinanceTarget)

  // --- the amount actually under discussion ----------------------------
  const midRate = top ? midOf(top.offer.rateBand) : 0
  const tenureMonths = top ? top.offer.tenureMonths : 0
  const bindingCeiling = Math.min(affordability.safeCarryEmi, affordability.lenderEmiCeiling)
  const workingAmount = top
    ? Math.min(requestedAmountInr ?? Number.POSITIVE_INFINITY, top.offer.maxAmountInr, principalFor(bindingCeiling, midRate, tenureMonths))
    : 0

  const stress =
    top && workingAmount > 0
      ? stressTest({
          answers,
          income,
          affordability,
          product: top.offer.product,
          principal: workingAmount,
          annualRatePct: midRate,
          tenureMonths,
        })
      : null

  // --- verdict, last ---------------------------------------------------
  const verdict = decideVerdict({
    answers,
    income,
    affordability,
    purpose,
    product: topProduct,
    midRatePct: midRate,
    tenureMonths,
    requestedAmountInr,
    stress,
    refinance: refinance.result,
    hardFails: [],
  })

  // --- O2 --------------------------------------------------------------
  const maxAmount = buildMaxAmount({
    affordability,
    rateBand: top ? top.offer.rateBand : { low: 0, high: 0 },
    tenureMonths: Math.max(tenureMonths, 1),
    confidence: top ? top.pricing.confidence : 'low',
    lenderWouldNarrow: [...income.wouldNarrow, ...(top ? top.pricing.wouldNarrow : [])],
    safeWouldNarrow: affordability.wouldNarrow,
    productCeiling: top ? top.offer.maxAmountInr : 0,
  })

  // --- O3 --------------------------------------------------------------
  const fairRate: NumericOutput<AnnualRatePct> = {
    band: {
      low: (top ? top.offer.aprBand.low : 0) as AnnualRatePct,
      high: (top ? top.offer.aprBand.high : 0) as AnnualRatePct,
    },
    confidence: top ? top.pricing.confidence : 'low',
    reasons: top ? top.pricing.reasons : [reason('No product is open to you, so there is no rate to quote.', ['incomeProof'])],
    wouldNarrow: top ? top.pricing.wouldNarrow : ['creditScore'],
  }

  // --- O4 --------------------------------------------------------------
  const emiCeiling: NumericOutput<RupeesPerMonth> = {
    // Ordered, because for a borrower whose income is barely recognised the
    // household can carry more than the lender will allow, and a band whose
    // low exceeds its high is not a band.
    band: {
      low: Math.min(affordability.safeCarryEmi, affordability.lenderEmiCeiling) as RupeesPerMonth,
      high: Math.max(affordability.safeCarryEmi, affordability.lenderEmiCeiling) as RupeesPerMonth,
    },
    confidence: top ? top.pricing.confidence : 'low',
    reasons: [
      ...affordability.reasons,
      ...(top ? top.tenureReasons : []),
      ...(stress ? stress.reasons : []),
    ],
    wouldNarrow: affordability.wouldNarrow,
  }

  // --- actions ---------------------------------------------------------
  const constraints: ConstraintId[] = [
    ...income.constraints,
    ...affordability.constraints,
    ...ranking.constraints,
    ...built.flatMap((b) => b.constraints),
    ...refinance.constraints,
    ...verdict.constraints,
  ]

  const informal = refinance.candidates.find((d) => d.label === 'informal borrowing')
  const context: ActionContext = {
    rateBandWidthPctPoints: top ? top.offer.rateBand.high - top.offer.rateBand.low : undefined,
    narrowedRateWidthPctPoints: 2.5,
    recognisedIncomeMonthly: income.recognisedLenderIncomeMonthly,
    reliableIncomeMonthly: income.reliableSafetyIncomeMonthly,
    safeAmountInr: maxAmount.borrowerSafe.band.high as number,
    requestedAmountInr: requestedAmountInr ?? undefined,
    assumedExpensesMonthly: affordability.household.expensesMonthly,
    // ACT-10 asks for one month of cover, so quote the one-month gap, not
    // the whole multi-month buffer target.
    bufferShortfallInr: Math.max(
      affordability.monthlyOutflow - affordability.household.savings,
      0,
    ),
    informalDebtInr: informal?.outstanding,
    informalDebtAnnualPct: informal?.annualRatePct,
    refinanceTotalSavingInr: refinance.result
      ? (refinance.result.totalSavingOverTenure.band.high as number)
      : undefined,
    coApplicantIncomeMonthly: income.coApplicant?.safety,
    currentTenureMonths: tenureMonths || undefined,
    productTenureCeilingMonths: top ? (PRODUCTS[top.offer.product].tenureMonths.high as number) : undefined,
  }

  const actions = buildActionPlan(verdict.output.value, constraints, context)

  const tenureOptions =
    top && workingAmount > 0
      ? tenureTradeOff(workingAmount, midRate, top.offer.product, tenureMonths)
      : []

  const allReasons: Reason[] = [
    ...income.reasons,
    ...affordability.reasons,
    ...ranking.reasons,
    ...(top ? top.tenureReasons : []),
    ...refinance.reasons,
  ]

  return {
    result: {
      verdict: verdict.output,
      maxAmount,
      fairRate,
      emiCeiling,
      refinance: refinance.result,
      actions,
    },
    trace: {
      income,
      affordability,
      ranking,
      pricing: top ? top.pricing : null,
      tenureMonths,
      tenureCappedBy: top ? top.tenureCappedBy : 'product',
      tenureOptions,
      stress,
      refinance,
      verdict,
      purpose,
      reasons: allReasons,
    },
  }
}

function labelFor(product: SupportedProduct): string {
  switch (product) {
    case 'personal':
      return 'a personal loan'
    case 'lap':
      return 'a loan against property'
    case 'business_unsecured':
      return 'a business loan'
    case 'two_wheeler_ev':
      return 'a vehicle loan'
  }
}

export { rateBandText, percent, rupees, emiFor }
export type { AnswerFieldId }
