/**
 * The two affordability rules, computed independently (AFF-14).
 *
 * Neither function below reads the other's output. They are allowed to
 * disagree, and in practice they disagree by three or four times. That
 * disagreement is the product: one number is what a lender will offer, the
 * other is what the household can carry, and the borrower is entitled to
 * both plus a straight answer about which one to go by.
 */

import {
  BUFFER_ACCRUAL_CAP_RATIO_OF_SURPLUS,
  MIN_WIDENING_SCALE_RATIO_OF_INCOME,
  BUFFER_REBUILD_HORIZON_MONTHS,
  EMERGENCY_BUFFER_TARGET_MONTHS,
  FOIR_ADJUSTMENT_RATIO_POINTS_BY_EMPLOYMENT,
  FOIR_CAP_BY_INCOME_BAND,
  FOIR_FLOOR_RATIO,
  PURPOSE_RULES,
  RESIDUAL_INCOME_FLOOR,
  SAFE_CARRY,
  type ConstraintId,
} from '../rules/rules.config'
import type {
  AnswerFieldId,
  Band,
  BorrowerAnswers,
  LoanPurpose,
  NumericOutput,
  Reason,
  Rupees,
} from '../types'
import { percent, ratioAsPercent, reason, rupees } from './format'
import { monthlyRateToAnnualPct, principalFor } from './money'
import { readNumeric, resolveExistingObligations, resolveHousehold, type Household } from './resolve'
import type { IncomeAssessment } from './incomeAssessment'
import type { Ledger } from './assumptions'
import { resolveUncertainty } from './uncertainty'

export type Affordability = {
  /** AFF-04. What a lender will allow as a monthly instalment. */
  lenderEmiCeiling: number
  /** AFF-09. What the household can actually carry monthly. */
  safeCarryEmi: number
  foirRatio: number
  existingObligations: number
  informalDebtService: number
  budgetLimit: number
  residualLimit: number
  residualFloor: number
  bufferAccrual: number
  bufferTarget: number
  /** Everything leaving the household each month before the new instalment. */
  monthlyOutflow: number
  bindingTerm: 'budget' | 'residual'
  household: Household
  reasons: Reason[]
  wouldNarrow: AnswerFieldId[]
  constraints: ConstraintId[]
}

/**
 * Monthly cost of servicing informal borrowing. Interest-only (REF-11): the
 * payment covers the interest and the principal does not move.
 */
export function informalDebtServiceMonthly(answers: BorrowerAnswers): number {
  const outstanding = readNumeric(answers, 'informalDebtOutstanding', 'cost')
  const rate = readNumeric(answers, 'informalDebtRateMonthly', 'cost')
  if (!outstanding?.stated || !rate?.stated) return 0
  return outstanding.underwriting * (rate.underwriting / 100)
}

/**
 * The safe-carry identity itself (AFF-09), as one function so that the
 * stress case in `emi.ts` runs the same arithmetic on stressed inputs rather
 * than a second copy of it that can drift.
 */
export function safeCarryIdentity(input: {
  safetyIncome: number
  expenses: number
  rent: number
  obligations: number
  informalDebtService: number
  bufferAccrual: number
  residualFloor: number
}): { safeCarry: number; budgetLimit: number; residualLimit: number; binding: 'budget' | 'residual' } {
  const outflow = input.expenses + input.rent + input.obligations + input.informalDebtService
  const budgetLimit = input.safetyIncome - outflow - input.bufferAccrual
  const residualLimit =
    input.safetyIncome - input.rent - input.obligations - input.informalDebtService - input.residualFloor
  const binding: 'budget' | 'residual' = budgetLimit <= residualLimit ? 'budget' : 'residual'
  const safeCarry = SAFE_CARRY.floorAtZero
    ? Math.max(Math.min(budgetLimit, residualLimit), 0)
    : Math.min(budgetLimit, residualLimit)
  return { safeCarry, budgetLimit, residualLimit, binding }
}

export function assessAffordability(
  answers: BorrowerAnswers,
  income: IncomeAssessment,
  purpose: LoanPurpose,
  ledger: Ledger,
): Affordability {
  const reasons: Reason[] = []
  const wouldNarrow: AnswerFieldId[] = []
  const constraints: ConstraintId[] = []

  const household = resolveHousehold(answers, ledger)
  reasons.push(...household.reasons)
  wouldNarrow.push(...household.wouldNarrow)
  if (household.wouldNarrow.includes('householdExpensesMonthly')) {
    constraints.push('expenses_unstated')
  }

  const obligations = resolveExistingObligations(answers, income.reliableSafetyIncomeMonthly, ledger)
  if (obligations.reason) {
    reasons.push(obligations.reason)
    wouldNarrow.push('existingEmiMonthly')
  }
  const existingObligations = obligations.value
  const informalDebtService = SAFE_CARRY.includeInformalDebtService
    ? informalDebtServiceMonthly(answers)
    : 0

  // ------------------------------------------------------------------
  // Lender view - FOIR (AFF-01 to AFF-04)
  // ------------------------------------------------------------------
  const recognised = income.recognisedLenderIncomeMonthly
  const band =
    FOIR_CAP_BY_INCOME_BAND.find((b) => recognised < (b.belowInrPerMonth as number)) ??
    FOIR_CAP_BY_INCOME_BAND[FOIR_CAP_BY_INCOME_BAND.length - 1]!
  const adjustment = income.employmentType
    ? (FOIR_ADJUSTMENT_RATIO_POINTS_BY_EMPLOYMENT[income.employmentType] as number)
    : 0
  const foirRatio = Math.max((band.foirRatio as number) + adjustment, FOIR_FLOOR_RATIO as number)
  const foirAllowance = foirRatio * recognised
  const lenderEmiCeiling = Math.max(foirAllowance - existingObligations, 0)

  reasons.push(
    reason(
      `A lender would stop at ${rupees(lenderEmiCeiling)} a month: ${ratioAsPercent(foirRatio)} of the ${rupees(recognised)} they recognise is ${rupees(foirAllowance)}, less the ${rupees(existingObligations)} you already pay each month.`,
      ['employmentType', 'incomeProof', 'existingEmiMonthly'],
    ),
  )
  if (adjustment !== 0) {
    reasons.push(
      reason(
        `That ratio is ${percent(Math.abs(adjustment) * 100, 0)} lower than it would be for a formal salary, because a lender discounts income that varies.`,
        ['employmentType'],
      ),
    )
  }

  // ------------------------------------------------------------------
  // Safety view - the budget identity (AFF-05 to AFF-13)
  // ------------------------------------------------------------------
  const safetyIncome = income.reliableSafetyIncomeMonthly
  const purposeRules = PURPOSE_RULES[purpose]

  const bufferMonths =
    purposeRules.bufferMonthsOverride !== null
      ? (purposeRules.bufferMonthsOverride as number)
      : income.incomeStability === 'stable'
        ? (EMERGENCY_BUFFER_TARGET_MONTHS.stableIncome as number)
        : (EMERGENCY_BUFFER_TARGET_MONTHS.volatileIncome as number)

  const monthlyOutflow =
    household.expensesMonthly + household.rentMonthly + existingObligations + informalDebtService
  const bufferTarget = bufferMonths * monthlyOutflow
  const bufferShortfall = Math.max(bufferTarget - household.savings, 0)

  const preEmiSurplus = safetyIncome - monthlyOutflow
  const uncappedAccrual = SAFE_CARRY.includeBufferAccrual
    ? bufferShortfall / (BUFFER_REBUILD_HORIZON_MONTHS as number)
    : 0
  const bufferAccrual = Math.min(
    uncappedAccrual,
    Math.max(preEmiSurplus, 0) * (BUFFER_ACCRUAL_CAP_RATIO_OF_SURPLUS as number),
  )

  const floorTable = RESIDUAL_INCOME_FLOOR[household.cityTier]
  const residualFloor =
    ((floorTable.baseInrPerMonth as number) +
      (floorTable.perDependentInrPerMonth as number) * household.dependents) *
    (purposeRules.residualFloorMultiplier as number)

  const identity = safeCarryIdentity({
    safetyIncome,
    expenses: household.expensesMonthly,
    rent: household.rentMonthly,
    obligations: existingObligations,
    informalDebtService,
    bufferAccrual,
    residualFloor,
  })
  const { budgetLimit, residualLimit, binding: bindingTerm } = identity
  const safeCarryEmi = identity.safeCarry

  if (bindingTerm === 'budget') {
    reasons.push(
      reason(
        `Your household can carry ${rupees(safeCarryEmi)} a month: ${rupees(safetyIncome)} coming in, less ${rupees(household.expensesMonthly)} of living costs, ${rupees(household.rentMonthly)} rent and ${rupees(existingObligations)} of existing payments, then ${rupees(bufferAccrual)} set aside towards an emergency buffer.`,
        ['householdExpensesMonthly', 'rentMonthly', 'existingEmiMonthly', 'savingsBuffer'],
      ),
    )
  } else {
    reasons.push(
      reason(
        `Your household can carry ${rupees(safeCarryEmi)} a month. After ${rupees(household.rentMonthly)} rent and ${rupees(existingObligations)} of existing payments, ${rupees(residualFloor)} has to be left for a household of ${household.dependents + 1} in a ${household.cityTier === 'metro' ? 'metro' : household.cityTier} area to live on, and that floor is what binds.`,
        ['rentMonthly', 'dependents', 'cityTier', 'existingEmiMonthly'],
      ),
    )
  }

  if (informalDebtService > 0) {
    reasons.push(
      reason(
        `${rupees(informalDebtService)} a month of that is going to informal borrowing at ${percent(monthlyRateToAnnualPct(readNumeric(answers, 'informalDebtRateMonthly', 'cost')!.underwriting))} a year, and it is paying interest only — the amount you owe is not going down.`,
        ['informalDebtOutstanding', 'informalDebtRateMonthly'],
      ),
    )
  }

  if (household.savings < bufferTarget) {
    constraints.push('buffer_short')
    wouldNarrow.push('savingsBuffer')
  }

  return {
    lenderEmiCeiling,
    safeCarryEmi,
    foirRatio,
    existingObligations,
    informalDebtService,
    budgetLimit,
    residualLimit,
    residualFloor,
    bufferAccrual,
    bufferTarget,
    monthlyOutflow,
    bindingTerm,
    household,
    reasons,
    wouldNarrow,
    constraints: [...new Set(constraints)],
  }
}

// ====================================================================
// O2 - the two maximum amounts, and which one to go by (AFF-15)
// ====================================================================

export type MaxAmount = {
  lenderLikely: NumericOutput<Rupees>
  borrowerSafe: NumericOutput<Rupees>
  useWhich: 'lenderLikely' | 'borrowerSafe'
  useWhichReason: Reason
}

function amountBand(emi: number, rateBand: Band<number>, tenureMonths: number): Band<Rupees> {
  // A lower rate buys a larger principal for the same instalment, so the top
  // of the amount band comes from the bottom of the rate band.
  return {
    low: principalFor(emi, rateBand.high, tenureMonths) as Rupees,
    high: principalFor(emi, rateBand.low, tenureMonths) as Rupees,
  }
}

/**
 * Turn the two monthly ceilings into two amounts, and say which one the
 * borrower should actually use (AFF-15).
 *
 * The reason has to name the term that bound. "Your safe limit is lower"
 * tells a borrower nothing they can act on; "the rent and two dependants are
 * what bind" tells them where to look.
 */
export function buildMaxAmount(input: {
  answers: BorrowerAnswers
  affordability: Affordability
  rateBand: Band<number>
  tenureMonths: number
  /** What the routed product can actually deliver, whatever the income says. */
  productCeiling: number
  /** WID-05 - monthly income, from which the amount-scale floor is derived. */
  safetyIncomeMonthly: number
}): MaxAmount {
  const { answers, affordability: aff, rateBand, tenureMonths, productCeiling } = input

  // Neither figure may exceed what the product itself will advance - an LTV
  // cap or a ticket ceiling binds regardless of what the household can carry.
  const cap = (b: Band<Rupees>): Band<Rupees> => ({
    low: Math.min(b.low as number, productCeiling) as Rupees,
    high: Math.min(b.high as number, productCeiling) as Rupees,
  })
  const lenderBand = cap(amountBand(aff.lenderEmiCeiling, rateBand, tenureMonths))
  const safeBand = cap(amountBand(aff.safeCarryEmi, rateBand, tenureMonths))

  // Both figures are widened by the same unanswered questions and read their
  // confidence off the result, so neither can be labelled more certain than
  // its own width (CONF-02).
  // WID-05 - the amount that a sixth of a month's income would service over
  // this term, used as the floor on the widening scale so that an amount
  // which has collapsed to nothing is not reported as a certainty.
  const amountScale = principalFor(
    input.safetyIncomeMonthly * (MIN_WIDENING_SCALE_RATIO_OF_INCOME as number),
    (rateBand.low + rateBand.high) / 2,
    tenureMonths,
  )
  const lenderUncertainty = resolveUncertainty(answers, 'maxAmount', lenderBand, amountScale)
  const safeUncertainty = resolveUncertainty(answers, 'maxAmount', safeBand, amountScale)

  const lenderLikely: NumericOutput<Rupees> = {
    band: lenderUncertainty.band,
    confidence: lenderUncertainty.confidence,
    reasons: [
      reason(
        `${rupees(lenderUncertainty.band.low)} to ${rupees(lenderUncertainty.band.high)} is what a ${rupees(aff.lenderEmiCeiling)} monthly instalment buys over ${Math.round(tenureMonths)} months at ${percent(rateBand.low)} to ${percent(rateBand.high)}.`,
        ['employmentType', 'incomeProof', 'creditScore'],
      ),
    ],
    wouldNarrow: lenderUncertainty.wouldNarrow,
  }

  const borrowerSafe: NumericOutput<Rupees> = {
    band: safeUncertainty.band,
    confidence: safeUncertainty.confidence,
    reasons: [
      reason(
        `${rupees(safeUncertainty.band.low)} to ${rupees(safeUncertainty.band.high)} is what your household can carry at ${rupees(aff.safeCarryEmi)} a month over the same term.`,
        ['householdExpensesMonthly', 'rentMonthly', 'dependents', 'savingsBuffer'],
      ),
    ],
    wouldNarrow: safeUncertainty.wouldNarrow,
  }

  const useWhich: MaxAmount['useWhich'] =
    (safeUncertainty.band.high as number) <= (lenderUncertainty.band.high as number)
      ? 'borrowerSafe'
      : 'lenderLikely'

  return {
    lenderLikely,
    borrowerSafe,
    useWhich,
    useWhichReason:
      useWhich === 'borrowerSafe'
        ? reason(bindingPressure(aff, lenderUncertainty.band, safeUncertainty.band), bindingFields(aff))
        : reason(
            `Go by ${rupees(lenderUncertainty.band.high)}. Your household could carry more than a lender will advance here, so what you will be offered is the binding constraint rather than what you can afford.`,
            ['employmentType', 'incomeProof'],
          ),
  }
}

/** Name the specific pressure that made the safety number bind. */
function bindingPressure(aff: Affordability, lender: Band<Rupees>, safe: Band<Rupees>): string {
  const gap = `A lender may well offer you up to ${rupees(lender.high)}, but go by ${rupees(safe.high)}.`

  if (aff.bindingTerm === 'residual') {
    const people = aff.household.dependents + 1
    return `${gap} What binds is that ${rupees(aff.residualFloor)} a month has to be left for ${people === 1 ? 'you' : `a household of ${people}`} to live on after ${rupees(aff.household.rentMonthly)} of rent${aff.existingObligations > 0 ? ` and ${rupees(aff.existingObligations)} of existing payments` : ''}.`
  }

  const terms: Array<{ label: string; amount: number }> = [
    { label: `${rupees(aff.household.expensesMonthly)} of living costs`, amount: aff.household.expensesMonthly },
    { label: `${rupees(aff.household.rentMonthly)} of rent`, amount: aff.household.rentMonthly },
    { label: `${rupees(aff.existingObligations)} of existing payments`, amount: aff.existingObligations },
    { label: `${rupees(aff.informalDebtService)} servicing informal borrowing`, amount: aff.informalDebtService },
    { label: `${rupees(aff.bufferAccrual)} a month rebuilding an emergency buffer`, amount: aff.bufferAccrual },
  ].filter((t) => t.amount > 0)
  terms.sort((a, b) => b.amount - a.amount)

  const largest = terms[0]
  return `${gap} What binds is your monthly budget, and the largest single pressure on it is ${largest ? largest.label : 'your household spending'}.`
}

function bindingFields(aff: Affordability): AnswerFieldId[] {
  return aff.bindingTerm === 'residual'
    ? ['rentMonthly', 'dependents', 'cityTier', 'existingEmiMonthly']
    : ['householdExpensesMonthly', 'rentMonthly', 'existingEmiMonthly', 'savingsBuffer']
}
