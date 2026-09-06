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
  AnnualRatePct,
  Band,
  CityTier,
  CreditScore,
  EmploymentType,
  IncomeProofType,
  LenderType,
  LoanPurpose,
  Months,
  Percent,
  ProductType,
  Ratio,
  Rupees,
  RupeesPerMonth,
  Years,
} from '../types'
import {
  creditScore,
  inr,
  inrPerMonth,
  months,
  pct,
  pctPerYear,
  pctPointsPerYear,
  ratio,
  years,
} from '../units'
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

/* =====================================================================
 * PRD - Product catalogue
 *
 * Four products. Gold and home loans are deliberately absent: none of the
 * three borrowers in the brief needs one, and breadth beyond their needs is
 * not what is being asked for. `ProductType` still carries 'gold' because
 * it is part of the answer vocabulary; `SupportedProduct` is what this
 * engine will actually price, and the compiler enforces the difference.
 *
 * Every rate here is annual and every amount is in rupees. Spreads are in
 * percentage points per annum - 100 bps is 1.00.
 * ===================================================================== */

/** The products this engine prices. See PRD-00 in RULES.md for the omission. */
export type SupportedProduct = Exclude<ProductType, 'gold'>

export type ProductRules = {
  /** Cheapest rate a strong borrower realistically sees. */
  rateFloorAnnualPct: AnnualRatePct
  /** Dearest rate at which this product is still worth taking. */
  rateCeilingAnnualPct: AnnualRatePct
  /** Floating rates move with the repo cycle; fixed ones do not (STR-02). */
  rateType: 'fixed' | 'floating'
  /** Loan to value, where the product is secured. `null` when unsecured. */
  ltvRatio: Band<Ratio> | null
  tenureMonths: Band<Months>
  /** Processing fee as a percentage of sanctioned amount, before GST. */
  processingFeePct: Band<Percent>
  /** Fees that are not a percentage - valuation, legal, documentation. */
  otherChargesInr: Band<Rupees>
  ticketSizeInr: Band<Rupees>
  /** Minimum recognised (lender-view) income to be considered at all. */
  minRecognisedIncomeInrPerMonth: RupeesPerMonth
  /** Conditions that must hold before the product can be offered. */
  preconditions: string[]
}

/**
 * PRD-01 to PRD-04 - The catalogue.
 *
 * Every band in here is a market observation, not a quoted price, and every
 * one of them is listed in OPEN_QUESTIONS.md as needing verification before
 * this goes in front of a borrower. They are the numbers I would defend as
 * approximately right for the Indian market; they are not scraped.
 */
export const PRODUCTS: Record<SupportedProduct, ProductRules> = {
  // PRD-01 - Personal loan. Unsecured, fastest, dearest of the bank products.
  personal: {
    rateFloorAnnualPct: pctPerYear(10.5),
    rateCeilingAnnualPct: pctPerYear(24.0),
    rateType: 'fixed',
    ltvRatio: null,
    tenureMonths: { low: months(12), high: months(60) },
    processingFeePct: { low: pct(1.0), high: pct(3.0) },
    otherChargesInr: { low: inr(0), high: inr(2_000) },
    ticketSizeInr: { low: inr(25_000), high: inr(2_500_000) },
    minRecognisedIncomeInrPerMonth: inrPerMonth(15_000),
    preconditions: [
      'Recognised income at or above the product floor',
      'No current overdue on any existing credit (CRD-12)',
    ],
  },

  // PRD-02 - Loan against property. Cheapest and largest, and the only one
  // where a default costs the borrower the roof or the shop.
  lap: {
    rateFloorAnnualPct: pctPerYear(9.0),
    rateCeilingAnnualPct: pctPerYear(15.0),
    rateType: 'floating',
    ltvRatio: { low: ratio(0.5), high: ratio(0.7) },
    tenureMonths: { low: months(60), high: months(180) },
    processingFeePct: { low: pct(0.5), high: pct(2.0) },
    otherChargesInr: { low: inr(5_000), high: inr(15_000) },
    ticketSizeInr: { low: inr(300_000), high: inr(50_000_000) },
    minRecognisedIncomeInrPerMonth: inrPerMonth(20_000),
    preconditions: [
      'Property is unencumbered - no existing charge or mortgage',
      'Clear, marketable title in the applicant or co-applicant name',
      'Property is a completed, approved construction, not agricultural land',
    ],
  },

  // PRD-03 - Unsecured business loan. What a shopkeeper is usually offered,
  // and usually the wrong answer if they own their premises (RTE-02).
  business_unsecured: {
    rateFloorAnnualPct: pctPerYear(14.0),
    rateCeilingAnnualPct: pctPerYear(26.0),
    rateType: 'fixed',
    ltvRatio: null,
    tenureMonths: { low: months(12), high: months(48) },
    processingFeePct: { low: pct(1.0), high: pct(3.0) },
    otherChargesInr: { low: inr(0), high: inr(3_000) },
    ticketSizeInr: { low: inr(50_000), high: inr(5_000_000) },
    minRecognisedIncomeInrPerMonth: inrPerMonth(25_000),
    preconditions: [
      'Business vintage of at least 24 months',
      'ITR or GST returns for at least one completed year',
    ],
  },

  // PRD-04 - Two-wheeler, electric. Secured by the vehicle, which is a
  // depreciating asset, so tenure is held short by PRD-06 rather than by age.
  two_wheeler_ev: {
    rateFloorAnnualPct: pctPerYear(9.5),
    rateCeilingAnnualPct: pctPerYear(22.0),
    rateType: 'fixed',
    ltvRatio: { low: ratio(0.8), high: ratio(0.9) },
    tenureMonths: { low: months(12), high: months(48) },
    processingFeePct: { low: pct(1.0), high: pct(2.0) },
    otherChargesInr: { low: inr(1_000), high: inr(3_000) },
    ticketSizeInr: { low: inr(30_000), high: inr(300_000) },
    minRecognisedIncomeInrPerMonth: inrPerMonth(10_000),
    preconditions: [
      'Down payment of at least the shortfall below maximum LTV',
      'Vehicle is a new purchase from a registered dealer',
    ],
  },
}

/**
 * PRD-05 - LTV by what is being pledged. LAP against a shop is lent against
 * more conservatively than against a home: commercial property is slower to
 * sell and its valuation is softer.
 */
export const LAP_LTV_BY_PROPERTY_KIND: Record<'residential' | 'commercial', Band<Ratio>> = {
  residential: { low: ratio(0.6), high: ratio(0.7) },
  commercial: { low: ratio(0.5), high: ratio(0.6) },
}

/**
 * PRD-06 - Tenure must not outlive the asset securing it. Financing an
 * electric two-wheeler over five years puts the borrower in negative equity
 * around the point the battery needs replacing.
 */
export const TENURE_NOT_TO_EXCEED_ASSET_LIFE_MONTHS: Record<SupportedProduct, Months | null> = {
  personal: null,
  lap: null,
  business_unsecured: null,
  two_wheeler_ev: months(48),
}

/**
 * PRD-07 - GST on lender fees. Applies to the processing fee and to the
 * other charges, and it is part of the cost of the loan whatever the
 * sanction letter calls it. Fed into APR-01.
 */
export const GST_ON_FEES_PCT: Percent = pct(18)

/**
 * PRD-08 - Where a lender sits in the pricing range, in percentage points
 * added to the product floor.
 *
 * The same borrower with the same file is priced differently by a public
 * sector bank and by a fintech, and a borrower who does not know that is
 * the one who takes the first offer. Segmenting the fair-rate band this way
 * was one of the open questions sent on day one; the market-wide band is
 * the union of these, used when the borrower has not named a lender.
 */
export const LENDER_TYPE_SPREAD_PCT_POINTS: Record<LenderType, Band<AnnualRatePct>> = {
  psu_bank: { low: pctPointsPerYear(0), high: pctPointsPerYear(1.5) },
  private_bank: { low: pctPointsPerYear(0.5), high: pctPointsPerYear(3.0) },
  nbfc: { low: pctPointsPerYear(2.0), high: pctPointsPerYear(6.0) },
  fintech: { low: pctPointsPerYear(4.0), high: pctPointsPerYear(10.0) },
}

/* =====================================================================
 * CRD - Credit standing
 *
 * The central idea in this section: an unknown score is not a bad score and
 * it is not an average score. It is a distribution. A tool that quietly
 * substitutes 650 for "I do not know" is inventing a fact about the
 * borrower, and it will be wrong in both directions - it talks a prime
 * borrower out of a rate they could get, and it lets a subprime borrower
 * believe a number they will never be offered.
 *
 * So unknown maps to the union of every tier, and the width of that band is
 * itself the message: it is wide because you have not looked, and looking
 * is free (ACT-01).
 * ===================================================================== */

export type CreditTierId =
  | 'prime_plus'
  | 'prime'
  | 'near_prime'
  | 'subprime'
  | 'deep_subprime'
  | 'below_threshold'
  | 'no_file'
  | 'unknown'

export type CreditTier = {
  /** Inclusive lower bound of the bureau score band. `null` where not scored. */
  minScore: CreditScore | null
  /** Added to the product rate floor, in percentage points per annum. */
  spreadPctPoints: Band<AnnualRatePct>
  /** True where the band is the union of other tiers rather than a measurement. */
  isDistribution: boolean
  /** Unsecured products this tier can realistically reach. */
  unsecuredAvailable: boolean
  note: string
}

/**
 * CRD-01 to CRD-08 - Score tiers.
 *
 * Ordered from best to worst. The engine walks this list and takes the
 * first tier whose `minScore` the borrower meets.
 */
export const CREDIT_TIERS: Record<CreditTierId, CreditTier> = {
  // CRD-01
  prime_plus: {
    minScore: creditScore(780),
    spreadPctPoints: { low: pctPointsPerYear(0), high: pctPointsPerYear(0.75) },
    isDistribution: false,
    unsecuredAvailable: true,
    note: 'Priced at or near the product floor. Has room to negotiate.',
  },
  // CRD-02
  prime: {
    minScore: creditScore(750),
    spreadPctPoints: { low: pctPointsPerYear(0.75), high: pctPointsPerYear(2.0) },
    isDistribution: false,
    unsecuredAvailable: true,
    note: 'Bank pricing available across products.',
  },
  // CRD-03
  near_prime: {
    minScore: creditScore(700),
    spreadPctPoints: { low: pctPointsPerYear(2.0), high: pctPointsPerYear(4.5) },
    isDistribution: false,
    unsecuredAvailable: true,
    note: 'Approved by most lenders, priced above the best on offer.',
  },
  // CRD-04
  subprime: {
    minScore: creditScore(650),
    spreadPctPoints: { low: pctPointsPerYear(4.5), high: pctPointsPerYear(8.0) },
    isDistribution: false,
    unsecuredAvailable: true,
    note: 'Banks may decline unsecured. NBFC pricing likely.',
  },
  // CRD-05
  deep_subprime: {
    minScore: creditScore(600),
    spreadPctPoints: { low: pctPointsPerYear(8.0), high: pctPointsPerYear(12.0) },
    isDistribution: false,
    unsecuredAvailable: false,
    note: 'Secured routes only. Unsecured pricing here rarely clears the safety test.',
  },
  // CRD-06
  below_threshold: {
    minScore: creditScore(0),
    spreadPctPoints: { low: pctPointsPerYear(12.0), high: pctPointsPerYear(18.0) },
    isDistribution: false,
    unsecuredAvailable: false,
    note: 'Formal unsecured credit is not realistically available. Repair first (ACT-03).',
  },
  // CRD-07 - Confirmed new to credit. Narrower than unknown, because "I
  // checked and there is no file" is itself information.
  no_file: {
    minScore: null,
    spreadPctPoints: { low: pctPointsPerYear(3.0), high: pctPointsPerYear(9.0) },
    isDistribution: false,
    unsecuredAvailable: true,
    note: 'New to credit. Priced on income and stability rather than history.',
  },
  // CRD-08 - Not a value. The union of every scored tier above.
  unknown: {
    minScore: null,
    spreadPctPoints: { low: pctPointsPerYear(0), high: pctPointsPerYear(12.0) },
    isDistribution: true,
    unsecuredAvailable: true,
    note: 'Unknown is a distribution, not a default. The band spans every tier because nothing has been measured. Checking is free and narrows it to roughly 2 points (ACT-01).',
  },
}

/**
 * CRD-09 - The union band above is deliberately not population-weighted.
 * Weighting it would mean inventing a distribution of Indian bureau scores
 * that I cannot source, and dressing a guess as arithmetic.
 */
export const UNKNOWN_SCORE_IS_UNWEIGHTED_UNION = true

export type RepaymentEvent = {
  /** Added to the rate, in percentage points per annum. */
  spreadPctPoints: AnnualRatePct
  /** Months of clean conduct before the event stops binding. */
  coolingOffMonths: Months
  /** Whether new unsecured borrowing is available at all while it binds. */
  unsecuredAvailable: boolean
}

/**
 * CRD-10 to CRD-13 - Recent conduct, priced separately from the score.
 *
 * A bounce inside the last twelve months is more current than a score that
 * refreshes monthly, and it is the thing a borrower can actually fix on a
 * known timetable - which is what makes it an action (ACT-04) rather than a
 * verdict.
 */
export const REPAYMENT_EVENTS: Record<
  'one_bounce_12m' | 'two_to_three_bounces_12m' | 'four_plus_or_current_overdue' | 'settled_or_written_off',
  RepaymentEvent
> = {
  // CRD-10
  one_bounce_12m: {
    spreadPctPoints: pctPointsPerYear(1.0),
    coolingOffMonths: months(6),
    unsecuredAvailable: true,
  },
  // CRD-11
  two_to_three_bounces_12m: {
    spreadPctPoints: pctPointsPerYear(2.5),
    coolingOffMonths: months(6),
    unsecuredAvailable: true,
  },
  // CRD-12 - Hard stop. Nothing new until the existing account is regular.
  four_plus_or_current_overdue: {
    spreadPctPoints: pctPointsPerYear(0),
    coolingOffMonths: months(6),
    unsecuredAvailable: false,
  },
  // CRD-13
  settled_or_written_off: {
    spreadPctPoints: pctPointsPerYear(4.0),
    coolingOffMonths: months(24),
    unsecuredAvailable: false,
  },
}

/**
 * CRD-14 - What a clean month means, so that "six clean months" is a date
 * the borrower can put in a calendar rather than a figure of speech: a
 * calendar month with no bounced instrument and no account moving into
 * overdue, counted consecutively from the last such event.
 */
export const CLEAN_MONTH_DEFINITION = 'no_bounce_and_no_new_overdue_consecutive' as const

/**
 * CRD-15 - When a bureau score is present, an unstated bounce history is
 * taken as none.
 *
 * This is the one place a zero default is allowed to sit on the borrower's
 * side, and it is allowed because it does not flatter anybody: a bureau
 * score already prices delinquency, so assuming bounces on top of it would
 * charge the borrower twice for the same event. With no score present, the
 * unknown tier is already carrying the uncertainty.
 */
export const UNSTATED_BOUNCES_ASSUMED_ZERO_WHEN_SCORE_KNOWN = true

/* =====================================================================
 * AGE - Age at maturity, and the tenure it caps
 *
 * Age is not a scoring input here. It binds one thing - how long the loan
 * may run - and tenure then caps the amount that fits under any given EMI
 * ceiling. So this section reaches the headline number by a chain rather
 * than directly: age -> tenure -> maximum amount.
 * ===================================================================== */

/**
 * AGE-01 - Oldest the borrower may be when the last instalment falls due.
 *
 * Salaried borrowers are held to a retirement date because the income
 * stops on it. Self-employed borrowers are not, because nothing forces a
 * shopkeeper to stop at sixty. Informal salaried and daily-wage work is
 * capped earlier than formal employment: the work is physical, there is no
 * pension behind it, and earning capacity falls before the calendar says
 * it should.
 */
export const MAX_AGE_AT_MATURITY_BY_EMPLOYMENT: Record<EmploymentType, Years> = {
  salaried_formal: years(60),
  salaried_informal: years(58),
  self_employed_documented: years(65),
  self_employed_cash: years(65),
  daily_wage: years(58),
}

/**
 * AGE-02 - Product adjustment, in years. A secured long-tenure product is
 * underwritten against the asset as much as the earner, so lenders allow a
 * later maturity on LAP than on unsecured credit.
 */
export const AGE_AT_MATURITY_PRODUCT_DELTA_YEARS: Record<SupportedProduct, number> = {
  personal: 0,
  lap: 5,
  business_unsecured: 0,
  two_wheeler_ev: 0,
}

/** AGE-03 - Minimum age at which formal credit is realistically available. */
export const MIN_ENTRY_AGE_YEARS: Years = years(21)

/**
 * AGE-04 - How the cap is applied.
 *
 *   maxTenure = min(productMaxTenure, (maxAgeAtMaturity - age) * 12)
 *
 * If that falls below the product's minimum tenure, the product is not
 * available to this borrower at all rather than being offered at a tenure
 * no lender would write.
 */
export const AGE_TENURE_CAP = {
  method: 'min_of_product_max_and_years_to_maturity' as const,
  unavailableIfBelowProductMinimum: true,
}

/**
 * AGE-05 - A younger earning co-applicant may carry the maturity date,
 * because the loan can be serviced from their income after the main
 * applicant stops earning. This is the standard way an older borrower
 * reaches a longer tenure, and it is an action (ACT-07), not a loophole.
 */
export const CO_APPLICANT_MAY_EXTEND_MATURITY = true

/* =====================================================================
 * PUR - Purpose
 *
 * Purpose is what makes a wedding loan and a delivery-scooter loan reach
 * different verdicts at identical income, identical EMI and identical
 * stress. The scooter earns; the wedding does not. Leaving that to fall out
 * of the FOIR arithmetic would mean it never happens, because FOIR cannot
 * see the difference.
 * ===================================================================== */

export type PurposeRules = {
  /** May stated incremental earning be added to the safety income? */
  allowsIncomeOffset: boolean
  /** Of earning the borrower is already making from the same activity. */
  existingIncrementalRecognitionRatio: Ratio
  /** Of earning that has not started yet. Lower, because it is a forecast. */
  projectedIncrementalRecognitionRatio: Ratio
  /** Multiplier on the AFF-05 residual floor. Above 1.0 is a stricter test. */
  residualFloorMultiplier: Ratio
  /** Buffer months override, or null to use AFF-06. */
  bufferMonthsOverride: Months | null
  /** Added to the fair-rate ceiling before a quote is called expensive. */
  rateToleranceExtraPctPoints: AnnualRatePct
  /** Judged on the change in blended cost rather than on new debt (REF-*). */
  judgedOnBlendedCostChange: boolean
  /** The purchased asset may itself become security, changing the product. */
  mayChangeProductSet: boolean
  note: string
}

/** PUR-01 to PUR-05 - The taxonomy. */
export const PURPOSE_RULES: Record<LoanPurpose, PurposeRules> = {
  // PUR-01
  consumption: {
    allowsIncomeOffset: false,
    existingIncrementalRecognitionRatio: ratio(0),
    projectedIncrementalRecognitionRatio: ratio(0),
    residualFloorMultiplier: ratio(1.1),
    bufferMonthsOverride: null,
    rateToleranceExtraPctPoints: pctPointsPerYear(0),
    judgedOnBlendedCostChange: false,
    mayChangeProductSet: false,
    note: 'A wedding does not repay a loan. Nothing offsets the EMI, and the residual floor is held 10% higher because the borrower gets no new earning capacity in exchange for the obligation.',
  },
  // PUR-02
  productive: {
    allowsIncomeOffset: true,
    existingIncrementalRecognitionRatio: ratio(0.5),
    projectedIncrementalRecognitionRatio: ratio(0.25),
    residualFloorMultiplier: ratio(1.0),
    bufferMonthsOverride: null,
    rateToleranceExtraPctPoints: pctPointsPerYear(1.5),
    judgedOnBlendedCostChange: false,
    mayChangeProductSet: false,
    note: 'The asset earns. Half of earning already happening counts; a quarter of earning still forecast counts; none of it counts in the stress case (VRD-06).',
  },
  // PUR-03
  refinance: {
    allowsIncomeOffset: false,
    existingIncrementalRecognitionRatio: ratio(0),
    projectedIncrementalRecognitionRatio: ratio(0),
    residualFloorMultiplier: ratio(1.0),
    bufferMonthsOverride: null,
    rateToleranceExtraPctPoints: pctPointsPerYear(0),
    judgedOnBlendedCostChange: true,
    mayChangeProductSet: false,
    note: 'Not new debt. Judged on whether blended cost and monthly outflow fall, so the new-debt tests do not apply when outflow does not rise (REF-06).',
  },
  // PUR-04
  emergency: {
    allowsIncomeOffset: false,
    existingIncrementalRecognitionRatio: ratio(0),
    projectedIncrementalRecognitionRatio: ratio(0),
    residualFloorMultiplier: ratio(1.0),
    bufferMonthsOverride: months(1),
    rateToleranceExtraPctPoints: pctPointsPerYear(3.0),
    judgedOnBlendedCostChange: false,
    mayChangeProductSet: false,
    note: 'The buffer rule relaxes because the emergency is why the buffer is gone, and rate tolerance widens because speed has real value at a hospital counter. The safe-carry EMI test is not relaxed - the bill does not make the repayment affordable.',
  },
  // PUR-05
  asset_purchase: {
    allowsIncomeOffset: false,
    existingIncrementalRecognitionRatio: ratio(0),
    projectedIncrementalRecognitionRatio: ratio(0),
    residualFloorMultiplier: ratio(1.0),
    bufferMonthsOverride: null,
    rateToleranceExtraPctPoints: pctPointsPerYear(0),
    judgedOnBlendedCostChange: false,
    mayChangeProductSet: true,
    note: 'The thing being bought can secure the loan, which usually opens a cheaper product than the one the borrower came in asking for (RTE-03).',
  },
}

/**
 * PUR-06 - A productive loan that is also an asset purchase - the delivery
 * scooter - takes the productive income rules and the asset-purchase
 * product routing. Purpose is single-valued in the answers, so this records
 * which combination is legitimate rather than making the borrower choose.
 */
export const PRODUCTIVE_ASSET_PURCHASE_COMBINES_BOTH = true

/* =====================================================================
 * REF - Refinance and consolidation
 *
 * A borrower who should not add net new debt may still be much better off
 * restructuring what they already carry. That outcome has to be reachable
 * on its own terms - REF-09 - rather than being a consolation line under a
 * refusal. For a household paying 3% a month to a local lender, this
 * section is worth more than everything above it put together.
 * ===================================================================== */

/**
 * REF-01 - Above this all-in annual cost, existing borrowing is flagged as
 * a refinance candidate.
 *
 * 24% is where formal alternatives clearly win. Credit card revolving
 * balances and informal lending both sit well above it; bank and NBFC term
 * credit sits below. It is a threshold, not a cliff - the size of the gap
 * is what drives REF-06, not crossing the line.
 */
export const HIGH_COST_DEBT_THRESHOLD_ANNUAL_PCT: AnnualRatePct = pctPerYear(24)

/**
 * REF-02 - Informal debt is quoted per month and must be compounded, not
 * multiplied, before it can be compared with a bank rate.
 *
 *   effectiveAnnual = ((1 + monthlyPct/100) ^ 12 - 1) * 100
 *
 * 3% a month is 42.6% a year, not 36%. The naive multiplication understates
 * the cost of exactly the debt this section exists to find.
 */
export const MONTHLY_TO_ANNUAL_RATE_METHOD = 'compound' as const

/**
 * REF-03 - Blended cost of debt is the outstanding-weighted average of the
 * effective annual rates. Weighting by balance rather than by count stops a
 * small cheap loan from disguising a large expensive one.
 */
export const BLENDED_COST_WEIGHTING = 'by_outstanding_balance' as const

/**
 * REF-04 - What switching actually costs: the fee to close the old loan,
 * plus the fee to open the new one, plus GST on both, plus any valuation or
 * legal charge. A saving quoted without this is not a saving.
 */
export const SWITCHING_COST_COMPONENTS = [
  'foreclosure_fee_on_outstanding',
  'new_loan_processing_fee',
  'gst_on_both_fees',
  'new_loan_other_charges',
] as const

/**
 * REF-05 - Foreclosure fee assumed when the borrower does not know theirs.
 *
 * Floating-rate term loans to individual borrowers are not supposed to
 * carry foreclosure charges, so zero is the correct assumption there and it
 * is not a flattering one - it is the rule. Fixed-rate loans do carry them,
 * and the assumption there is deliberately at the top of the usual range.
 * Both are listed in OPEN_QUESTIONS.md.
 */
export const FORECLOSURE_FEE_DEFAULT_PCT: Record<'floating' | 'fixed', Percent> = {
  floating: pct(0),
  fixed: pct(4),
}

/** REF-06 - Break-even in months: switching cost divided by monthly saving. */
export const BREAK_EVEN_METHOD = 'switching_cost_over_monthly_saving' as const

/**
 * REF-07 - When a switch is worth making.
 *
 * Both tests must pass. The rate test stops churn for a saving that will be
 * eaten by the next fee; the break-even test stops a switch that only pays
 * back after the loan was going to end anyway.
 */
export const REFINANCE_WORTH_IT = {
  minBlendedRateReductionPctPoints: pctPointsPerYear(2.0),
  maxBreakEvenMonths: months(12),
  maxBreakEvenAsShareOfRemainingTenure: ratio(0.3),
}

/**
 * REF-08 - When there is a real saving but the break-even test fails, the
 * answer is not "stay". It is to take the competing quote back to the
 * existing lender, which costs nothing and has no break-even.
 */
export const RENEGOTIATE_WHEN_SAVING_EXISTS_BUT_BREAK_EVEN_FAILS = true

/**
 * REF-09 - Restructuring is reachable as an outcome in its own right.
 *
 * When the verdict is do_not_borrow and a refinance candidate exists, the
 * refinance result is what the app leads with. Telling a borrower paying
 * 42% a year that they cannot afford a new loan, without mentioning the 42%,
 * is a technically correct answer to the wrong question.
 */
export const SURFACE_REFINANCE_AS_PRIMARY_WHEN_DO_NOT_BORROW = true

/* =====================================================================
 * VRD - Verdict
 *
 * Two loads, each a ratio of the EMI being asked for to a ceiling:
 *
 *   safetyLoad      = requestedEmi / safeCarryEmi        (AFF-09)
 *   eligibilityLoad = requestedEmi / lenderEmiCeiling    (AFF-04)
 *
 * Both must clear 1.0. They fail for different reasons and produce
 * different advice, which is why they are never merged into one score.
 * ===================================================================== */

/**
 * VRD-01 - Cutoffs. Held at exactly 1.0 with no tolerance band: a 5%
 * indulgence here would quietly become the product's real answer, and it
 * would always be spent in the borrower's disfavour.
 */
export const VERDICT_CUTOFFS = {
  borrowMaxLoad: ratio(1.0),
  borrowLessMaxLoad: ratio(1.0),
}

/**
 * VRD-02 - borrow_less rather than do_not_borrow whenever some smaller
 * amount would clear both tests. The smallest amount worth arranging is the
 * product's minimum ticket, so that is the test: if safe carry services the
 * minimum ticket over the longest tenure available, there is a loan here.
 */
export const BORROW_LESS_REQUIRES_VIABLE_SMALLER_AMOUNT = true

/**
 * VRD-03 - The minimum viable EMI is derived, not stored: the EMI on the
 * product's minimum ticket at its longest available tenure and the midpoint
 * of the borrower's own rate band. Deriving it means a change to any of
 * those inputs moves this too.
 */
export const MIN_VIABLE_EMI_METHOD = 'min_ticket_at_max_tenure_at_mid_rate' as const

/**
 * VRD-04 - Conditions that produce do_not_borrow regardless of arithmetic.
 * Each one still has to produce actions (ACT-14).
 */
export const HARD_ELIGIBILITY_FAILS = [
  'current_overdue_on_existing_credit',
  'no_recognisable_income_for_any_product',
  'below_minimum_entry_age',
  'safe_carry_below_minimum_viable_emi_for_every_product',
] as const

/**
 * VRD-05 - Failing the stress test demotes the verdict by one step. It does
 * not zero it out: a loan that works today and breaks under a 20% income
 * drop is a smaller loan, not no loan.
 */
export const STRESS_FAILURE_DEMOTES_ONE_STEP = true

/**
 * VRD-06 - The productive-income ceiling.
 *
 * Incremental earning may lift borrow_less to borrow. It may never lift
 * do_not_borrow to borrow, because a household that cannot service the loan
 * from what it has now is betting the roof on a forecast. The stress case
 * recognises none of it (PUR-02), so a loan that only works with the
 * offset never reaches borrow.
 */
export const PRODUCTIVE_OFFSET_MAX_UPGRADE = 'one_step_and_never_from_do_not_borrow' as const

/**
 * VRD-07 - What the borrower must state for a productive offset to count:
 * what the asset earns, how many days a month it earns it, and whether that
 * earning is already happening or is forecast. Unstated means no offset -
 * the engine will not infer it from the purpose alone.
 */
export const PRODUCTIVE_OFFSET_REQUIRED_EVIDENCE = [
  'stated_incremental_earning_inr_per_month',
  'stated_earning_days_per_month',
  'stated_whether_already_earning_or_projected',
] as const

/**
 * VRD-08 - Incremental earning must clear the EMI with room to spare. An
 * asset that earns exactly its own instalment leaves the borrower working
 * for the lender and carrying all the risk of a slow month.
 */
export const PRODUCTIVE_MIN_COVERAGE_RATIO: Ratio = ratio(1.25)

/**
 * VRD-09 - A borrow_less verdict is not allowed to be a number-free
 * disappointment. It must name the amount that does pass.
 */
export const BORROW_LESS_MUST_STATE_PASSING_AMOUNT = true
