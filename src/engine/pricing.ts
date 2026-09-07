/**
 * What this borrower would actually pay.
 *
 * Two things here are easy to get wrong and both are done properly:
 *
 *   - An unknown credit score produces a wide band, not a middling one
 *     (CRD-08). The width is the message.
 *   - The processing fee is deducted from the disbursal, so the borrower
 *     receives less than the sanctioned amount while paying interest on the
 *     full figure. The APR is solved from those actual cash flows (APR-01),
 *     not by adding the fee percentage to the rate.
 */

import {
  CREDIT_TIERS,
  GST_ON_FEES_PCT,
  LENDER_TYPE_SPREAD_PCT_POINTS,
  PRODUCTS,
  REPAYMENT_EVENTS,
  type ConstraintId,
  type CreditTierId,
  type SupportedProduct,
} from '../rules/rules.config'
import type {
  AnswerFieldId,
  Band,
  BorrowerAnswers,
  LenderType,
  Reason,
  RepaymentHistory,
} from '../types'
import { percent, rateBand as rateBandText, reason, rupees } from './format'
import { aprFromCashFlows, clamp, emiFor } from './money'
import { readChoice, readNumeric } from './resolve'

/** Best to worst. The engine takes the first tier whose floor is met. */
const SCORED_TIERS: CreditTierId[] = [
  'prime_plus',
  'prime',
  'near_prime',
  'subprime',
  'deep_subprime',
  'below_threshold',
]

type RepaymentEventId = keyof typeof REPAYMENT_EVENTS

export type Pricing = {
  product: SupportedProduct
  creditTier: CreditTierId
  repaymentEvent: RepaymentEventId | null
  /** Annual percentage rate before fees. */
  rateBand: Band<number>
  /** All-in cost including the fee, its GST and the reduced disbursal. */
  aprBand: Band<number>
  processingFeePct: number
  processingFeeAmount: number
  gstOnFees: number
  otherCharges: number
  netDisbursal: number
  unsecuredAvailable: boolean
  reasons: Reason[]
  wouldNarrow: AnswerFieldId[]
  constraints: ConstraintId[]
}

/** CRD-01 to CRD-08. Unknown is a distribution, never a substituted value. */
export function creditTierFor(answers: BorrowerAnswers): CreditTierId {
  const score = readNumeric(answers, 'creditScore', 'income')
  if (score?.stated) {
    for (const id of SCORED_TIERS) {
      const min = CREDIT_TIERS[id].minScore
      if (min !== null && score.underwriting >= (min as number)) return id
    }
    return 'below_threshold'
  }
  if (readChoice<boolean>(answers, 'hasCreditHistory') === false) return 'no_file'
  return 'unknown'
}

/** CRD-10 to CRD-13. Recent conduct, priced separately from the score. */
export function repaymentEventFor(answers: BorrowerAnswers): RepaymentEventId | null {
  const history = readChoice<RepaymentHistory>(answers, 'repaymentHistory')
  if (history === 'current_overdue') return 'four_plus_or_current_overdue'
  if (history === 'settled') return 'settled_or_written_off'

  const bounces = readNumeric(answers, 'bouncedEmisLast12m', 'cost')
  if (bounces?.stated) {
    const n = bounces.underwriting
    if (n >= 4) return 'four_plus_or_current_overdue'
    if (n >= 2) return 'two_to_three_bounces_12m'
    if (n >= 1) return 'one_bounce_12m'
  }
  return null
}

export function priceProduct(
  answers: BorrowerAnswers,
  product: SupportedProduct,
  principal: number,
  tenureMonths: number,
): Pricing {
  const reasons: Reason[] = []
  const wouldNarrow: AnswerFieldId[] = []
  const constraints: ConstraintId[] = []

  const rules = PRODUCTS[product]
  const floor = rules.rateFloorAnnualPct as number
  const ceiling = rules.rateCeilingAnnualPct as number

  // --- credit ---------------------------------------------------------
  const tierId = creditTierFor(answers)
  const tier = CREDIT_TIERS[tierId]
  const tierLow = tier.spreadPctPoints.low as number
  const tierHigh = tier.spreadPctPoints.high as number

  if (tier.isDistribution) {
    constraints.push('credit_score_unknown')
    wouldNarrow.push('creditScore')
  }

  // --- recent conduct --------------------------------------------------
  const eventId = repaymentEventFor(answers)
  const event = eventId ? REPAYMENT_EVENTS[eventId] : null
  const eventSpread = event ? (event.spreadPctPoints as number) : 0

  if (eventId === 'one_bounce_12m' || eventId === 'two_to_three_bounces_12m') {
    constraints.push('recent_bounce')
  }
  if (eventId === 'four_plus_or_current_overdue') constraints.push('current_overdue')

  // --- who is lending --------------------------------------------------
  const lenderType = readChoice<LenderType>(answers, 'lenderType')
  const lenderSpread = lenderType
    ? {
        low: LENDER_TYPE_SPREAD_PCT_POINTS[lenderType].low as number,
        high: LENDER_TYPE_SPREAD_PCT_POINTS[lenderType].high as number,
      }
    : marketWideSpread()
  if (!lenderType) wouldNarrow.push('lenderType')

  const rateBand: Band<number> = {
    low: clamp(floor + tierLow + eventSpread + lenderSpread.low, floor, ceiling),
    high: clamp(floor + tierHigh + eventSpread + lenderSpread.high, floor, ceiling),
  }

  // --- fees, and the disbursal they come out of (APR-01) ---------------
  const quotedFee = readNumeric(answers, 'quotedProcessingFee', 'cost')
  const processingFeePct = quotedFee?.stated
    ? quotedFee.underwriting
    : (rules.processingFeePct.high as number)
  if (!quotedFee?.stated) wouldNarrow.push('quotedProcessingFee')

  const processingFeeAmount = principal * (processingFeePct / 100)
  const otherCharges = rules.otherChargesInr.high as number
  const gstOnFees = (processingFeeAmount + otherCharges) * ((GST_ON_FEES_PCT as number) / 100)
  const netDisbursal = principal - processingFeeAmount - otherCharges - gstOnFees

  const aprBand: Band<number> = {
    low: aprFromCashFlows(netDisbursal, emiFor(principal, rateBand.low, tenureMonths), tenureMonths),
    high: aprFromCashFlows(
      netDisbursal,
      emiFor(principal, rateBand.high, tenureMonths),
      tenureMonths,
    ),
  }

  // --- explain ---------------------------------------------------------
  if (tier.isDistribution) {
    reasons.push(
      reason(
        `Your rate could be anywhere from ${rateBandText(rateBand.low, rateBand.high)} — a ${percent(rateBand.high - rateBand.low)} spread — because nobody has looked at your credit score yet. That band is wide because it covers every possibility, not because your credit is poor.`,
        ['creditScore'],
      ),
    )
  } else {
    reasons.push(
      reason(
        `Your rate lands between ${rateBandText(rateBand.low, rateBand.high)}: this product starts at ${percent(floor)} and your credit standing adds ${percent(tierLow)} to ${percent(tierHigh)}.`,
        ['creditScore', 'repaymentHistory'],
      ),
    )
  }

  if (event && eventSpread > 0) {
    reasons.push(
      reason(
        `A further ${percent(eventSpread)} is added for recent missed payments, and it comes off after ${event.coolingOffMonths as number} clean months.`,
        ['bouncedEmisLast12m', 'repaymentHistory'],
      ),
    )
  }

  if (!lenderType) {
    reasons.push(
      reason(
        'That range spans every kind of lender, from public sector banks at the bottom to app-based lenders at the top. Telling us who has quoted you narrows it considerably.',
        ['lenderType'],
      ),
    )
  }

  reasons.push(
    reason(
      `The all-in cost is ${rateBandText(aprBand.low, aprBand.high)}, higher than the headline rate: a ${percent(processingFeePct)} processing fee of ${rupees(processingFeeAmount)} plus ${rupees(gstOnFees)} GST${otherCharges > 0 ? ` and ${rupees(otherCharges)} of other charges` : ''} comes out of the disbursal, so on a ${rupees(principal)} sanction you would receive ${rupees(netDisbursal)} while paying interest on the full ${rupees(principal)}.`,
      ['quotedProcessingFee', 'requestedAmount'],
    ),
  )

  return {
    product,
    creditTier: tierId,
    repaymentEvent: eventId,
    rateBand,
    aprBand,
    processingFeePct,
    processingFeeAmount,
    gstOnFees,
    otherCharges,
    netDisbursal,
    unsecuredAvailable: tier.unsecuredAvailable && (event ? event.unsecuredAvailable : true),
    reasons,
    wouldNarrow,
    constraints: [...new Set(constraints)],
  }
}

/** PRD-08 - the union across lender types, used when none has been named. */
function marketWideSpread(): { low: number; high: number } {
  const all = Object.values(LENDER_TYPE_SPREAD_PCT_POINTS)
  return {
    low: Math.min(...all.map((b) => b.low as number)),
    high: Math.max(...all.map((b) => b.high as number)),
  }
}
