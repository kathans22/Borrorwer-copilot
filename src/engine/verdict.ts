/**
 * The headline answer, computed last, from everything else.
 *
 * Two loads, each an instalment over a ceiling:
 *
 *   safetyLoad      = requestedEmi / safeCarry
 *   eligibilityLoad = requestedEmi / lenderCeiling
 *
 * They fail for different reasons and produce different advice, so they are
 * never merged into a single score. Both must clear 1.0 exactly - there is no
 * tolerance band, because a 5% indulgence would quietly become the product's
 * real answer and it would always be spent against the borrower (VRD-01).
 */

import {
  MIN_ACTIONS_BY_VERDICT,
  PRODUCTIVE_MIN_COVERAGE_RATIO,
  PRODUCTS,
  PURPOSE_RULES,
  STRESS_DEMOTION_FLOOR_AT_BORROW_LESS,
  STRESS_FAILURE_DEMOTES_ONE_STEP,
  SURFACE_REFINANCE_AS_PRIMARY_WHEN_DO_NOT_BORROW,
  VERDICT_CUTOFFS,
  type ConstraintId,
  type SupportedProduct,
} from '../rules/rules.config'
import type {
  AnswerFieldId,
  BorrowerAnswers,
  CategoricalOutput,
  Confidence,
  LoanPurpose,
  Reason,
  RefinanceResult,
  VerdictValue,
} from '../types'
import { percent, reason, rupees } from './format'
import { emiFor, principalFor } from './money'
import { readChoice, readNumeric } from './resolve'
import type { Affordability } from './affordability'
import type { StressCase } from './emi'
import type { IncomeAssessment } from './incomeAssessment'

const ORDER: VerdictValue[] = ['borrow', 'borrow_less', 'do_not_borrow']

function demote(v: VerdictValue): VerdictValue {
  const i = ORDER.indexOf(v)
  return ORDER[Math.min(i + 1, ORDER.length - 1)]!
}

function promote(v: VerdictValue): VerdictValue {
  const i = ORDER.indexOf(v)
  return ORDER[Math.max(i - 1, 0)]!
}

export type VerdictAssessment = {
  output: CategoricalOutput<VerdictValue>
  /** The amount that does pass, when the answer is borrow_less (VRD-09). */
  passingAmountInr: number | null
  safetyLoad: number | null
  eligibilityLoad: number | null
  minViableEmi: number
  constraints: ConstraintId[]
}

/**
 * VRD-03. Derived rather than stored, so a change to the ticket floor, the
 * tenure cap or the rate band moves it too.
 */
export function minViableEmiFor(
  product: SupportedProduct,
  midRatePct: number,
  maxTenureMonths: number,
): number {
  const minTicket = PRODUCTS[product].ticketSizeInr.low as number
  return emiFor(minTicket, midRatePct, maxTenureMonths)
}

export function decideVerdict(input: {
  answers: BorrowerAnswers
  income: IncomeAssessment
  affordability: Affordability
  purpose: LoanPurpose
  /** Null when no product is open to this borrower at all. */
  product: SupportedProduct | null
  midRatePct: number
  tenureMonths: number
  requestedAmountInr: number | null
  stress: StressCase | null
  refinance: RefinanceResult | null
  hardFails: ConstraintId[]
  /** Derived from the bands of the numbers below it (CONF-03). */
  confidence: Confidence
}): VerdictAssessment {
  const { answers, affordability: aff, purpose, product } = input
  const reasons: Reason[] = []
  const constraints: ConstraintId[] = [...input.hardFails]
  const wouldNarrow: AnswerFieldId[] = []

  // ------------------------------------------------------------------
  // VRD-04 - conditions arithmetic cannot rescue
  // ------------------------------------------------------------------
  if (product === null) {
    reasons.push(
      reason(
        'No lending product is open to you on these answers, so there is no amount to assess.',
        ['employmentType', 'incomeProof', 'creditScore'],
      ),
    )
    return hardFail(reasons, constraints, wouldNarrow, input.refinance, 0, input.confidence)
  }

  if (readChoice(answers, 'repaymentHistory') === 'current_overdue') {
    constraints.push('current_overdue')
    reasons.push(
      reason(
        'You have an account currently overdue. Until that is regular, no lender will advance anything new, whatever the rest of your numbers say.',
        ['repaymentHistory'],
      ),
    )
    return hardFail(reasons, constraints, wouldNarrow, input.refinance, 0, input.confidence)
  }

  const minViableEmi = minViableEmiFor(product, input.midRatePct, input.tenureMonths)

  if (aff.safeCarryEmi < minViableEmi) {
    constraints.push('amount_above_safe_carry')
    reasons.push(
      reason(
        `Your household can carry ${rupees(aff.safeCarryEmi)} a month. The smallest loan anybody will write on this product needs ${rupees(minViableEmi)}, so there is no amount here that is safe for you to take right now.`,
        ['householdExpensesMonthly', 'rentMonthly', 'existingEmiMonthly', 'dependents'],
      ),
    )
    return hardFail(reasons, constraints, wouldNarrow, input.refinance, minViableEmi, input.confidence)
  }

  // ------------------------------------------------------------------
  // The two loads
  // ------------------------------------------------------------------
  const bindingCeiling = Math.min(aff.safeCarryEmi, aff.lenderEmiCeiling)
  const passingAmountInr = principalFor(bindingCeiling, input.midRatePct, input.tenureMonths)

  const requested = input.requestedAmountInr
  const requestedEmi =
    requested !== null ? emiFor(requested, input.midRatePct, input.tenureMonths) : null

  let verdict: VerdictValue
  let safetyLoad: number | null = null
  let eligibilityLoad: number | null = null

  if (requestedEmi === null) {
    verdict = 'borrow'
    reasons.push(
      reason(
        `You have not named an amount, so this is what fits: ${rupees(passingAmountInr)} at ${rupees(bindingCeiling)} a month.`,
        ['requestedAmount'],
      ),
    )
    wouldNarrow.push('requestedAmount')
  } else {
    safetyLoad = aff.safeCarryEmi > 0 ? requestedEmi / aff.safeCarryEmi : Number.POSITIVE_INFINITY
    eligibilityLoad =
      aff.lenderEmiCeiling > 0 ? requestedEmi / aff.lenderEmiCeiling : Number.POSITIVE_INFINITY
    const cutoff = VERDICT_CUTOFFS.borrowMaxLoad as number

    if (safetyLoad <= cutoff && eligibilityLoad <= cutoff) {
      verdict = 'borrow'
      reasons.push(
        reason(
          `${rupees(requested!)} means ${rupees(requestedEmi)} a month, inside both what a lender will allow (${rupees(aff.lenderEmiCeiling)}) and what your household can carry (${rupees(aff.safeCarryEmi)}).`,
          ['requestedAmount', 'householdExpensesMonthly', 'existingEmiMonthly'],
        ),
      )
    } else {
      verdict = 'borrow_less'
      constraints.push('amount_above_safe_carry')
      const blocker =
        safetyLoad > cutoff && eligibilityLoad > cutoff
          ? 'both what you can carry and what a lender will allow'
          : safetyLoad > cutoff
            ? 'what your household can carry'
            : 'what a lender will allow'
      reasons.push(
        reason(
          `${rupees(requested!)} means ${rupees(requestedEmi)} a month, which is beyond ${blocker}. ${rupees(passingAmountInr)} at ${rupees(bindingCeiling)} a month does fit.`,
          ['requestedAmount', 'householdExpensesMonthly', 'existingEmiMonthly', 'incomeProof'],
        ),
      )
    }
  }

  // ------------------------------------------------------------------
  // VRD-05 - stress demotes one step
  // ------------------------------------------------------------------
  if (input.stress && !input.stress.passes && STRESS_FAILURE_DEMOTES_ONE_STEP) {
    const before = verdict
    let demoted = demote(verdict)

    // VRD-10 - the sizing absorbs the stress, not the verdict. Dropping to
    // do_not_borrow here would contradict the reason we give for demoting.
    if (
      demoted === 'do_not_borrow' &&
      STRESS_DEMOTION_FLOOR_AT_BORROW_LESS &&
      aff.safeCarryEmi >= minViableEmi
    ) {
      demoted = 'borrow_less'
    }
    verdict = demoted

    if (verdict !== before) {
      reasons.push(
        reason(
          `This drops a step because it does not survive the stress case: a ${percent(input.stress.incomeDropPct, 0)} fall in income would leave the instalment above what you could then carry.`,
          ['incomeStability', 'savingsBuffer'],
        ),
      )
    } else {
      reasons.push(
        reason(
          `Take the smaller figure rather than the largest that fits today: at ${rupees(bindingCeiling)} a month, a ${percent(input.stress.incomeDropPct, 0)} fall in income would leave you short. A loan that breaks in a bad month is a smaller loan, not no loan.`,
          ['incomeStability', 'savingsBuffer'],
        ),
      )
    }
  }

  // ------------------------------------------------------------------
  // VRD-06 to VRD-08 - the productive offset
  // ------------------------------------------------------------------
  const purposeRules = PURPOSE_RULES[purpose]
  // The stress case recognises none of the incremental earning (PUR-02), so a
  // loan that only works with the offset must never reach borrow (VRD-06).
  // Without this guard the offset silently cancels the stress demotion.
  const stressPassed = input.stress === null || input.stress.passes
  if (purposeRules.allowsIncomeOffset && verdict !== 'borrow') {
    const earning = readNumeric(answers, 'incrementalEarningMonthly', 'income')
    const alreadyHappening = readChoice<boolean>(answers, 'incrementalEarningAlreadyHappening')

    if (!earning?.stated) {
      wouldNarrow.push('incrementalEarningMonthly')
      reasons.push(
        reason(
          'If this loan will earn you money, tell us how much and whether it is already happening. We will not assume it from the purpose alone.',
          ['incrementalEarningMonthly'],
        ),
      )
    } else {
      const ratio =
        alreadyHappening === true
          ? (purposeRules.existingIncrementalRecognitionRatio as number)
          : (purposeRules.projectedIncrementalRecognitionRatio as number)
      const counted = earning.safety * ratio
      const emiToCover = requestedEmi ?? bindingCeiling
      const coverage = emiToCover > 0 ? earning.safety / emiToCover : 0

      if (
        coverage >= (PRODUCTIVE_MIN_COVERAGE_RATIO as number) &&
        verdict === 'borrow_less' &&
        stressPassed
      ) {
        verdict = promote(verdict)
        reasons.push(
          reason(
            `The ${rupees(earning.safety)} a month this is expected to earn covers the ${rupees(emiToCover)} instalment ${coverage.toFixed(1)} times over, and ${rupees(counted)} of it counts towards affordability. That lifts this a step.`,
            ['incrementalEarningMonthly', 'incrementalEarningAlreadyHappening'],
          ),
        )
      } else if (coverage >= (PRODUCTIVE_MIN_COVERAGE_RATIO as number) && !stressPassed) {
        reasons.push(
          reason(
            `The ${rupees(earning.safety)} a month this is expected to earn covers the instalment ${coverage.toFixed(1)} times over, but it does not lift the answer: the stress case counts none of it, and a loan that only works while the new earning holds up is not one to take at full size.`,
            ['incrementalEarningMonthly', 'incomeStability'],
          ),
        )
      } else if (coverage < (PRODUCTIVE_MIN_COVERAGE_RATIO as number)) {
        reasons.push(
          reason(
            `The ${rupees(earning.safety)} a month you expect to earn covers the instalment only ${coverage.toFixed(1)} times, short of the ${(PRODUCTIVE_MIN_COVERAGE_RATIO as number).toFixed(2)} we look for. An asset that earns roughly its own instalment leaves you working for the lender and carrying the risk of a slow month.`,
            ['incrementalEarningMonthly'],
          ),
        )
      }
    }
  }

  // ------------------------------------------------------------------
  // REF-09 - restructuring leads when the answer is no
  // ------------------------------------------------------------------
  if (
    verdict === 'do_not_borrow' &&
    input.refinance &&
    SURFACE_REFINANCE_AS_PRIMARY_WHEN_DO_NOT_BORROW
  ) {
    reasons.push(refinanceLead(input.refinance))
  }

  return {
    output: {
      value: verdict,
      confidence: input.confidence,
      reasons,
      wouldNarrow: [...new Set(wouldNarrow)],
    },
    passingAmountInr: verdict === 'borrow_less' ? passingAmountInr : null,
    safetyLoad,
    eligibilityLoad,
    minViableEmi,
    constraints: [...new Set(constraints)],
  }
}

function refinanceLead(refi: RefinanceResult): Reason {
  const saving = refi.totalSavingOverTenure.band.high as number
  return reason(
    `New borrowing is the wrong question here. Restructuring what you already owe is worth ${rupees(saving)} to you, and it is available now — that is the thing to do first.`,
    ['informalDebtOutstanding', 'creditCardOutstanding', 'existingLoanOutstanding'],
  )
}

function hardFail(
  reasons: Reason[],
  constraints: ConstraintId[],
  wouldNarrow: AnswerFieldId[],
  refi: RefinanceResult | null,
  minViableEmi: number,
  confidence: Confidence,
): VerdictAssessment {
  if (refi && SURFACE_REFINANCE_AS_PRIMARY_WHEN_DO_NOT_BORROW) {
    reasons.push(refinanceLead(refi))
  }
  return {
    output: {
      value: 'do_not_borrow',
      confidence,
      reasons,
      wouldNarrow: [...new Set(wouldNarrow)],
    },
    passingAmountInr: null,
    safetyLoad: null,
    eligibilityLoad: null,
    minViableEmi,
    constraints: [...new Set(constraints)],
  }
}

/** Exposed so the action plan can assert against the same floor. */
export const MINIMUM_ACTIONS = MIN_ACTIONS_BY_VERDICT
