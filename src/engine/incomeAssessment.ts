/**
 * Two incomes from one set of answers.
 *
 *   recognised (lender view)  - what an underwriter will count. Driven by the
 *                               proof on the table, capped by how the income
 *                               is earned, and capped again by anything the
 *                               borrower has declared on a return.
 *   reliable (safety view)    - what the household actually receives and
 *                               repays from, documented or not.
 *
 * For a salaried borrower with slips these are close to identical. For a
 * shopkeeper paid in cash, or a household whose second earner has no
 * paperwork, they are not remotely the same number, and every later module
 * depends on keeping them apart.
 */

import {
  CO_APPLICANT,
  EMPLOYMENT_RECOGNITION_CAP_RATIO,
  INCOME_PROOF_RECOGNITION_RATIO,
  PROOF_FALLBACK_WITHOUT_FIGURE,
  PROOF_REQUIRES_ITS_FIGURE,
  SAFETY_VIEW_RECOGNITION_RATIO,
  type ConstraintId,
} from '../rules/rules.config'
import type {
  AnswerFieldId,
  BorrowerAnswers,
  EmploymentType,
  IncomeProofType,
  IncomeStability,
  Reason,
} from '../types'
import { percent, reason, rupees } from './format'
import { annualToMonthly } from './money'
import { readChoice, readNumeric } from './resolve'

export type IncomeAssessment = {
  /** What a lender will count, per month. */
  recognisedLenderIncomeMonthly: number
  /** What the household actually has, per month. */
  reliableSafetyIncomeMonthly: number
  employmentType: EmploymentType | null
  incomeProof: IncomeProofType
  incomeStability: IncomeStability
  recognitionRatio: number
  /** Monthly income implied by a filed return, where one exists (INC-12). */
  declaredMonthlyFromItr: number | null
  /** Set when the declared figure, not the recognition ratio, was binding. */
  cappedByDeclared: boolean
  coApplicant: { lender: number; safety: number } | null
  reasons: Reason[]
  wouldNarrow: AnswerFieldId[]
  constraints: ConstraintId[]
}

function isSelfEmployed(e: EmploymentType | null): boolean {
  return e === 'self_employed_cash' || e === 'self_employed_documented' || e === 'daily_wage'
}

/** Recognition ratio for one earner: the lower of proof and employment (INC-03). */
function recognitionFor(proof: IncomeProofType, employment: EmploymentType | null): number {
  const byProof = INCOME_PROOF_RECOGNITION_RATIO[proof] as number
  if (employment === null) return 0
  const byEmployment = EMPLOYMENT_RECOGNITION_CAP_RATIO[employment] as number
  return Math.min(byProof, byEmployment)
}

export function assessIncome(answers: BorrowerAnswers): IncomeAssessment {
  const reasons: Reason[] = []
  const wouldNarrow: AnswerFieldId[] = []
  const constraints: ConstraintId[] = []

  const employmentType = readChoice<EmploymentType>(answers, 'employmentType')
  const claimedProof = readChoice<IncomeProofType>(answers, 'incomeProof') ?? 'none'
  const selfEmployed = isSelfEmployed(employmentType)

  const salaried = readNumeric(answers, 'salariedNetIncomeMonthly', 'income')
  const cash = readNumeric(answers, 'cashIncomeMonthly', 'income')
  const itr = readNumeric(answers, 'itrIncomeAnnual', 'income')
  const credits = readNumeric(answers, 'bankCreditsMonthly', 'income')

  // INC-13 - a claimed return with no figure behind it is a claim, not a
  // document, and must not out-earn the same borrower once they hand the
  // number over.
  const proofLacksItsFigure = PROOF_REQUIRES_ITS_FIGURE && claimedProof === 'itr' && !itr?.stated
  const incomeProof: IncomeProofType = proofLacksItsFigure
    ? PROOF_FALLBACK_WITHOUT_FIGURE
    : claimedProof
  if (proofLacksItsFigure) {
    reasons.push(
      reason(
        'You have told us you file a return but not what it shows, so for now we are counting your income the way a lender counts bank statements. Give us the figure and this moves.',
        ['itrIncomeAnnual', 'incomeProof'],
      ),
    )
    wouldNarrow.push('itrIncomeAnnual')
  }

  const itrMonthlyUnderwriting = itr?.stated ? annualToMonthly(itr.underwriting) : null
  const itrMonthlySafety = itr?.stated ? annualToMonthly(itr.safety) : null

  // For a self-employed borrower, the cash takings, the return and the bank
  // credits all describe one business, so they are alternative measurements
  // of the same income and the largest is taken. For a salaried borrower,
  // cash income is separate side earning and adds.
  const primaryUnderwriting = selfEmployed
    ? Math.max(cash?.underwriting ?? 0, itrMonthlyUnderwriting ?? 0, credits?.underwriting ?? 0)
    : (salaried?.underwriting ?? 0) + (cash?.underwriting ?? 0)

  const primarySafety = selfEmployed
    ? Math.max(cash?.safety ?? 0, itrMonthlySafety ?? 0, credits?.safety ?? 0)
    : (salaried?.safety ?? 0) + (cash?.safety ?? 0)

  const recognitionRatio = recognitionFor(incomeProof, employmentType)
  let recognisedPrimary = primaryUnderwriting * recognitionRatio

  // INC-12 - nothing above what has been declared can be counted.
  let cappedByDeclared = false
  if (selfEmployed && itrMonthlyUnderwriting !== null && recognisedPrimary > itrMonthlyUnderwriting) {
    recognisedPrimary = itrMonthlyUnderwriting
    cappedByDeclared = true
  }

  const safetyPrimary = primarySafety * (SAFETY_VIEW_RECOGNITION_RATIO as number)

  // --- explain the primary income --------------------------------------
  if (employmentType === null) {
    reasons.push(
      reason(
        'We cannot work out what a lender would count until you tell us how you earn, so eligibility is being shown as nothing rather than as a guess.',
        ['employmentType'],
      ),
    )
    wouldNarrow.push('employmentType')
    constraints.push('income_undocumented')
  } else if (cappedByDeclared && itrMonthlyUnderwriting !== null) {
    reasons.push(
      reason(
        `A lender will count ${rupees(itrMonthlyUnderwriting)} a month, not the ${rupees(primaryUnderwriting)} the business actually takes, because your return declares ${rupees(itr!.underwriting)} a year and nothing above a declared figure can be counted.`,
        ['itrIncomeAnnual', 'cashIncomeMonthly', 'employmentType'],
      ),
    )
  } else if (recognitionRatio < 1) {
    reasons.push(
      reason(
        `A lender will count ${rupees(recognisedPrimary)} of your ${rupees(primaryUnderwriting)} a month — ${percent(recognitionRatio * 100, 0)} of it — because ${describeProof(incomeProof)} and ${describeEmployment(employmentType)}.`,
        ['incomeProof', 'employmentType'],
      ),
    )
  } else {
    reasons.push(
      reason(
        `A lender will count your full ${rupees(recognisedPrimary)} a month, because ${describeProof(incomeProof)}.`,
        ['incomeProof', 'employmentType'],
      ),
    )
  }

  // --- co-applicant (INC-08 to INC-11) ---------------------------------
  let coApplicant: { lender: number; safety: number } | null = null
  const hasCo = readChoice<boolean>(answers, 'hasCoApplicant') === true
  const coIncome = readNumeric(answers, 'coApplicantIncomeMonthly', 'income')

  if (hasCo && coIncome?.stated && CO_APPLICANT.countOnlyIfExplicitlyStated) {
    const coProof = readChoice<IncomeProofType>(answers, 'coApplicantIncomeProof') ?? 'none'
    const coEmployment =
      readChoice<EmploymentType>(answers, 'coApplicantEmploymentType') ?? employmentType
    const coRatio = CO_APPLICANT.applyOwnProofAndEmploymentRules
      ? recognitionFor(coProof, coEmployment)
      : 1
    const lender = coIncome.underwriting * coRatio * (CO_APPLICANT.incomeShareRatio as number)
    const safety = coIncome.safety * (SAFETY_VIEW_RECOGNITION_RATIO as number)
    coApplicant = { lender, safety }

    if (lender === 0) {
      reasons.push(
        reason(
          `Your co-applicant's ${rupees(coIncome.safety)} a month counts in full towards what your household can safely carry, but nothing towards what a lender will lend, because ${describeProof(coProof)}.`,
          ['coApplicantIncomeMonthly', 'coApplicantIncomeProof'],
        ),
      )
      constraints.push('income_undocumented')
    } else {
      reasons.push(
        reason(
          `Your co-applicant adds ${rupees(lender)} a month to what a lender will count and ${rupees(safety)} to what your household actually has.`,
          ['coApplicantIncomeMonthly', 'coApplicantIncomeProof'],
        ),
      )
    }
  } else {
    constraints.push('no_co_applicant_counted')
    wouldNarrow.push('coApplicantIncomeMonthly')
  }

  const recognisedLenderIncomeMonthly = recognisedPrimary + (coApplicant?.lender ?? 0)
  const reliableSafetyIncomeMonthly = safetyPrimary + (coApplicant?.safety ?? 0)

  if (reliableSafetyIncomeMonthly > recognisedLenderIncomeMonthly) {
    reasons.push(
      reason(
        `The gap matters: your household has ${rupees(reliableSafetyIncomeMonthly)} a month, a lender will work from ${rupees(recognisedLenderIncomeMonthly)}. The first decides what you can afford; the second decides what you will be offered.`,
        ['incomeProof', 'employmentType', 'coApplicantIncomeProof'],
      ),
    )
  }

  // --- income stability -------------------------------------------------
  let incomeStability = readChoice<IncomeStability>(answers, 'incomeStability')
  if (incomeStability === null) {
    incomeStability = employmentType === 'salaried_formal' ? 'stable' : 'volatile'
    wouldNarrow.push('incomeStability')
  }

  // --- constraints worth an action --------------------------------------
  if (recognitionRatio < 1 || incomeProof === 'none') constraints.push('income_undocumented')
  if (selfEmployed && !itr?.stated) constraints.push('no_itr_filed')

  const tenure = readNumeric(answers, 'timeInCurrentWork', 'income')
  if (tenure?.stated && tenure.underwriting < 12) constraints.push('thin_work_history')

  if (!itr?.stated) wouldNarrow.push('itrIncomeAnnual')
  if (incomeProof === 'none') wouldNarrow.push('incomeProof')

  return {
    recognisedLenderIncomeMonthly,
    reliableSafetyIncomeMonthly,
    employmentType,
    incomeProof,
    incomeStability,
    recognitionRatio,
    declaredMonthlyFromItr: itrMonthlyUnderwriting,
    cappedByDeclared,
    coApplicant,
    reasons,
    wouldNarrow,
    constraints: [...new Set(constraints)],
  }
}

function describeProof(proof: IncomeProofType): string {
  switch (proof) {
    case 'salary_slips':
      return 'you have salary slips'
    case 'itr':
      return 'you have filed a return'
    case 'gst_returns':
      return 'GST returns show turnover rather than income'
    case 'bank_statements_only':
      return 'bank statements are treated as a stand-in for proof of income'
    case 'none':
      return 'you have no income documents to show'
  }
}

function describeEmployment(employment: EmploymentType): string {
  switch (employment) {
    case 'salaried_formal':
      return 'your employment is formal'
    case 'salaried_informal':
      return 'your employer does not issue formal slips'
    case 'self_employed_documented':
      return 'you are self-employed with filings'
    case 'self_employed_cash':
      return 'your business income is largely in cash'
    case 'daily_wage':
      return 'daily and piece work is treated as the least predictable income there is'
  }
}
