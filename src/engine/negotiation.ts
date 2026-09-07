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
  CANNOT_JUDGE_FAIRNESS_ABOVE_BAND_WIDTH_PCT_POINTS,
  COMPARE_RUPEES_AGAINST_BEST_FAIR_RATE,
  GST_ON_FEES_PCT,
  LENDER_QUESTIONS,
  MAX_CARD_ACTIONS,
  MAX_LENDER_QUESTIONS,
  PRODUCTS,
  SAY_SO_WHEN_THE_OFFER_IS_FAIR,
  type SupportedProduct,
} from '../rules/rules.config'
import type {
  ActionStep,
  AnnualRatePct,
  AnswerFieldId,
  Band,
  BorrowerAnswers,
  NumericOutput,
  Rupees,
  RupeesPerMonth,
} from '../types'
import { ALL_QUESTIONS } from '../questions/questions.config'
import { computeWithTrace } from './index'
import { aprFromCashFlows, emiFor } from './money'
import { isUnanswered, readNumeric } from './resolve'

/** One line of the "fair for me because..." claim. */
export type ClaimFactor = { label: string; value: string }

export type LenderQuestion = { question: string; because: string }

/** What the borrower types in at the counter, or what they already told us. */
export type Quote = {
  annualRatePct: number
  tenureMonths: number
  processingFeePct: number
}

/**
 * Three answers, not two. "We cannot tell yet" is the honest verdict for a
 * borrower whose credit score has never been looked at, and pretending
 * otherwise would be the app lending its authority to a guess.
 */
export type QuoteJudgement = 'fair' | 'above_fair' | 'cannot_judge_yet'

export type QuoteComparison = {
  judgement: QuoteJudgement
  /** The quote's true cost once the fee is taken out of the money. */
  quoteAllInPct: number
  fairAllInBand: Band<number>
  /** Points above the top of the fair band. Zero unless the offer is dear. */
  gapPoints: number
  /** What this quote costs against the best rate they should be able to get. */
  extraVsBestInr: number
  extraRepaidInr: number
  extraFeeInr: number
  /** Monthly difference against that same best rate. */
  extraMonthlyInr: number
  totalOnQuoteInr: number
  totalOnBestInr: number
  quoteEmiInr: number
  bestEmiInr: number
  bestRatePct: number
  principalInr: number
  tenureMonths: number
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
    questions: lenderQuestions(answers),
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

/**
 * CARD-01 - three questions, drawn from what this borrower has not been able
 * to tell us. A gap in our answers is usually a gap the lender is relying on.
 */
function lenderQuestions(answers: BorrowerAnswers): LenderQuestion[] {
  // A gap only counts if the question behind it applies to this borrower.
  // Asking somebody with no property what valuation the lender is using is
  // the sort of thing that makes a card get put back in a pocket.
  const askable = new Set(
    ALL_QUESTIONS.filter((q) => q.appliesWhen(answers)).map((q) => q.id),
  )
  const fromGaps = LENDER_QUESTIONS.filter(
    (q) =>
      q.gap !== null &&
      askable.has(q.gap as AnswerFieldId) &&
      isUnanswered(answers, q.gap as AnswerFieldId),
  )
  const always = LENDER_QUESTIONS.filter((q) => q.gap === null)
  return [...fromGaps, ...always]
    .slice(0, MAX_LENDER_QUESTIONS)
    .map(({ question, because }) => ({ question, because }))
}

/**
 * CARD-04 - what a quote actually costs, against what a fair one would.
 *
 * Same amount, same length of loan, so the two are genuinely comparable. The
 * fee is counted as well as the rate, because it comes out of the money
 * before it reaches the borrower - which means a lower rate with a larger
 * fee can be the worse offer, and that is exactly the trade a counter is
 * good at hiding.
 */
export function compareQuote(
  card: NegotiationCard,
  quote: Quote,
  principalInr: number,
): QuoteComparison {
  const n = Math.max(Math.round(quote.tenureMonths), 1)
  const p = Math.max(principalInr, 1)

  // CARD-07 - the rupees are measured against the best rate this borrower
  // should be able to get. That is the figure worth arguing over; comparing
  // against the top of the band answers the weaker question, and for an
  // unchecked credit score it answers nothing at all.
  const bestRate = COMPARE_RUPEES_AGAINST_BEST_FAIR_RATE
    ? (card.fairRateBand.low as number)
    : (card.fairRateBand.high as number)
  const fairFeePct = card.feeAssumption.pct

  const quoteEmi = emiFor(p, quote.annualRatePct, n)
  const bestEmi = emiFor(p, bestRate, n)

  const quoteFee = feeWithTax(p, quote.processingFeePct)
  const bestFee = feeWithTax(p, fairFeePct)

  const totalOnQuote = quoteEmi * n + quoteFee
  const totalOnBest = bestEmi * n + bestFee

  const quoteAllInPct = aprFromCashFlows(p - quoteFee, quoteEmi, n)
  const fairAllInBand = {
    low: card.allInApr.band.low as number,
    high: card.allInApr.band.high as number,
  }

  // CARD-06 - a band this wide cannot settle whether an offer is fair.
  const bandWidth = fairAllInBand.high - fairAllInBand.low
  const tooWideToJudge = bandWidth > CANNOT_JUDGE_FAIRNESS_ABOVE_BAND_WIDTH_PCT_POINTS
  const aboveFair = quoteAllInPct > fairAllInBand.high

  const judgement: QuoteJudgement = aboveFair
    ? 'above_fair'
    : tooWideToJudge
      ? 'cannot_judge_yet'
      : SAY_SO_WHEN_THE_OFFER_IS_FAIR
        ? 'fair'
        : 'cannot_judge_yet'

  return {
    judgement,
    quoteAllInPct,
    fairAllInBand,
    gapPoints: Math.max(quoteAllInPct - fairAllInBand.high, 0),
    extraRepaidInr: Math.max(quoteEmi * n - bestEmi * n, 0),
    extraFeeInr: Math.max(quoteFee - bestFee, 0),
    extraMonthlyInr: Math.max(quoteEmi - bestEmi, 0),
    extraVsBestInr: Math.max(totalOnQuote - totalOnBest, 0),
    totalOnQuoteInr: totalOnQuote,
    totalOnBestInr: totalOnBest,
    quoteEmiInr: quoteEmi,
    bestEmiInr: bestEmi,
    bestRatePct: bestRate,
    principalInr: p,
    tenureMonths: n,
  }
}

/** The fee as the borrower actually pays it: the charge plus tax on it (PRD-07). */
function feeWithTax(principal: number, feePct: number): number {
  const fee = principal * (feePct / 100)
  return fee * (1 + (GST_ON_FEES_PCT as number) / 100)
}
