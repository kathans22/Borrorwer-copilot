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

/**
 * A numeric answer, which may also be a range.
 *
 * Borrowers state incomes as ranges - "twenty-six to thirty thousand" - and
 * the two views collapse that range to different points (INC-05): the lender
 * view averages, the safety view takes the bad month. A single `value` cannot
 * express the question, so numeric fields carry this instead of `Answer`.
 */
export type NumericAnswer<T extends number> =
  | { value: T }
  | { range: Band<T> }
  | { unknown: true }

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

/** A shop is lent against more conservatively than a home (PRD-05). */
export type PropertyKind = 'residential' | 'commercial'

/**
 * Every answer the borrower can give. All fields optional: a part-finished
 * assessment is the normal state, not an error state.
 */
export type BorrowerAnswers = {
  /* What they are asking for */
  productType?: Answer<ProductType>
  loanPurpose?: Answer<LoanPurpose>
  requestedAmount?: NumericAnswer<Rupees>
  requestedTenure?: NumericAnswer<Months>

  /* Who they are */
  age?: NumericAnswer<Years>
  cityTier?: Answer<CityTier>
  dependents?: NumericAnswer<Count>
  employmentType?: Answer<EmploymentType>
  timeInCurrentWork?: NumericAnswer<Months>

  /* What they earn - note the differing units */
  salariedNetIncomeMonthly?: NumericAnswer<RupeesPerMonth>
  cashIncomeMonthly?: NumericAnswer<RupeesPerMonth>
  itrIncomeAnnual?: NumericAnswer<RupeesPerYear>
  bankCreditsMonthly?: NumericAnswer<RupeesPerMonth>
  /** The portion the borrower is sure of, whatever the good months look like. */
  guaranteedIncomeMonthly?: NumericAnswer<RupeesPerMonth>
  incomeProof?: Answer<IncomeProofType>
  incomeStability?: Answer<IncomeStability>

  /* Co-applicant */
  hasCoApplicant?: Answer<boolean>
  coApplicantIncomeMonthly?: NumericAnswer<RupeesPerMonth>
  coApplicantIncomeProof?: Answer<IncomeProofType>
  coApplicantEmploymentType?: Answer<EmploymentType>

  /* What they already owe */
  existingEmiMonthly?: NumericAnswer<RupeesPerMonth>
  hasCreditCards?: Answer<boolean>
  creditCardOutstanding?: NumericAnswer<Rupees>
  /** A known lump coming in the next year - a wedding, a fee, a repair. */
  upcomingExpenses12m?: NumericAnswer<Rupees>
  informalDebtOutstanding?: NumericAnswer<Rupees>
  informalDebtRateMonthly?: NumericAnswer<MonthlyRatePct>
  householdExpensesMonthly?: NumericAnswer<RupeesPerMonth>
  rentMonthly?: NumericAnswer<RupeesPerMonth>
  savingsBuffer?: NumericAnswer<Rupees>

  /* Credit standing */
  creditScore?: NumericAnswer<CreditScore>
  hasCreditHistory?: Answer<boolean>
  repaymentHistory?: Answer<RepaymentHistory>
  bouncedEmisLast12m?: NumericAnswer<Count>

  /* Security offered */
  propertyValue?: NumericAnswer<Rupees>
  propertyKind?: Answer<PropertyKind>
  propertyTitleClear?: Answer<boolean>
  goldWeight?: NumericAnswer<Grams>
  goldPurity?: NumericAnswer<Karat>
  vehicleOnRoadPrice?: NumericAnswer<Rupees>
  downPaymentAvailable?: NumericAnswer<Rupees>

  /* What the loan itself would earn, where it earns (PUR-02, VRD-07) */
  incrementalEarningMonthly?: NumericAnswer<RupeesPerMonth>
  incrementalEarningDaysPerMonth?: NumericAnswer<Count>
  incrementalEarningAlreadyHappening?: Answer<boolean>

  /* What a lender has already offered them */
  lenderType?: Answer<LenderType>
  quotedRate?: NumericAnswer<AnnualRatePct>
  quotedProcessingFee?: NumericAnswer<Percent>
  quotedTenure?: NumericAnswer<Months>

  /* The loan they may be refinancing */
  existingLoanOutstanding?: NumericAnswer<Rupees>
  existingLoanRate?: NumericAnswer<AnnualRatePct>
  existingLoanEmi?: NumericAnswer<RupeesPerMonth>
  existingLoanRemainingTenure?: NumericAnswer<Months>
  existingLoanForeclosureFee?: NumericAnswer<Percent>
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

/* ------------------------------------------------------------------ *
 * The result contract
 * ------------------------------------------------------------------ */

/**
 * The headline answer. Deliberately three-valued: "borrow less" is the most
 * common honest answer and collapsing it into yes/no is what makes generic
 * eligibility tools useless to a borrower.
 */
export type VerdictValue = 'borrow' | 'borrow_less' | 'do_not_borrow'

/**
 * Something the borrower can actually do next.
 *
 * `changesWhat` names the effect on their own result, not a generic tip, so
 * an action is only worth listing if the engine can say what it moves.
 */
export type ActionStep = {
  text: string
  changesWhat: string
  timeframe: 'today' | 'weeks' | 'months'
}

/** Whether to move the loan, stay put, or push the current lender. */
export type RefinanceVerdict = 'refinance' | 'stay' | 'renegotiate_existing'

/**
 * Only produced when the borrower already has a loan to compare against.
 * Savings are meaningless without the switching cost that buys them, so both
 * are reported, along with how long the borrower waits to break even.
 */
export type RefinanceResult = {
  worthIt: CategoricalOutput<RefinanceVerdict>
  monthlySaving: NumericOutput<RupeesPerMonth>
  totalSavingOverTenure: NumericOutput<Rupees>
  switchingCost: NumericOutput<Rupees>
  breakEven: NumericOutput<Months>
}

/**
 * Everything the engine produces from one set of answers.
 *
 * `maxAmount` holds two different numbers on purpose. What a lender will
 * likely sanction and what the borrower can safely carry are not the same
 * figure, and the gap between them is the point of this tool. `useWhich`
 * records which one the app leads with, and why.
 */
export type CopilotResult = {
  verdict: CategoricalOutput<VerdictValue>
  maxAmount: {
    lenderLikely: NumericOutput<Rupees>
    borrowerSafe: NumericOutput<Rupees>
    useWhich: 'lenderLikely' | 'borrowerSafe'
    useWhichReason: Reason
  }
  fairRate: NumericOutput<AnnualRatePct>
  emiCeiling: NumericOutput<RupeesPerMonth>
  refinance: RefinanceResult | null
  actions: ActionStep[]
}
