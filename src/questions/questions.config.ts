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
 *     tested. A question that moves no band is a question that wastes
 *     somebody's afternoon, and it is deleted rather than kept.
 */

import type { OutputId } from '../rules/rules.config'
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
    return wanted !== null && wanted > 500_000
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
    appliesWhen: applies.always,
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
    appliesWhen: applies.always,
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

export const ADDITIONAL_QUESTIONS: Question[] = []

export const ALL_QUESTIONS: Question[] = [...MUST_QUESTIONS, ...ADDITIONAL_QUESTIONS]

/** The must-set, for anyone who needs to know what the minimum path is. */
export const MUST_FIELDS: AnswerFieldId[] = MUST_QUESTIONS.map((q) => q.id)

/** Questions that apply to this borrower, whether or not they are answered. */
export function applicableQuestions(answers: BorrowerAnswers, list = ALL_QUESTIONS): Question[] {
  return list.filter((q) => q.appliesWhen(answers))
}
