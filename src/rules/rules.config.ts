/**
 * Borrower Copilot - the rules layer.
 *
 * Every lending constant in this application lives in this file. Nothing in
 * `engine/`, `questions/` or `ui/` is allowed to hold a threshold, a rate, a
 * ratio or a cutoff of its own. Change a value here and the app's output
 * changes with no other edit - that is the contract, and it is what makes it
 * possible to sit with somebody, disagree with an assumption, and watch the
 * answer move.
 *
 * Each entry carries a rule ID. The same IDs head the rows of RULES.md,
 * which is the human-readable half of this file and says why each number is
 * what it is. If the two ever disagree, RULES.md is the one that is wrong -
 * this is what runs.
 *
 * Units are stated in every field name and enforced by the branded types in
 * `types.ts`. Rates are annual, incomes are monthly, amounts are in rupees,
 * and a spread of 100 bps is written as 1.00 percentage points.
 *
 * Numbers marked NEEDS VERIFICATION in RULES.md are my best reading of the
 * Indian market and have not been sourced from a lender. They are listed in
 * OPEN_QUESTIONS.md so they can be checked rather than trusted.
 */


import type { EmploymentType, IncomeProofType, Ratio } from '../types'
import { ratio } from '../units'
/* =====================================================================
 * INC - Income recognition
 *
 * Two views of the same income, produced by two independent rules:
 *
 *   lender view  - what an underwriter will actually count. Driven by the
 *                  proof the borrower can put on the table, capped by how
 *                  the income is earned.
 *   safety view  - what the household actually has to repay from, whether
 *                  or not anyone will document it.
 *
 * The gap between the two is the point of this product. For a shopkeeper
 * paid in cash, the lender view can be less than half the safety view.
 * ===================================================================== */

/**
 * INC-01 - How much of a stated income a lender counts, by the proof shown.
 * Proof is the primary driver: an underwriter cannot lend against a number
 * nobody can verify, however true it is.
 */
export const INCOME_PROOF_RECOGNITION_RATIO: Record<IncomeProofType, Ratio> = {
  salary_slips: ratio(1.0),
  itr: ratio(1.0),
  gst_returns: ratio(0.6),
  bank_statements_only: ratio(0.5),
  none: ratio(0.0),
}

/**
 * INC-02 - Ceiling on recognition set by how the income is earned, applied
 * on top of the proof ratio. Good proof of a volatile income is still a
 * volatile income.
 */
export const EMPLOYMENT_RECOGNITION_CAP_RATIO: Record<EmploymentType, Ratio> = {
  salaried_formal: ratio(1.0),
  salaried_informal: ratio(0.8),
  self_employed_documented: ratio(1.0),
  self_employed_cash: ratio(0.8),
  daily_wage: ratio(0.6),
}

/**
 * INC-03 - How the two combine: the lower of the two binds.
 *
 * Stated as data rather than buried in the engine so that changing it is a
 * config edit. `min` means better proof raises recognition up to the
 * employment ceiling and no further - which is what makes "file your ITR"
 * a real action for a cash-earning shopkeeper (0.50 -> 0.80) rather than a
 * platitude.
 */
export const INCOME_RECOGNITION_COMBINATION = 'min' as const

/**
 * INC-04 - The safety view counts all stated income, from every source,
 * documented or not.
 *
 * It is 1.0 for every income type on purpose. Volatility is a real concern
 * but it is priced once, in STR-*, and in the range-collapse rule below -
 * not three times over. One concern, one rule.
 */
export const SAFETY_VIEW_RECOGNITION_RATIO: Ratio = ratio(1.0)

/**
 * INC-05 - Collapsing a stated income range ("I make 26 to 30 thousand").
 *
 * The two views deliberately take different points. A lender averages six
 * to twelve months of bank credits, and the average of a stated range is
 * its midpoint. A household budget has to survive the bad month, because
 * the rent and the school fee arrive in the bad month too.
 *
 * Expressed as a position in the range: 0.0 is the low end, 1.0 the high.
 */
export const INCOME_RANGE_COLLAPSE = {
  underwritingPointOfRange: ratio(0.5),
  safetyPointOfRange: ratio(0.0),
}

/**
 * INC-06 - Collapsing a stated expense or obligation range. Both views take
 * the top of the range. An understated cost is the one that hurts.
 */
export const EXPENSE_RANGE_COLLAPSE = {
  underwritingPointOfRange: ratio(1.0),
  safetyPointOfRange: ratio(1.0),
}

/**
 * INC-07 - The single place annual income becomes monthly income.
 *
 * An ITR figure is annual and a cash income is monthly. Mixing them is the
 * most likely arithmetic bug in this codebase, so the conversion has one
 * home and the branded types make the compiler enforce its use.
 */
export const ITR_ANNUAL_TO_MONTHLY_DIVISOR = 12

/**
 * INC-08 to INC-11 - Co-applicant treatment.
 *
 * A co-applicant is jointly liable, so their income counts in full - but it
 * is put through the same proof and employment rules as the main applicant,
 * and their existing obligations come across with it. Half of a household's
 * income is no use if the other half of its debt is invisible.
 */
export const CO_APPLICANT = {
  /** INC-08 - share of the co-applicant's recognised income that counts. */
  incomeShareRatio: ratio(1.0),
  /** INC-09 - their income runs through INC-01/02 on their own proof. */
  applyOwnProofAndEmploymentRules: true,
  /** INC-10 - their existing EMIs join the obligation side. */
  countTheirObligations: true,
  /** INC-11 - never counted unless the borrower said there is one. */
  countOnlyIfExplicitlyStated: true,
}
