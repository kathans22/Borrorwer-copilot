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


import type {
  CityTier,
  EmploymentType,
  IncomeProofType,
  Months,
  Ratio,
  RupeesPerMonth,
} from '../types'
import { inrPerMonth, months, ratio } from '../units'
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

/* =====================================================================
 * AFF - Affordability
 *
 * Two rules that never speak to each other.
 *
 *   FOIR       - the lender's test. A ratio of obligations to recognised
 *                income. Answers "how much will they sanction?"
 *   safe carry - the household's test. A budget identity built from what
 *                actually leaves the house each month. Answers "how much
 *                can they carry without the first bad month breaking them?"
 *
 * AFF-14 forbids either rule from reading the other's output. They must be
 * able to disagree, because in practice they disagree by three or four
 * times, and that disagreement is the product.
 * ===================================================================== */

/**
 * AFF-01 - Lender FOIR cap by recognised monthly income.
 *
 * Higher incomes are allowed a higher ratio because the rupees left after a
 * fixed basket of essentials grow faster than the ratio does: 40% of 20,000
 * leaves 12,000 to live on, 60% of 150,000 leaves 60,000. Bands are read
 * as "income strictly below `belowInrPerMonth` takes this cap", in order.
 */
export const FOIR_CAP_BY_INCOME_BAND: ReadonlyArray<{
  belowInrPerMonth: RupeesPerMonth
  foirRatio: Ratio
}> = [
  { belowInrPerMonth: inrPerMonth(25_000), foirRatio: ratio(0.4) },
  { belowInrPerMonth: inrPerMonth(50_000), foirRatio: ratio(0.5) },
  { belowInrPerMonth: inrPerMonth(100_000), foirRatio: ratio(0.55) },
  { belowInrPerMonth: inrPerMonth(Number.POSITIVE_INFINITY), foirRatio: ratio(0.6) },
]

/**
 * AFF-02 - Adjustment to the FOIR cap for income volatility, in ratio
 * points. A lender discounts a variable income twice: once on recognition
 * (INC-02) and again on how much of it may be committed.
 */
export const FOIR_ADJUSTMENT_RATIO_POINTS_BY_EMPLOYMENT: Record<EmploymentType, Ratio> = {
  salaried_formal: ratio(0),
  salaried_informal: ratio(-0.05),
  self_employed_documented: ratio(-0.05),
  self_employed_cash: ratio(-0.05),
  daily_wage: ratio(-0.1),
}

/** AFF-03 - Floor under the adjusted FOIR cap. Nothing goes below this. */
export const FOIR_FLOOR_RATIO: Ratio = ratio(0.3)

/**
 * AFF-04 - Existing obligations sit inside the cap, not outside it.
 * lenderEmiCeiling = foirCap * recognisedLenderIncome - existingObligations
 */
export const FOIR_INCLUDES_EXISTING_OBLIGATIONS = true

/**
 * AFF-05 - Minimum money that must remain each month after rent, existing
 * obligations and the new EMI, to cover everything the household actually
 * lives on.
 *
 * This is the residual-income test used in mortgage underwriting, and it is
 * the reason a percentage cap alone is not enough: 50% of 26,000 leaves a
 * metro household of two below what it costs them to eat.
 *
 * Deliberately expressed net of rent only, never stacked on top of a
 * separate expense estimate - AFF-08 takes whichever of the two tests binds
 * rather than subtracting both.
 */
export const RESIDUAL_INCOME_FLOOR: Record<
  CityTier,
  { baseInrPerMonth: RupeesPerMonth; perDependentInrPerMonth: RupeesPerMonth }
> = {
  metro: { baseInrPerMonth: inrPerMonth(9_500), perDependentInrPerMonth: inrPerMonth(3_000) },
  tier2: { baseInrPerMonth: inrPerMonth(7_500), perDependentInrPerMonth: inrPerMonth(2_500) },
  tier3: { baseInrPerMonth: inrPerMonth(6_000), perDependentInrPerMonth: inrPerMonth(2_000) },
  rural: { baseInrPerMonth: inrPerMonth(5_000), perDependentInrPerMonth: inrPerMonth(1_750) },
}

/**
 * AFF-06 - Emergency buffer the household should hold, in months of total
 * outflow, before it takes on a new fixed obligation.
 *
 * Volatile incomes need more because their bad month is deeper and arrives
 * without notice. An emergency loan relaxes it to one month, because the
 * emergency is the reason the buffer is already gone (see PUR-04).
 */
export const EMERGENCY_BUFFER_TARGET_MONTHS = {
  stableIncome: months(3),
  volatileIncome: months(6),
  emergencyPurpose: months(1),
}

/** AFF-07 - If the buffer is short, it is rebuilt over this many months. */
export const BUFFER_REBUILD_HORIZON_MONTHS: Months = months(12)

/**
 * AFF-08 - Cap on how much of the pre-EMI surplus buffer rebuilding may
 * consume.
 *
 * Without this, a borrower with no savings is told to save their entire
 * surplus and can never borrow anything - which is not advice, it is a
 * refusal wearing a spreadsheet.
 */
export const BUFFER_ACCRUAL_CAP_RATIO_OF_SURPLUS: Ratio = ratio(0.2)

/**
 * AFF-09 to AFF-13 - The safe-carry identity.
 *
 * Two limits are computed and the lower binds:
 *
 *   budget limit   = safetyIncome
 *                  - householdExpenses - rent - existingEmi
 *                  - informalDebtService - bufferAccrual
 *
 *   residual limit = safetyIncome - rent - existingEmi
 *                  - residualIncomeFloor
 *
 * Stated here as data so the engine cannot quietly add a term.
 */
export const SAFE_CARRY = {
  /** AFF-09 - the two limits above, lower one binds. */
  method: 'min_of_budget_and_residual' as const,
  /** AFF-10 - a negative safe carry is reported as zero, not as a number. */
  floorAtZero: true,
  /** AFF-11 - informal debt is serviced before anything new is taken on. */
  includeInformalDebtService: true,
  /** AFF-12 - buffer rebuilding is treated as a fixed obligation. */
  includeBufferAccrual: true,
  /** AFF-13 - the stress test is a separate pass/fail, not baked in here. */
  appliesStressInline: false,
}

/**
 * AFF-14 - Structural invariant, enforced by review rather than by the
 * compiler: neither affordability rule may read the other's output. If
 * safe carry ever starts as "FOIR times something", this file has lost the
 * only idea in it worth having.
 */
export const AFFORDABILITY_RULES_ARE_INDEPENDENT = true
