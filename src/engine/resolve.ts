/**
 * Reading answers, collapsing ranges, and applying defaults.
 *
 * Three states are kept apart throughout, because they mean different things
 * and the rules treat them differently:
 *
 *   stated               - the borrower gave a value or a range
 *   explicitly unknown   - the borrower said "I don't know"
 *   not reached          - the question has not been asked yet
 *
 * Every default that fires produces a Reason (DEF-21). Nothing is assumed
 * silently.
 */

import {
  EXISTING_OBLIGATION_DEFAULT_RATIO_OF_INCOME,
  EXPENSE_RANGE_COLLAPSE,
  FIELD_DEFAULTS,
  HOUSEHOLD_EXPENSE_DEFAULT,
  INCOME_RANGE_COLLAPSE,
  RENT_DEFAULT_INR_PER_MONTH,
} from '../rules/rules.config'
import type { AnswerFieldId, BorrowerAnswers, CityTier, Reason } from '../types'
import type { Ledger } from './assumptions'
import { reason, rupees } from './format'

/**
 * A numeric answer after range collapse. Carries both views, because INC-05
 * collapses a range to different points for underwriting and for safety, and
 * picking one early is how that rule gets quietly lost.
 */
export type Reading = {
  underwriting: number
  safety: number
  stated: boolean
  explicitlyUnknown: boolean
  range: { low: number; high: number } | null
}

/** Which way a range collapses. Income averages; a cost takes its top. */
export type Polarity = 'income' | 'cost'

type AnyNumeric = { value: number } | { range: { low: number; high: number } } | { unknown: true }

function raw(answers: BorrowerAnswers, field: AnswerFieldId): AnyNumeric | undefined {
  return answers[field] as AnyNumeric | undefined
}

/**
 * Read a numeric field, collapsing any range per INC-05 or INC-06.
 * Returns null when the question has not been answered at all.
 */
export function readNumeric(
  answers: BorrowerAnswers,
  field: AnswerFieldId,
  polarity: Polarity,
): Reading | null {
  const a = raw(answers, field)
  if (a === undefined) return null
  if ('unknown' in a) {
    return { underwriting: 0, safety: 0, stated: false, explicitlyUnknown: true, range: null }
  }
  if ('value' in a) {
    return {
      underwriting: a.value,
      safety: a.value,
      stated: true,
      explicitlyUnknown: false,
      range: null,
    }
  }
  const { low, high } = a.range
  const collapse = polarity === 'income' ? INCOME_RANGE_COLLAPSE : EXPENSE_RANGE_COLLAPSE
  return {
    underwriting: low + (high - low) * (collapse.underwritingPointOfRange as number),
    safety: low + (high - low) * (collapse.safetyPointOfRange as number),
    stated: true,
    explicitlyUnknown: false,
    range: { low, high },
  }
}

/** Read a categorical field. Null when unanswered or explicitly unknown. */
export function readChoice<T>(answers: BorrowerAnswers, field: AnswerFieldId): T | null {
  const a = answers[field] as { value: T } | { unknown: true } | undefined
  if (a === undefined || 'unknown' in a) return null
  return a.value
}

/** True when the borrower has actively said they do not know. */
export function isExplicitlyUnknown(answers: BorrowerAnswers, field: AnswerFieldId): boolean {
  const a = answers[field]
  return a !== undefined && 'unknown' in a
}

/** True when the question has not been answered either way. */
export function isUnanswered(answers: BorrowerAnswers, field: AnswerFieldId): boolean {
  const a = answers[field]
  return a === undefined || 'unknown' in a
}

/** Fill `{value}` in a DEF-* reason template and tag it to its field. */
function defaultReason(field: keyof typeof FIELD_DEFAULTS, shown: string): Reason {
  return reason(FIELD_DEFAULTS[field].reasonTemplate.replace('{value}', shown), [
    field as AnswerFieldId,
  ])
}

export type Resolved = {
  value: number
  stated: boolean
  reason: Reason | null
}

/**
 * The household inputs that drive the safety side. Each falls back to a
 * DEF-* default, and each default that fires carries its own Reason.
 */
export type Household = {
  cityTier: CityTier
  dependents: number
  expensesMonthly: number
  rentMonthly: number
  savings: number
  ownsProperty: boolean
  reasons: Reason[]
  wouldNarrow: AnswerFieldId[]
}

export function resolveHousehold(answers: BorrowerAnswers, ledger: Ledger): Household {
  const reasons: Reason[] = []
  const wouldNarrow: AnswerFieldId[] = []

  // City tier - DEF-08. Metro is the most expensive case.
  let cityTier = readChoice<CityTier>(answers, 'cityTier')
  if (cityTier === null) {
    cityTier = FIELD_DEFAULTS.cityTier.value as CityTier
    const r = defaultReason('cityTier', cityTier)
    reasons.push(r)
    ledger.record('cityTier', cityTier, r)
    wouldNarrow.push('cityTier')
  }

  // Dependants - DEF-09.
  const dep = readNumeric(answers, 'dependents', 'cost')
  let dependents: number
  if (dep?.stated) {
    dependents = dep.underwriting
  } else {
    dependents = FIELD_DEFAULTS.dependents.value as number
    const r = defaultReason('dependents', String(dependents))
    reasons.push(r)
    ledger.record('dependents', dependents, r)
    wouldNarrow.push('dependents')
  }

  // Does the borrower own property? Rent defaults to nothing if so - DEF-02,
  // the one place a zero rent is a fact rather than a flattering guess.
  const propertyValue = readNumeric(answers, 'propertyValue', 'cost')
  const ownsProperty = (propertyValue?.stated ?? false) && propertyValue!.underwriting > 0

  // Household expenses, excluding rent - DEF-01.
  const statedExpenses = readNumeric(answers, 'householdExpensesMonthly', 'cost')
  let expensesMonthly: number
  if (statedExpenses?.stated) {
    expensesMonthly = statedExpenses.underwriting
  } else {
    const table = HOUSEHOLD_EXPENSE_DEFAULT[cityTier]
    expensesMonthly =
      (table.baseInrPerMonth as number) + (table.perDependentInrPerMonth as number) * dependents
    const r = defaultReason('householdExpensesMonthly', rupees(expensesMonthly))
    reasons.push(r)
    ledger.record('householdExpensesMonthly', expensesMonthly, r)
    wouldNarrow.push('householdExpensesMonthly')
  }

  // Rent - DEF-02.
  const statedRent = readNumeric(answers, 'rentMonthly', 'cost')
  let rentMonthly: number
  if (statedRent?.stated) {
    rentMonthly = statedRent.underwriting
  } else if (ownsProperty) {
    // DEF-02. Zero here is a fact rather than a flattering guess, but it is
    // still an assumption and the borrower is told about it - somebody who
    // owns a shop and rents a home would otherwise never see it.
    rentMonthly = 0
    const r = reason(
      'We assumed you pay no rent, because you told us you own property. If that property is business premises and you rent your home, tell us and your safe limit falls.',
      ['rentMonthly', 'propertyValue'],
    )
    reasons.push(r)
    ledger.record('rentMonthly', rentMonthly, r)
  } else {
    rentMonthly = RENT_DEFAULT_INR_PER_MONTH[cityTier] as number
    const r = defaultReason('rentMonthly', rupees(rentMonthly))
    reasons.push(r)
    ledger.record('rentMonthly', rentMonthly, r)
    wouldNarrow.push('rentMonthly')
  }

  // Savings - DEF-07. Zero is allowed here because it works against the
  // borrower's own case rather than flattering it (DEF-22).
  const statedSavings = readNumeric(answers, 'savingsBuffer', 'cost')
  let savings: number
  if (statedSavings?.stated) {
    savings = statedSavings.safety
  } else {
    savings = FIELD_DEFAULTS.savingsBuffer.value as number
    const r = defaultReason('savingsBuffer', rupees(savings))
    reasons.push(r)
    ledger.record('savingsBuffer', savings, r)
    wouldNarrow.push('savingsBuffer')
  }

  return {
    cityTier,
    dependents,
    expensesMonthly,
    rentMonthly,
    savings,
    ownsProperty,
    reasons,
    wouldNarrow,
  }
}

/**
 * Existing obligations - DEF-03. Never defaults to zero, because an unstated
 * EMI is the fastest way to make a borrower look more affordable than they
 * are. Taken as a share of safety income, since what a household owes is a
 * fact about the household and does not change with what a lender will count.
 */
export function resolveExistingObligations(
  answers: BorrowerAnswers,
  safetyIncomeMonthly: number,
  ledger: Ledger,
): Resolved {
  const stated = readNumeric(answers, 'existingEmiMonthly', 'cost')
  if (stated?.stated) {
    return { value: stated.underwriting, stated: true, reason: null }
  }
  const value = safetyIncomeMonthly * (EXISTING_OBLIGATION_DEFAULT_RATIO_OF_INCOME as number)
  const r = defaultReason('existingEmiMonthly', rupees(value))
  ledger.record('existingEmiMonthly', value, r)
  return { value, stated: false, reason: r }
}

/**
 * Borrowing the borrower has not mentioned.
 *
 * The engine has to compute with nothing for these, which is a coercion to
 * zero and therefore something ASR-01 polices. Zero is the right assumption
 * - inventing a debt nobody mentioned would be worse than missing one - but
 * it is still an assumption, so it is recorded, explained once, and the
 * uncertainty is carried by the widening in WID-01 rather than pretended
 * away.
 */
export function recordUndisclosedDebts(
  answers: BorrowerAnswers,
  ledger: Ledger,
): Reason | null {
  const fields: AnswerFieldId[] = [
    'informalDebtOutstanding',
    'creditCardOutstanding',
    'existingLoanOutstanding',
  ]
  const missing = fields.filter((f) => {
    const reading = readNumeric(answers, f, 'cost')
    return !reading?.stated
  })
  if (missing.length === 0) return null

  const r = reason(
    'We have assumed you have no borrowing beyond what you have told us about - nothing on a card, nothing with a local lender, no other loan running. If any of that exists, telling us usually changes the whole answer.',
    missing,
  )
  for (const field of missing) ledger.record(field, 0, r)
  return r
}
