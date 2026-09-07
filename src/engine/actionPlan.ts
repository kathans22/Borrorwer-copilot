/**
 * What the borrower can actually do next.
 *
 * Built from the constraints the other modules recorded while computing, so
 * an action can only appear if the borrower genuinely has the thing it
 * relaxes. Each one says what it would change to *this* borrower's numbers
 * (ACT-17), because "get your credit score" is a chore and "get your credit
 * score, it would narrow an eleven-point rate range to about two" is a
 * reason to do it.
 *
 * A do_not_borrow verdict with nothing to do is a bug, not a valid state, and
 * this module throws rather than returning one.
 */

import {
  ACTION_CATALOGUE,
  ALWAYS_AVAILABLE_ACTIONS,
  MIN_ACTIONS_BY_VERDICT,
  type ConstraintId,
} from '../rules/rules.config'
import type { ActionStep, VerdictValue } from '../types'
import { percent, rupees } from './format'

/**
 * Numbers from this borrower's own result, used to make the generic
 * catalogue entries specific. Anything absent falls back to the catalogue
 * text, which is already written to say what it changes.
 */
export type ActionContext = {
  rateBandWidthPctPoints?: number
  narrowedRateWidthPctPoints?: number
  recognisedIncomeMonthly?: number
  reliableIncomeMonthly?: number
  potentialRecognisedIncomeMonthly?: number
  safeAmountInr?: number
  requestedAmountInr?: number
  assumedExpensesMonthly?: number
  bufferShortfallInr?: number
  informalDebtInr?: number
  informalDebtAnnualPct?: number
  refinanceTotalSavingInr?: number
  coApplicantIncomeMonthly?: number
  currentTenureMonths?: number
  productTenureCeilingMonths?: number
  cheaperProductRatePct?: number
  currentProductRatePct?: number
}

/** Most consequential first, so a borrower reading two of them reads the right two. */
const PRIORITY: ConstraintId[] = [
  'current_overdue',
  'high_cost_debt_present',
  'income_undocumented',
  'no_itr_filed',
  'credit_score_unknown',
  'property_title_unconfirmed',
  'no_co_applicant_counted',
  'amount_above_safe_carry',
  'recent_bounce',
  'product_demoted_by_credit',
  'buffer_short',
  'tenure_capped_by_age',
  'expenses_unstated',
  'thin_work_history',
]

/** Replace the catalogue's generic effect with this borrower's own numbers. */
function changesWhat(id: ConstraintId, ctx: ActionContext): string {
  const fallback = ACTION_CATALOGUE[id].changesWhat

  switch (id) {
    case 'credit_score_unknown':
      return ctx.rateBandWidthPctPoints !== undefined
        ? `Your rate range is ${percent(ctx.rateBandWidthPctPoints)} wide right now because nothing has been measured. Knowing the score would narrow it to around ${percent(ctx.narrowedRateWidthPctPoints ?? 2.5)}.`
        : fallback

    case 'income_undocumented':
      return ctx.recognisedIncomeMonthly !== undefined && ctx.reliableIncomeMonthly !== undefined
        ? `Your household has ${rupees(ctx.reliableIncomeMonthly)} a month but a lender counts ${rupees(ctx.recognisedIncomeMonthly)}${ctx.potentialRecognisedIncomeMonthly !== undefined ? `. Statements would take that to about ${rupees(ctx.potentialRecognisedIncomeMonthly)}` : ''}, and everything you are offered is built on the smaller figure.`
        : fallback

    case 'no_itr_filed':
      return ctx.recognisedIncomeMonthly !== undefined
        ? `A filed return is the difference between a lender counting ${rupees(ctx.recognisedIncomeMonthly)} of your income and counting most of it. It moves the ceiling more than anything else here.`
        : fallback

    case 'high_cost_debt_present':
      return ctx.informalDebtInr !== undefined && ctx.informalDebtAnnualPct !== undefined
        ? `You are paying ${percent(ctx.informalDebtAnnualPct)} a year on ${rupees(ctx.informalDebtInr)}${ctx.refinanceTotalSavingInr !== undefined && ctx.refinanceTotalSavingInr > 0 ? `. Moving it saves about ${rupees(ctx.refinanceTotalSavingInr)} and the debt actually ends` : ''}. This is worth more to you than the loan you came here for.`
        : fallback

    case 'amount_above_safe_carry':
      return ctx.safeAmountInr !== undefined && ctx.requestedAmountInr !== undefined
        ? `You asked for ${rupees(ctx.requestedAmountInr)}. ${rupees(ctx.safeAmountInr)} is what your household can carry without a bad month becoming a missed payment.`
        : fallback

    case 'expenses_unstated':
      return ctx.assumedExpensesMonthly !== undefined
        ? `We are assuming ${rupees(ctx.assumedExpensesMonthly)} a month. Your own figure replaces it, and your safe limit moves with it in whichever direction is true.`
        : fallback

    case 'buffer_short':
      return ctx.bufferShortfallInr !== undefined
        ? `You are about ${rupees(ctx.bufferShortfallInr)} short of one month of cover. That gap is the difference between a bad month being awkward and it becoming a default.`
        : fallback

    case 'no_co_applicant_counted':
      return ctx.coApplicantIncomeMonthly !== undefined
        ? `Their ${rupees(ctx.coApplicantIncomeMonthly)} a month currently counts towards what you can afford but nothing towards what you will be offered. Documenting it changes that.`
        : fallback

    case 'tenure_capped_by_age':
      return ctx.currentTenureMonths !== undefined && ctx.productTenureCeilingMonths !== undefined
        ? `Your term is capped at ${Math.round(ctx.currentTenureMonths)} months rather than this product's ${Math.round(ctx.productTenureCeilingMonths)}, which raises the instalment and lowers the amount that fits.`
        : fallback

    case 'product_demoted_by_credit':
      return ctx.cheaperProductRatePct !== undefined && ctx.currentProductRatePct !== undefined
        ? `Security would price you at around ${percent(ctx.cheaperProductRatePct)} instead of ${percent(ctx.currentProductRatePct)}.`
        : fallback

    default:
      return fallback
  }
}

function toStep(id: ConstraintId, ctx: ActionContext): ActionStep {
  const entry = ACTION_CATALOGUE[id]
  return {
    text: entry.text,
    changesWhat: changesWhat(id, ctx),
    timeframe: entry.timeframe,
  }
}

export function buildActionPlan(
  verdict: VerdictValue,
  constraints: ConstraintId[],
  ctx: ActionContext = {},
): ActionStep[] {
  const present = new Set(constraints)
  const chosen: ConstraintId[] = PRIORITY.filter((id) => present.has(id))

  // ACT-15/16 - top up to the floor from the always-available list, so the
  // minimum can always be met without inventing a constraint.
  const minimum = MIN_ACTIONS_BY_VERDICT[verdict]
  for (const id of ALWAYS_AVAILABLE_ACTIONS) {
    if (chosen.length >= minimum) break
    if (!chosen.includes(id)) chosen.push(id)
  }

  const steps = chosen.map((id) => toStep(id, ctx))

  if (verdict === 'do_not_borrow' && steps.length === 0) {
    throw new Error(
      'do_not_borrow produced no actions. Telling a borrower no with no path is the failure this product exists to fix (ACT-15).',
    )
  }
  if (steps.length < minimum) {
    throw new Error(
      `Verdict ${verdict} requires at least ${minimum} actions (ACT-15) but only ${steps.length} were generated.`,
    )
  }

  return steps
}
