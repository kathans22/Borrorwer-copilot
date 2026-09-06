/**
 * The type contract for Borrower Copilot.
 *
 * Two rules hold everywhere in this file:
 *
 *  1. No number travels without its unit. Money, rates and durations are
 *     branded, so `RupeesPerMonth` cannot be passed where `RupeesPerYear` is
 *     expected. An ITR figure is annual; cash income is monthly; a moneylender
 *     quotes per month and a bank per year. Those four facts are the most
 *     likely source of a silent arithmetic bug in this codebase, so the
 *     compiler is made to care about them.
 *
 *  2. No number leaves the engine bare. Every output carries a band, a
 *     confidence and the reasons that produced it. There is deliberately no
 *     shape in this system that returns a lone figure.
 */

/* ------------------------------------------------------------------ *
 * Units
 * ------------------------------------------------------------------ */

declare const brand: unique symbol

/** Attaches a compile-time-only tag to a primitive. Erased at runtime. */
type Brand<T, B extends string> = T & { readonly [brand]: B }

/** A rupee amount at a point in time - a balance, a price, a principal. */
export type Rupees = Brand<number, 'Rupees'>
/** A rupee amount per month - income, EMI, expenses. */
export type RupeesPerMonth = Brand<number, 'RupeesPerMonth'>
/** A rupee amount per year - ITR income, annual turnover. */
export type RupeesPerYear = Brand<number, 'RupeesPerYear'>

/** An interest rate quoted per annum, as a percentage. Banks quote this. */
export type AnnualRatePct = Brand<number, 'AnnualRatePct'>
/** An interest rate quoted per month, as a percentage. Moneylenders quote this. */
export type MonthlyRatePct = Brand<number, 'MonthlyRatePct'>
/** A percentage that is not an interest rate - a fee, a haircut, a margin. */
export type Percent = Brand<number, 'Percent'>
/** A dimensionless 0-1 ratio - LTV, FOIR, utilisation. */
export type Ratio = Brand<number, 'Ratio'>

export type Months = Brand<number, 'Months'>
export type Years = Brand<number, 'Years'>
/** A plain count of things - dependents, bounced EMIs. */
export type Count = Brand<number, 'Count'>

export type Grams = Brand<number, 'Grams'>
export type Karat = Brand<number, 'Karat'>
/** A bureau score. Branded so it is never mistaken for money. */
export type CreditScore = Brand<number, 'CreditScore'>

/* ------------------------------------------------------------------ *
 * Answers
 * ------------------------------------------------------------------ */

/**
 * A borrower's response to one question.
 *
 * "I do not know" is a first-class answer, not a missing field. The engine
 * treats an explicit `unknown` differently from an unasked question: the first
 * widens a band and lowers confidence, the second is simply not yet reached.
 */
export type Answer<T> = { value: T } | { unknown: true }

export type ProductType =
  | 'personal'
  | 'lap'
  | 'business_unsecured'
  | 'two_wheeler_ev'
  | 'gold'

export type LoanPurpose =
  | 'consumption'
  | 'productive'
  | 'refinance'
  | 'emergency'
  | 'asset_purchase'

/** Spreads differ materially by lender type for the same borrower. */
export type LenderType = 'psu_bank' | 'private_bank' | 'nbfc' | 'fintech'

export type EmploymentType =
  | 'salaried_formal'
  | 'salaried_informal'
  | 'self_employed_documented'
  | 'self_employed_cash'
  | 'daily_wage'

/** What the borrower can actually put in front of a lender. */
export type IncomeProofType =
  | 'salary_slips'
  | 'itr'
  | 'bank_statements_only'
  | 'gst_returns'
  | 'none'

export type IncomeStability = 'stable' | 'seasonal' | 'volatile'

export type CityTier = 'metro' | 'tier2' | 'tier3' | 'rural'

export type RepaymentHistory = 'none' | 'clean' | 'settled' | 'current_overdue'

/**
 * Every answer the borrower can give. All fields optional: a part-finished
 * assessment is the normal state, not an error state.
 */
export type BorrowerAnswers = {
  /* What they are asking for */
  productType?: Answer<ProductType>
  loanPurpose?: Answer<LoanPurpose>
  requestedAmount?: Answer<Rupees>
  requestedTenure?: Answer<Months>

  /* Who they are */
  age?: Answer<Years>
  cityTier?: Answer<CityTier>
  dependents?: Answer<Count>
  employmentType?: Answer<EmploymentType>
  timeInCurrentWork?: Answer<Months>

  /* What they earn - note the differing units */
  salariedNetIncomeMonthly?: Answer<RupeesPerMonth>
  cashIncomeMonthly?: Answer<RupeesPerMonth>
  itrIncomeAnnual?: Answer<RupeesPerYear>
  bankCreditsMonthly?: Answer<RupeesPerMonth>
  incomeProof?: Answer<IncomeProofType>
  incomeStability?: Answer<IncomeStability>

  /* Co-applicant */
  hasCoApplicant?: Answer<boolean>
  coApplicantIncomeMonthly?: Answer<RupeesPerMonth>
  coApplicantIncomeProof?: Answer<IncomeProofType>

  /* What they already owe */
  existingEmiMonthly?: Answer<RupeesPerMonth>
  creditCardOutstanding?: Answer<Rupees>
  informalDebtOutstanding?: Answer<Rupees>
  informalDebtRateMonthly?: Answer<MonthlyRatePct>
  householdExpensesMonthly?: Answer<RupeesPerMonth>
  rentMonthly?: Answer<RupeesPerMonth>
  savingsBuffer?: Answer<Rupees>

  /* Credit standing */
  creditScore?: Answer<CreditScore>
  hasCreditHistory?: Answer<boolean>
  repaymentHistory?: Answer<RepaymentHistory>
  bouncedEmisLast12m?: Answer<Count>

  /* Security offered */
  propertyValue?: Answer<Rupees>
  propertyTitleClear?: Answer<boolean>
  goldWeight?: Answer<Grams>
  goldPurity?: Answer<Karat>
  vehicleOnRoadPrice?: Answer<Rupees>
  downPaymentAvailable?: Answer<Rupees>

  /* What a lender has already offered them */
  lenderType?: Answer<LenderType>
  quotedRate?: Answer<AnnualRatePct>
  quotedProcessingFee?: Answer<Percent>
  quotedTenure?: Answer<Months>

  /* The loan they may be refinancing */
  existingLoanOutstanding?: Answer<Rupees>
  existingLoanRate?: Answer<AnnualRatePct>
  existingLoanEmi?: Answer<RupeesPerMonth>
  existingLoanRemainingTenure?: Answer<Months>
  existingLoanForeclosureFee?: Answer<Percent>
}

/**
 * The id of a single answer field. Reasons and narrowing hints are typed
 * against this rather than `string`, so a renamed question breaks the build
 * instead of silently orphaning an explanation.
 */
export type AnswerFieldId = keyof BorrowerAnswers

/* ------------------------------------------------------------------ *
 * Output primitives
 * ------------------------------------------------------------------ */

/**
 * A range, in the unit `U`. The engine reports ranges rather than points
 * because a borrower's true position is never known to the rupee.
 */
export type Band<U extends number = number> = { low: U; high: U }

/** How much the engine trusts a result, given what it was told. */
export type Confidence = 'low' | 'medium' | 'high'

/**
 * One plain-language explanation, tied to the answers that caused it.
 * `drivenBy` is what makes a result auditable: change a listed answer and
 * this reason should change or disappear.
 */
export type Reason = { text: string; drivenBy: AnswerFieldId[] }

/**
 * A number the engine produced. Never a bare figure: it carries its range,
 * how confident the engine is, why it landed there, and which unanswered
 * questions would tighten it.
 */
export type NumericOutput<U extends number = number> = {
  band: Band<U>
  confidence: Confidence
  reasons: Reason[]
  wouldNarrow: AnswerFieldId[]
}

/**
 * A non-numeric result - a verdict, a yes/no. Carries the same explanation
 * and confidence as a number, but no band, because a range over a categorical
 * value is meaningless.
 */
export type CategoricalOutput<T> = {
  value: T
  confidence: Confidence
  reasons: Reason[]
  wouldNarrow: AnswerFieldId[]
}
