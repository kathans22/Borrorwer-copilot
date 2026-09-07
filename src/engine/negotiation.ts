/**
 * Everything the negotiation card puts on screen, worked out here rather
 * than in the component.
 *
 * The card is one screen a borrower holds up at a counter. Two things make
 * it worth holding up: a fair rate stated as a claim with its reasons
 * attached, so it can be defended rather than merely asserted; and a
 * comparator that turns "that seems high" into "that is 2.4 points above
 * fair for someone like me, which is about 38,000 rupees more over five
 * years".
 *
 * Nothing here decides anything new. It selects from what the engine already
 * produced and arranges it for somebody reading under pressure.
 */

import {
  MAX_CARD_ACTIONS,
  PRODUCTS,
  type SupportedProduct,
} from '../rules/rules.config'
import type {
  ActionStep,
  AnnualRatePct,
  Band,
  BorrowerAnswers,
  NumericOutput,
  Rupees,
  RupeesPerMonth,
} from '../types'
import { computeWithTrace } from './index'
import { readNumeric } from './resolve'

/** One line of the "fair for me because..." claim. */
export type ClaimFactor = { label: string; value: string }

export type LenderQuestion = { question: string; because: string }

/** What the borrower types in at the counter, or what they already told us. */
export type Quote = {
  annualRatePct: number
  tenureMonths: number
  processingFeePct: number
}

export type NegotiationCard = {
  product: SupportedProduct | null
  tenureMonths: number
  /** The nominal rate a borrower like this should be offered. */
  fairRateBand: Band<AnnualRatePct>
  claimFactors: ClaimFactor[]
  /** All-in cost, the figure the borrower compares every quote against. */
  allInApr: NumericOutput<AnnualRatePct>
  feeAssumption: { pct: number; stated: boolean }
  maxEmi: NumericOutput<RupeesPerMonth>
  /** The safe figure leads. The lender figure is context, not the target. */
  safeAmount: NumericOutput<Rupees>
  lenderAmount: NumericOutput<Rupees>
  questions: LenderQuestion[]
  actions: ActionStep[]
  prefilledQuote: Quote | null
}

export function buildNegotiationCard(answers: BorrowerAnswers): NegotiationCard {
  const { result, trace } = computeWithTrace(answers)
  const product = trace.ranking.routedProduct
  const pricing = trace.pricing

  const quotedRate = readNumeric(answers, 'quotedRate', 'cost')
  const quotedFee = readNumeric(answers, 'quotedProcessingFee', 'cost')
  const quotedTenure = readNumeric(answers, 'quotedTenure', 'cost')

  return {
    product,
    tenureMonths: trace.tenureMonths,
    fairRateBand: pricing
      ? { low: pricing.rateBand.low as AnnualRatePct, high: pricing.rateBand.high as AnnualRatePct }
      : { low: 0 as AnnualRatePct, high: 0 as AnnualRatePct },
    claimFactors: claimFactors(trace, product),
    allInApr: result.fairRate,
    feeAssumption: {
      pct: pricing?.processingFeePct ?? 0,
      stated: quotedFee?.stated ?? false,
    },
    maxEmi: result.emiCeiling,
    safeAmount: result.maxAmount.borrowerSafe,
    lenderAmount: result.maxAmount.lenderLikely,
    questions: [],
    actions: result.actions.slice(0, MAX_CARD_ACTIONS),
    prefilledQuote: quotedRate?.stated
      ? {
          annualRatePct: quotedRate.underwriting,
          tenureMonths: quotedTenure?.stated ? quotedTenure.underwriting : trace.tenureMonths,
          processingFeePct: quotedFee?.stated
            ? quotedFee.underwriting
            : (pricing?.processingFeePct ?? 0),
        }
      : null,
  }
}

/**
 * The "because" half of the claim.
 *
 * A rate band on its own is an opinion. The same band with the four things
 * that produced it is an argument, and the borrower can check each one
 * against what the lender is telling them.
 */
function claimFactors(
  trace: ReturnType<typeof computeWithTrace>['trace'],
  product: SupportedProduct | null,
): ClaimFactor[] {
  const factors: ClaimFactor[] = []
  const tier = trace.pricing?.creditTier

  factors.push({
    label: 'My credit standing',
    value:
      tier === 'unknown'
        ? 'not yet checked, so this range is wide'
        : tier === 'no_file'
          ? 'new to credit, priced on income instead'
          : describeTier(tier),
  })

  factors.push({ label: 'How I earn', value: describeEarning(trace) })

  factors.push({
    label: 'How long I would take',
    value:
      trace.tenureMonths >= 12
        ? `${Math.round(trace.tenureMonths / 12)} years`
        : `${Math.round(trace.tenureMonths)} months`,
  })

  factors.push({
    label: 'What backs the loan',
    value: product ? describeSecurity(product) : 'nothing decided yet',
  })

  return factors
}

function describeTier(tier: string | undefined): string {
  switch (tier) {
    case 'prime_plus':
      return 'a strong credit record'
    case 'prime':
      return 'a good credit record'
    case 'near_prime':
      return 'a reasonable credit record'
    case 'subprime':
      return 'a patchy credit record'
    case 'deep_subprime':
    case 'below_threshold':
      return 'a difficult credit record'
    default:
      return 'my credit record'
  }
}

function describeEarning(trace: ReturnType<typeof computeWithTrace>['trace']): string {
  const e = trace.income.employmentType
  const proof = trace.income.incomeProof
  const how =
    e === 'salaried_formal'
      ? 'a salary with payslips'
      : e === 'salaried_informal'
        ? 'a salary without formal payslips'
        : e === 'self_employed_documented'
          ? 'my own business, with filings'
          : e === 'self_employed_cash'
            ? 'my own business, mostly in cash'
            : 'daily and piece work'
  const shown =
    proof === 'salary_slips'
      ? 'payslips'
      : proof === 'itr'
        ? 'a filed return'
        : proof === 'gst_returns'
          ? 'GST filings'
          : proof === 'bank_statements_only'
            ? 'bank statements'
            : 'nothing on paper yet'
  return `${how}, and I can show ${shown}`
}

function describeSecurity(product: SupportedProduct): string {
  const secured = PRODUCTS[product].ltvRatio !== null
  switch (product) {
    case 'lap':
      return 'my property, so this should be at the lower end'
    case 'two_wheeler_ev':
      return 'the vehicle itself'
    default:
      return secured ? 'the asset itself' : 'nothing — this is unsecured, which is why it is dearer'
  }
}


