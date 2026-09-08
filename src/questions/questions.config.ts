/**
 * The question graph, as data.
 *
 * Nothing here renders. A question is an object describing what to ask, when
 * it applies, and what it would sharpen - and the interface later walks this
 * list rather than hard-coding a wizard. The point is that changing what the
 * app asks, or the order it asks in, is an edit to this file and to nothing
 * else.
 *
 * Two rules govern the set:
 *
 *   - The must-questions alone produce all four outputs. A borrower who
 *     answers ten questions and stops gets a complete assessment, wide bands
 *     and all, rather than a spinner.
 *   - Every additional question declares what it tightens, and the claim is
 *     tested (`npm run personas -- --tightens`). A question that moves no
 *     band is a question that wastes somebody's afternoon, and it is deleted
 *     rather than kept for completeness.
 *
 * `appliesWhen` is what stops the graph being a form. A salaried borrower is
 * never asked about GST returns or business vintage; somebody with no
 * property is never asked what it is worth.
 */

import { ASK_ABOUT_COLLATERAL_ABOVE_INR, type OutputId } from '../rules/rules.config'
import type { AnswerFieldId, BorrowerAnswers, EmploymentType, LoanPurpose, ProductType } from '../types'
import { readChoice, readNumeric } from '../engine/resolve'

export type InputType = 'number' | 'select' | 'range' | 'boolean' | 'currency'

export type Question = {
  /** The answer field this question fills. Ids are field ids, so a renamed
   *  field breaks the build rather than orphaning a question. */
  id: AnswerFieldId
  tier: 'must' | 'additional'
  prompt: string
  inputType: InputType
  /** Whether "I don't know" is offered. Never offered where a default would
   *  be a guess about the borrower rather than about their circumstances. */
  allowUnknown: boolean
  appliesWhen: (a: BorrowerAnswers) => boolean
  /** Which outputs this sharpens. Tested, not asserted. */
  tightens: OutputId[]
  /** One line, shown on demand. Answers "why are you asking me this?" */
  whyWeAsk: string
  /** Choices for a select. Not in the original schema, but a select without
   *  options is not a question. */
  options?: Array<{ value: string; label: string }>
  /** Placeholder or unit hint for a numeric input. */
  hint?: string
  /**
   * Set where this question is the gate for another. "Do you use credit
   * cards?" has to come before "how much is outstanding" or the gate is
   * pointless - the ordering hoists it (see `order.ts`).
   *
   * Note the gated question stays applicable to everyone rather than being
   * hidden behind the gate. Hiding it would mean answering the gate *widens*
   * the band, because a field that was not applicable suddenly becomes an
   * unanswered one. A "no" instead answers it outright via DEF-23.
   */
  gateFor?: AnswerFieldId
}

/* ------------------------------------------------------------------ *
 * Predicates
 *
 * Named rather than inline so the adaptive paths can be read as a list and
 * argued with. Each one answers: who should never see this question?
 * ------------------------------------------------------------------ */

const ALWAYS = () => true

const employment = (a: BorrowerAnswers) => readChoice<EmploymentType>(a, 'employmentType')
const purpose = (a: BorrowerAnswers) => readChoice<LoanPurpose>(a, 'loanPurpose')
const product = (a: BorrowerAnswers) => readChoice<ProductType>(a, 'productType')
const amountOf = (a: BorrowerAnswers, f: AnswerFieldId) => {
  const r = readNumeric(a, f, 'cost')
  return r?.stated ? r.underwriting : null
}

export const applies = {
  always: ALWAYS,

  /** Salaried people do not file business returns. */
  isSelfEmployed: (a: BorrowerAnswers) => {
    const e = employment(a)
    return e === 'self_employed_cash' || e === 'self_employed_documented'
  },

  /** Anyone whose pay is not a fixed monthly figure. */
  hasVariableIncome: (a: BorrowerAnswers) => {
    const e = employment(a)
    if (e === 'salaried_formal') return false
    const cash = a.cashIncomeMonthly
    const salary = a.salariedNetIncomeMonthly
    const statedAsRange =
      (cash !== undefined && 'range' in cash) || (salary !== undefined && 'range' in salary)
    return statedAsRange || e === 'daily_wage' || e === 'salaried_informal' || e === 'self_employed_cash'
  },

  /** Only ask what someone else earns once we know there is a someone else. */
  hasCoApplicant: (a: BorrowerAnswers) => readChoice<boolean>(a, 'hasCoApplicant') === true,

  /** Only ask about card balances of people who have cards. */
  hasCreditCards: (a: BorrowerAnswers) => readChoice<boolean>(a, 'hasCreditCards') === true,

  /** The rate and balance questions only make sense if a loan is running. */
  hasExistingLoan: (a: BorrowerAnswers) => {
    const emi = amountOf(a, 'existingEmiMonthly')
    return emi !== null && emi > 0
  },

  /**
   * Collateral is asked about when it is plausibly relevant: the borrower
   * named a secured product, runs a business that may own premises, or wants
   * more than unsecured lending realistically reaches. A salaried borrower
   * asking for three lakh is never asked what their property is worth.
   */
  mightHaveCollateral: (a: BorrowerAnswers) => {
    if (product(a) === 'lap') return true
    const e = employment(a)
    if (e === 'self_employed_cash' || e === 'self_employed_documented') return true
    const wanted = amountOf(a, 'requestedAmount')
    return wanted !== null && wanted > (ASK_ABOUT_COLLATERAL_ABOVE_INR as number)
  },

  /** The follow-ups only apply once a property is on the table. */
  hasStatedProperty: (a: BorrowerAnswers) => amountOf(a, 'propertyValue') !== null,

  /** Vehicle questions belong to people buying a vehicle. */
  isBuyingVehicle: (a: BorrowerAnswers) =>
    product(a) === 'two_wheeler_ev' || purpose(a) === 'asset_purchase',

  /** Incremental earning is only meaningful when the loan is meant to earn. */
  isProductive: (a: BorrowerAnswers) => {
    const pu = purpose(a)
    return pu === 'productive' || pu === 'asset_purchase'
  },

  /** The quote follow-ups need a quote to follow up on. */
  hasNamedLender: (a: BorrowerAnswers) => readChoice(a, 'lenderType') !== null,

  /** Only worth asking about bounces where there is a history to have them in. */
  mayHaveRepaymentHistory: (a: BorrowerAnswers) =>
    readChoice<boolean>(a, 'hasCreditHistory') !== false,
}

/* ------------------------------------------------------------------ *
 * The must-set
 *
 * Ten questions. These alone produce all four outputs - everything else in
 * the assessment falls back to a DEF-* default that announces itself.
 * ------------------------------------------------------------------ */

export const MUST_QUESTIONS: Question[] = [
  {
    id: 'loanPurpose',
    tier: 'must',
    prompt: 'What is the money for?',
    inputType: 'select',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['verdict', 'maxAmount', 'emiCeiling'],
    whyWeAsk:
      'A loan that earns you money is judged differently from one that does not. This changes the test we apply more than any other answer.',
    options: [
      { value: 'consumption', label: 'Spending — a wedding, a purchase, family costs' },
      { value: 'productive', label: 'Something that will earn me money' },
      { value: 'asset_purchase', label: 'Buying an asset — a vehicle, equipment' },
      { value: 'refinance', label: 'Replacing borrowing I already have' },
      { value: 'emergency', label: 'An emergency — medical, urgent' },
    ],
  },
  {
    id: 'productType',
    tier: 'must',
    prompt: 'What kind of loan do you think you need?',
    inputType: 'select',
    allowUnknown: true,
    appliesWhen: applies.always,
    tightens: ['fairRate', 'maxAmount'],
    whyWeAsk:
      'We will tell you if something else would be cheaper or larger — but we can only show you that comparison if we know what you came in for.',
    options: [
      { value: 'personal', label: 'Personal loan' },
      { value: 'business_unsecured', label: 'Business loan' },
      { value: 'lap', label: 'Loan against property' },
      { value: 'two_wheeler_ev', label: 'Two-wheeler loan' },
    ],
  },
  {
    id: 'requestedAmount',
    tier: 'must',
    prompt: 'How much do you want to borrow?',
    inputType: 'currency',
    allowUnknown: true,
    appliesWhen: applies.always,
    tightens: ['verdict', 'fairRate'],
    whyWeAsk:
      'Everything else is a comparison against this. If you are not sure, we will tell you what fits instead.',
    hint: '₹',
  },
  {
    id: 'employmentType',
    tier: 'must',
    prompt: 'How do you earn?',
    inputType: 'select',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['maxAmount', 'emiCeiling', 'fairRate'],
    whyWeAsk:
      'This decides how much of your income a lender will count, which drives every number here. We ask rather than assume, because assuming it would change too much.',
    options: [
      { value: 'salaried_formal', label: 'Salaried, with payslips' },
      { value: 'salaried_informal', label: 'Salaried, but no formal payslips' },
      { value: 'self_employed_documented', label: 'Self-employed, I file returns' },
      { value: 'self_employed_cash', label: 'Self-employed, mostly cash' },
      { value: 'daily_wage', label: 'Daily wage or gig work' },
    ],
  },
  {
    id: 'salariedNetIncomeMonthly',
    tier: 'must',
    prompt: 'What do you take home each month, after deductions?',
    inputType: 'currency',
    allowUnknown: false,
    appliesWhen: (a) => !applies.isSelfEmployed(a) && employment(a) !== 'daily_wage',
    tightens: ['maxAmount', 'emiCeiling'],
    whyWeAsk: 'Take-home pay, not gross. Lenders work from what actually reaches you.',
    hint: '₹ per month',
  },
  {
    id: 'cashIncomeMonthly',
    tier: 'must',
    prompt: 'What does the work bring in each month?',
    inputType: 'range',
    allowUnknown: false,
    appliesWhen: (a) => applies.isSelfEmployed(a) || employment(a) === 'daily_wage',
    tightens: ['maxAmount', 'emiCeiling'],
    whyWeAsk:
      'A range is fine and more useful than a single figure — we treat the two ends differently on purpose.',
    hint: '₹ per month',
  },
  {
    id: 'age',
    tier: 'must',
    prompt: 'How old are you?',
    inputType: 'number',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['maxAmount', 'emiCeiling'],
    whyWeAsk:
      'Not a formality. The loan has to finish before you stop earning, which caps the term — and a shorter term means a larger instalment and a smaller loan.',
    hint: 'years',
  },
  {
    id: 'existingEmiMonthly',
    tier: 'must',
    prompt: 'What do you already pay each month towards loans?',
    inputType: 'currency',
    allowUnknown: true,
    appliesWhen: applies.always,
    tightens: ['maxAmount', 'emiCeiling', 'verdict'],
    whyWeAsk:
      'If you do not tell us, we assume a figure rather than nothing — an unstated instalment is the fastest way to look more affordable than you are.',
    hint: '₹ per month, 0 if none',
  },
  {
    id: 'householdExpensesMonthly',
    tier: 'must',
    prompt: 'What does your household spend in a month, excluding rent?',
    inputType: 'currency',
    allowUnknown: true,
    appliesWhen: applies.always,
    tightens: ['emiCeiling', 'maxAmount', 'verdict'],
    whyWeAsk:
      'This is the difference between what a lender will give you and what you can actually carry. A rough figure is far better than none.',
    hint: '₹ per month',
  },
  {
    id: 'creditScore',
    tier: 'must',
    prompt: 'Do you know your credit score?',
    inputType: 'number',
    allowUnknown: true,
    appliesWhen: applies.always,
    tightens: ['fairRate', 'maxAmount'],
    whyWeAsk:
      '"I do not know" is a real answer and we handle it properly — your rate range simply stays wide until somebody looks. Checking is free.',
    hint: '300–900',
  },
]

/* ------------------------------------------------------------------ *
 * Additional questions
 *
 * Ordered here by rough usefulness, but the interface does not use this
 * order - it asks whichever applicable question would tighten the current
 * result most (see `order.ts`). Every entry's `tightens` claim is verified
 * by the --tightens run.
 * ------------------------------------------------------------------ */

export const ADDITIONAL_QUESTIONS: Question[] = [
  {
    id: 'incomeProof',
    tier: 'additional',
    prompt: 'What can you show a lender to prove your income?',
    inputType: 'select',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['maxAmount', 'emiCeiling', 'fairRate'],
    whyWeAsk:
      'The single biggest lever on what you will be offered. The same income with paperwork and without it produces very different numbers.',
    options: [
      { value: 'salary_slips', label: 'Payslips' },
      { value: 'itr', label: 'Income tax return' },
      { value: 'gst_returns', label: 'GST returns' },
      { value: 'bank_statements_only', label: 'Bank statements only' },
      { value: 'none', label: 'Nothing I can produce' },
    ],
  },
  {
    id: 'guaranteedIncomeMonthly',
    tier: 'additional',
    prompt: 'Of that, how much comes in even in a bad month?',
    inputType: 'currency',
    allowUnknown: false,
    appliesWhen: applies.hasVariableIncome,
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk:
      'Otherwise we have to guess where the bottom of your range is. You know, and your answer replaces our guess.',
    hint: '₹ per month',
  },
  {
    id: 'itrIncomeAnnual',
    tier: 'additional',
    prompt: 'What income does your last filed return show?',
    inputType: 'currency',
    allowUnknown: true,
    appliesWhen: applies.isSelfEmployed,
    tightens: ['maxAmount', 'emiCeiling'],
    whyWeAsk:
      'A lender cannot count more than you have declared, so this often sets the ceiling — even where the business takes more.',
    hint: '₹ per year',
  },
  {
    id: 'timeInCurrentWork',
    tier: 'additional',
    prompt: 'How long have you been earning this way?',
    inputType: 'number',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['fairRate', 'maxAmount'],
    whyWeAsk:
      'Where there is no credit score, how long the income has held up is the main thing a lender has to go on instead.',
    hint: 'months',
  },
  {
    id: 'incomeStability',
    tier: 'additional',
    prompt: 'How steady is your income month to month?',
    inputType: 'select',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk: 'This sets how hard we stress-test the instalment against a bad stretch.',
    options: [
      { value: 'stable', label: 'About the same every month' },
      { value: 'seasonal', label: 'Busy and quiet seasons' },
      { value: 'volatile', label: 'Varies a lot, hard to predict' },
    ],
  },
  {
    id: 'hasCoApplicant',
    tier: 'additional',
    prompt: 'Is there someone in the household who also earns and could apply with you?',
    inputType: 'boolean',
    allowUnknown: false,
    appliesWhen: applies.always,
    gateFor: 'coApplicantIncomeMonthly',
    tightens: ['maxAmount', 'emiCeiling'],
    whyWeAsk:
      'Adding an earning co-applicant usually raises what a lender will offer more than anything else you can do quickly.',
  },
  {
    id: 'coApplicantIncomeMonthly',
    tier: 'additional',
    prompt: 'What do they earn each month?',
    inputType: 'currency',
    allowUnknown: false,
    appliesWhen: applies.hasCoApplicant,
    tightens: ['maxAmount', 'emiCeiling'],
    whyWeAsk:
      'It counts towards what your household can carry either way. Whether it counts towards what a lender will lend depends on the next question.',
    hint: '₹ per month',
  },
  {
    id: 'coApplicantIncomeProof',
    tier: 'additional',
    prompt: 'Can they prove that income on paper?',
    inputType: 'select',
    allowUnknown: false,
    appliesWhen: applies.hasCoApplicant,
    tightens: ['maxAmount'],
    whyWeAsk:
      'Undocumented income still feeds your household. It does not feed the lender calculation, and the gap is worth seeing.',
    options: [
      { value: 'salary_slips', label: 'Payslips' },
      { value: 'itr', label: 'Income tax return' },
      { value: 'bank_statements_only', label: 'Bank statements only' },
      { value: 'none', label: 'Nothing on paper' },
    ],
  },
  {
    id: 'existingLoanOutstanding',
    tier: 'additional',
    prompt: 'How much is still outstanding on that borrowing?',
    inputType: 'currency',
    allowUnknown: true,
    appliesWhen: applies.hasExistingLoan,
    tightens: ['maxAmount', 'emiCeiling'],
    whyWeAsk:
      'The monthly figure alone does not tell us whether it ends next year or in ten. The balance does.',
    hint: '₹',
  },
  {
    id: 'existingLoanRate',
    tier: 'additional',
    prompt: 'What rate are you paying on it?',
    inputType: 'number',
    allowUnknown: true,
    appliesWhen: applies.hasExistingLoan,
    tightens: ['fairRate'],
    whyWeAsk:
      'Without the rate we cannot tell you whether replacing it would save you money — which is sometimes worth more than the new loan.',
    hint: '% per year',
  },
  {
    id: 'informalDebtOutstanding',
    tier: 'additional',
    prompt: 'Do you owe money outside the banking system — a local lender, a chit, family?',
    inputType: 'currency',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk:
      'This is usually the most expensive money in the household and the first thing worth dealing with. Nothing here is reported anywhere.',
    hint: '₹, 0 if none',
  },
  {
    id: 'informalDebtRateMonthly',
    tier: 'additional',
    prompt: 'What do you pay on it each month, as a percentage?',
    inputType: 'number',
    allowUnknown: true,
    appliesWhen: (a) => (amountOf(a, 'informalDebtOutstanding') ?? 0) > 0,
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk:
      'Rates like this are quoted monthly and compound into something much larger than they sound. We convert it properly.',
    hint: '% per month',
  },
  {
    id: 'hasCreditCards',
    tier: 'additional',
    prompt: 'Do you use credit cards?',
    inputType: 'boolean',
    allowUnknown: false,
    appliesWhen: applies.always,
    gateFor: 'creditCardOutstanding',
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk:
      'A "no" here is genuinely useful — it removes an assumption we would otherwise have to carry.',
  },
  {
    id: 'creditCardOutstanding',
    tier: 'additional',
    prompt: 'How much is outstanding across your cards?',
    inputType: 'currency',
    allowUnknown: true,
    // Reachable by everyone, but a borrower who answered "no cards" never
    // sees it: DEF-23 has already filled it in for them. Gating it on the
    // predicate instead would make the gate question itself pointless,
    // because a "no" would remove the follow-up rather than answer it.
    appliesWhen: applies.always,
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk:
      'A balance you carry from month to month on a card costs about as much as a moneylender, and is just as worth clearing first.',
    hint: '₹',
  },
  {
    id: 'upcomingExpenses12m',
    tier: 'additional',
    prompt: 'Is there anything big you already know is coming in the next year?',
    inputType: 'currency',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk:
      'A school fee, a wedding, a repair. Instalments tend to break in the month that was always going to be difficult.',
    hint: '₹ total, 0 if none',
  },
  {
    id: 'savingsBuffer',
    tier: 'additional',
    prompt: 'How much do you have set aside for emergencies?',
    inputType: 'currency',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk:
      'One month of cover is the difference between a bad month being awkward and it becoming a missed payment.',
    hint: '₹',
  },
  {
    id: 'dependents',
    tier: 'additional',
    prompt: 'How many people depend on your income?',
    inputType: 'number',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk: 'It sets how much has to be left over each month before an instalment is safe.',
    hint: 'people, not counting yourself',
  },
  {
    id: 'rentMonthly',
    tier: 'additional',
    prompt: 'What rent do you pay?',
    inputType: 'currency',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk: 'Rent comes out before anything else, so we keep it separate from other spending.',
    hint: '₹ per month, 0 if you own',
  },
  {
    id: 'cityTier',
    tier: 'additional',
    prompt: 'Where do you live?',
    inputType: 'select',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['emiCeiling', 'maxAmount'],
    whyWeAsk: 'Cost of living differs enough to change what is left over after an instalment.',
    options: [
      { value: 'metro', label: 'A metro' },
      { value: 'tier2', label: 'A large town or small city' },
      { value: 'tier3', label: 'A smaller town' },
      { value: 'rural', label: 'A village or rural area' },
    ],
  },
  {
    id: 'lenderType',
    tier: 'additional',
    prompt: 'Has anyone already quoted you a loan?',
    inputType: 'select',
    allowUnknown: false,
    appliesWhen: applies.always,
    tightens: ['fairRate'],
    whyWeAsk:
      'Who is offering matters as much as your own file. The same borrower is priced very differently by a public sector bank and by an app.',
    options: [
      { value: 'psu_bank', label: 'A public sector bank' },
      { value: 'private_bank', label: 'A private bank' },
      { value: 'nbfc', label: 'An NBFC or finance company' },
      { value: 'fintech', label: 'An app or online lender' },
    ],
  },
  {
    id: 'quotedRate',
    tier: 'additional',
    prompt: 'What rate did they quote?',
    inputType: 'number',
    allowUnknown: true,
    appliesWhen: applies.hasNamedLender,
    tightens: ['fairRate'],
    whyWeAsk: 'So we can tell you whether it is a fair price for someone in your position.',
    hint: '% per year',
  },
  {
    id: 'quotedProcessingFee',
    tier: 'additional',
    prompt: 'What processing fee did they mention?',
    inputType: 'number',
    allowUnknown: true,
    appliesWhen: applies.hasNamedLender,
    tightens: ['fairRate'],
    whyWeAsk:
      '"I do not know" is fine and common — we will assume the top of the usual range and say so.',
    hint: '% of the loan',
  },
  {
    id: 'incrementalEarningMonthly',
    tier: 'additional',
    prompt: 'How much extra do you expect this to earn you each month?',
    inputType: 'currency',
    allowUnknown: false,
    appliesWhen: applies.isProductive,
    tightens: ['verdict'],
    whyWeAsk:
      'We will not assume a loan earns anything just because you told us it is for business. If it earns, tell us how much.',
    hint: '₹ per month',
  },
  {
    id: 'incrementalEarningAlreadyHappening',
    tier: 'additional',
    prompt: 'Is that money already coming in, or is it what you expect?',
    inputType: 'boolean',
    allowUnknown: false,
    appliesWhen: applies.isProductive,
    tightens: ['verdict'],
    whyWeAsk:
      'Earning you can already see counts for twice as much as earning you are forecasting. Neither counts in the bad case.',
  },
  {
    id: 'repaymentHistory',
    tier: 'additional',
    prompt: 'How have your repayments gone?',
    inputType: 'select',
    allowUnknown: false,
    appliesWhen: applies.mayHaveRepaymentHistory,
    tightens: ['fairRate', 'verdict'],
    whyWeAsk:
      'Recent conduct is more current than a score, and it is the part you can fix on a known timetable.',
    options: [
      { value: 'clean', label: 'All on time' },
      { value: 'none', label: 'I have not borrowed before' },
      { value: 'settled', label: 'I settled or wrote off a loan once' },
      { value: 'current_overdue', label: 'Something is overdue right now' },
    ],
  },
  {
    id: 'bouncedEmisLast12m',
    tier: 'additional',
    prompt: 'Any bounced payments in the last year?',
    inputType: 'number',
    allowUnknown: false,
    appliesWhen: applies.mayHaveRepaymentHistory,
    tightens: ['fairRate'],
    whyWeAsk:
      'It adds to your rate now and comes off after a set number of clean months, so it is worth knowing the date.',
    hint: 'how many',
  },
  {
    id: 'propertyValue',
    tier: 'additional',
    prompt: 'Do you own property? Roughly what is it worth?',
    inputType: 'currency',
    allowUnknown: true,
    appliesWhen: applies.mightHaveCollateral,
    tightens: ['maxAmount', 'fairRate'],
    whyWeAsk:
      'Property usually opens a much cheaper and much larger loan than an unsecured one — with a real trade-off we will spell out.',
    hint: '₹',
  },
  {
    id: 'propertyKind',
    tier: 'additional',
    prompt: 'Is it where you live, or business premises?',
    inputType: 'select',
    allowUnknown: false,
    appliesWhen: applies.hasStatedProperty,
    tightens: ['maxAmount'],
    whyWeAsk: 'Lenders advance less against commercial property than against a home.',
    options: [
      { value: 'residential', label: 'Where I live' },
      { value: 'commercial', label: 'A shop or business premises' },
    ],
  },
  {
    id: 'propertyTitleClear',
    tier: 'additional',
    prompt: 'Is the title clear, with no existing loan against it?',
    inputType: 'boolean',
    allowUnknown: true,
    appliesWhen: applies.hasStatedProperty,
    tightens: ['maxAmount', 'fairRate'],
    whyWeAsk:
      'Until this is confirmed we hold the cheaper secured option back, because a lender would.',
  },
  {
    id: 'vehicleOnRoadPrice',
    tier: 'additional',
    prompt: 'What is the on-road price of the vehicle?',
    inputType: 'currency',
    allowUnknown: false,
    appliesWhen: applies.isBuyingVehicle,
    tightens: ['maxAmount'],
    whyWeAsk: 'The loan is capped at a share of this, whatever your income says.',
    hint: '₹',
  },
  {
    id: 'downPaymentAvailable',
    tier: 'additional',
    prompt: 'How much can you put down yourself?',
    inputType: 'currency',
    allowUnknown: false,
    appliesWhen: applies.isBuyingVehicle,
    tightens: ['maxAmount'],
    whyWeAsk: 'A larger deposit means a smaller loan and usually a better rate.',
    hint: '₹',
  },
]

export const ALL_QUESTIONS: Question[] = [...MUST_QUESTIONS, ...ADDITIONAL_QUESTIONS]

/** The must-set, for anyone who needs to know what the minimum path is. */
export const MUST_FIELDS: AnswerFieldId[] = MUST_QUESTIONS.map((q) => q.id)

/** Questions that apply to this borrower, whether or not they are answered. */
export function applicableQuestions(answers: BorrowerAnswers, list = ALL_QUESTIONS): Question[] {
  return list.filter((q) => q.appliesWhen(answers))
}
