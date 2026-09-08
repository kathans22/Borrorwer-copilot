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
  CONSOLIDATION_CAPABLE_PRODUCTS,
  RATE_WIDTH_ONCE_SCORE_IS_KNOWN_PCT_POINTS,
  REFINANCE_MAX_TENURE_MONTHS,
  FIELD_DEFAULTS,
  LAP_LTV_BY_PROPERTY_KIND,
  MIN_WIDENING_SCALE_RATIO_OF_INCOME,
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
import { assertLedgerIsHonest, createLedger, type Ledger } from './assumptions'
import { buildActionPlan, type ActionContext } from './actionPlan'
import { assessTenure, stressTest, tenureTradeOff, type StressCase, type TenureOption } from './emi'
import { percent, rateBand as rateBandText, reason, rupees } from './format'
import { assessIncome, type IncomeAssessment } from './incomeAssessment'
import { emiFor, principalFor } from './money'
import { priceProduct, type Pricing } from './pricing'
import { rankProducts, type ProductOffer, type ProductRanking } from './productRouting'
import { assessRefinance, type RefinanceAssessment, type RefinanceTarget } from './refinance'
import { normaliseAnswers, readChoice, readNumeric, recordUndisclosedDebts } from './resolve'
import { decideVerdict, type VerdictAssessment } from './verdict'
import {
  confidenceFromBand,
  resolveUncertainty,
  verdictConfidence,
  wideningRatio,
} from './uncertainty'

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
  /** How much each output was widened for what the borrower has not said. */
  widening: { maxAmount: number; fairRate: number; emiCeiling: number }
  ledger: Ledger
}

export type ComputeOutput = { result: CopilotResult; trace: EngineTrace }

function midOf(band: { low: number; high: number }): number {
  return (band.low + band.high) / 2
}

/**
 * What collateral alone will support, before income is considered.
 *
 * Returns a range, not a figure. Lenders advance somewhere between the two
 * ends of the LTV band against the same asset, and which end this borrower
 * gets is not knowable from here - so both ends are used. Reading only the
 * top left the bottom of every LTV band as decoration: a reviewer could
 * change it and watch nothing happen.
 */
function collateralCap(
  answers: BorrowerAnswers,
  product: SupportedProduct,
): { low: number; high: number } | null {
  if (product === 'lap') {
    const value = readNumeric(answers, 'propertyValue', 'income')
    if (!value?.stated) return null
    const kind = readChoice<PropertyKind>(answers, 'propertyKind') ?? 'residential'
    const ltv = LAP_LTV_BY_PROPERTY_KIND[kind]
    return {
      low: value.underwriting * (ltv.low as number),
      high: value.underwriting * (ltv.high as number),
    }
  }
  if (product === 'two_wheeler_ev') {
    const price = readNumeric(answers, 'vehicleOnRoadPrice', 'income')
    if (!price?.stated) return null
    const ltv = PRODUCTS.two_wheeler_ev.ltvRatio
    // PRD-04's precondition, applied rather than merely stated: a borrower
    // putting money down needs to borrow only the balance, and a lender will
    // not advance more than the vehicle costs.
    const deposit = readNumeric(answers, 'downPaymentAvailable', 'income')
    const byDeposit = deposit?.stated
      ? price.underwriting - deposit.underwriting
      : Number.POSITIVE_INFINITY
    const at = (r: number) => Math.max(Math.min(price.underwriting * r, byDeposit), 0)
    return { low: at(ltv ? (ltv.low as number) : 1), high: at(ltv ? (ltv.high as number) : 1) }
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
  if (byCollateral !== null && byCollateral.high < maxAmountInr) {
    maxAmountInr = byCollateral.high
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
      /** The conservative end of what security supports, where there is any. */
      collateralFloorInr: byCollateral ? Math.min(byCollateral.low, ceiling) : null,
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

export function computeWithTrace(raw: BorrowerAnswers): ComputeOutput {
  // DEF-23 - a stated "no" is carried to the question behind it before
  // anything else reads the answers.
  const answers = normaliseAnswers(raw)
  const purpose =
    readChoice<LoanPurpose>(answers, 'loanPurpose') ??
    (FIELD_DEFAULTS.loanPurpose.value as LoanPurpose)

  const ledger = createLedger()
  const income = assessIncome(answers)
  const affordability = assessAffordability(answers, income, purpose, ledger)
  const undisclosedDebtReason = recordUndisclosedDebts(answers, ledger)

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
  // REF-13 - a vehicle loan cannot pay off a moneylender; the money can only
  // buy the vehicle. Quoting a saving the borrower could never realise would
  // be worse than quoting none.
  const refinanceCandidateProduct =
    ranking.ranked.find((r) => CONSOLIDATION_CAPABLE_PRODUCTS.includes(r.product)) ?? null
  const refinanceBuild = refinanceCandidateProduct
    ? built.find((b) => b.offer.product === refinanceCandidateProduct.product)!
    : null
  const refinanceTarget: RefinanceTarget | null = refinanceBuild
    ? {
        label: labelFor(refinanceBuild.offer.product),
        annualRatePct: midOf(refinanceBuild.offer.rateBand),
        tenureMonths: Math.min(
          refinanceBuild.offer.tenureMonths,
          REFINANCE_MAX_TENURE_MONTHS as number,
        ),
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

  // --- O2 --------------------------------------------------------------
  const maxAmount = buildMaxAmount({
    answers,
    affordability,
    rateBand: top ? top.offer.rateBand : { low: 0, high: 0 },
    tenureMonths: Math.max(tenureMonths, 1),
    productCeiling: top ? top.offer.maxAmountInr : 0,
    productFloor: top ? top.offer.collateralFloorInr : null,
    safetyIncomeMonthly: income.reliableSafetyIncomeMonthly,
  })

  // --- O3 --------------------------------------------------------------
  const rateUncertainty = resolveUncertainty<AnnualRatePct>(answers, 'fairRate', {
    low: (top ? top.offer.aprBand.low : 0) as AnnualRatePct,
    high: (top ? top.offer.aprBand.high : 0) as AnnualRatePct,
  })
  const fairRate: NumericOutput<AnnualRatePct> = {
    band: rateUncertainty.band,
    confidence: rateUncertainty.confidence,
    reasons: top
      ? top.pricing.reasons
      : [reason('No product is open to you, so there is no rate to quote.', ['incomeProof'])],
    wouldNarrow: rateUncertainty.wouldNarrow,
  }

  // --- O4 --------------------------------------------------------------
  // The band here is the uncertainty around the instalment the borrower
  // should actually plan on - the binding one of the two ceilings - not the
  // gap between two different quantities. The two ceilings are separate
  // figures and are reported as such in O2 and in the reasons below; a band
  // spanning them would mean something different from every other band in
  // the system.
  const emiUncertainty = resolveUncertainty<RupeesPerMonth>(
    answers,
    'emiCeiling',
    { low: bindingCeiling as RupeesPerMonth, high: bindingCeiling as RupeesPerMonth },
    income.reliableSafetyIncomeMonthly * (MIN_WIDENING_SCALE_RATIO_OF_INCOME as number),
  )
  const emiCeiling: NumericOutput<RupeesPerMonth> = {
    band: emiUncertainty.band,
    confidence: emiUncertainty.confidence,
    reasons: [
      ...affordability.reasons,
      ...(top ? top.tenureReasons : []),
      ...(stress ? stress.reasons : []),
      ...(undisclosedDebtReason ? [undisclosedDebtReason] : []),
    ],
    wouldNarrow: emiUncertainty.wouldNarrow,
  }


  // --- verdict, genuinely last -----------------------------------------
  // It consumes the three numeric outputs above, including their derived
  // confidence, so it cannot be computed before them.
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
    // CONF-03 - no more certain than the arithmetic underneath it.
    confidence: verdictConfidence({
      maxAmount: confidenceFromBand({
        low: maxAmount.borrowerSafe.band.low as number,
        high: maxAmount.borrowerSafe.band.high as number,
      }),
      emiCeiling: emiCeiling.confidence,
    }),
  })

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
    narrowedRateWidthPctPoints: RATE_WIDTH_ONCE_SCORE_IS_KNOWN_PCT_POINTS,
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
    bufferTargetShortfallInr: Math.max(
      affordability.bufferTarget - affordability.household.savings,
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

  const widening = {
    maxAmount: wideningRatio(answers, 'maxAmount'),
    fairRate: wideningRatio(answers, 'fairRate'),
    emiCeiling: wideningRatio(answers, 'emiCeiling'),
  }

  const allReasons: Reason[] = [
    ...income.reasons,
    ...affordability.reasons,
    ...ranking.reasons,
    ...(top ? top.tenureReasons : []),
    ...refinance.reasons,
  ]

  // ASR-01 and ASR-03, checked against what the borrower actually sees
  // rather than against what the engine intended. Everything the interface
  // renders is in one of these four outputs.
  assertLedgerIsHonest(ledger, [
    ...verdict.output.reasons,
    ...maxAmount.lenderLikely.reasons,
    ...maxAmount.borrowerSafe.reasons,
    maxAmount.useWhichReason,
    ...fairRate.reasons,
    ...emiCeiling.reasons,
  ])

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
      widening,
      ledger,
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
