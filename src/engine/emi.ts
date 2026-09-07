/**
 * Tenure, the instalment it implies, and whether that instalment survives a
 * bad year.
 *
 * Order matters here. The age-at-maturity cap (AGE-04) is applied to tenure
 * *before* any amount is derived from it, because tenure caps the amount at
 * any given instalment. Applying it afterwards would leave the age rule in
 * the config and out of the arithmetic.
 */

import {
  AGE_AT_MATURITY_PRODUCT_DELTA_YEARS,
  AGE_TENURE_CAP,
  FIELD_DEFAULTS,
  MAX_AGE_AT_MATURITY_BY_EMPLOYMENT,
  PRODUCTS,
  STRESS_EXPENSE_INFLATION_PCT,
  STRESS_INCOME_DROP_PCT,
  STRESS_LIQUIDITY_MONTHS_REQUIRED,
  STRESS_RATE_RISE_APPLIES_TO,
  STRESS_RATE_RISE_PCT_POINTS,
  TENURE_NOT_TO_EXCEED_ASSET_LIFE_MONTHS,
  type ConstraintId,
  type SupportedProduct,
} from '../rules/rules.config'
import type { AnswerFieldId, BorrowerAnswers, Reason } from '../types'
import { safeCarryIdentity, type Affordability } from './affordability'
import { months as monthsText, percent, reason, rupees } from './format'
import { emiFor, totalInterest } from './money'
import { readNumeric } from './resolve'
import type { IncomeAssessment } from './incomeAssessment'

export type TenureAssessment = {
  maxTenureMonths: number
  /** Which rule actually bound. */
  cappedBy: 'product' | 'age' | 'asset_life'
  maxAgeAtMaturity: number
  ageUsed: number
  ageWasStated: boolean
  /** False when the age cap leaves less than the product's minimum tenure. */
  available: boolean
  reasons: Reason[]
  constraints: ConstraintId[]
  wouldNarrow: AnswerFieldId[]
}

/**
 * Longest tenure this borrower can have on this product (AGE-04).
 *
 *   maxTenure = min(product ceiling, asset life, (maturity age - age) x 12)
 */
export function assessTenure(
  answers: BorrowerAnswers,
  income: IncomeAssessment,
  product: SupportedProduct,
): TenureAssessment {
  const reasons: Reason[] = []
  const constraints: ConstraintId[] = []
  const wouldNarrow: AnswerFieldId[] = []

  const statedAge = readNumeric(answers, 'age', 'income')
  const ageWasStated = statedAge?.stated ?? false
  const ageUsed = ageWasStated ? statedAge!.underwriting : (FIELD_DEFAULTS.age.value as number)
  if (!ageWasStated) wouldNarrow.push('age')

  const rules = PRODUCTS[product]
  const productMax = rules.tenureMonths.high as number
  const productMin = rules.tenureMonths.low as number

  const employment = income.employmentType
  const baseMaturity = employment
    ? (MAX_AGE_AT_MATURITY_BY_EMPLOYMENT[employment] as number)
    : (MAX_AGE_AT_MATURITY_BY_EMPLOYMENT.daily_wage as number)
  const maxAgeAtMaturity = baseMaturity + AGE_AT_MATURITY_PRODUCT_DELTA_YEARS[product]

  const byAge = Math.max((maxAgeAtMaturity - ageUsed) * 12, 0)
  const assetLife = TENURE_NOT_TO_EXCEED_ASSET_LIFE_MONTHS[product]
  const byAsset = assetLife === null ? Number.POSITIVE_INFINITY : (assetLife as number)

  const maxTenureMonths = Math.min(productMax, byAge, byAsset)
  const cappedBy: TenureAssessment['cappedBy'] =
    maxTenureMonths === byAge && byAge < productMax
      ? 'age'
      : maxTenureMonths === byAsset && byAsset < productMax
        ? 'asset_life'
        : 'product'

  const available = !AGE_TENURE_CAP.unavailableIfBelowProductMinimum || maxTenureMonths >= productMin

  if (cappedBy === 'age') {
    reasons.push(
      reason(
        `Your longest term here is ${monthsText(maxTenureMonths)}, not the ${monthsText(productMax)} this product allows, because the last instalment has to fall before you turn ${maxAgeAtMaturity}. A shorter term means a larger instalment, so it also caps how much you can borrow.`,
        ['age', 'employmentType'],
      ),
    )
    constraints.push('tenure_capped_by_age')
  } else if (cappedBy === 'asset_life') {
    reasons.push(
      reason(
        `Your longest term here is ${monthsText(maxTenureMonths)}, held short so the loan does not outlive the vehicle securing it.`,
        ['productType'],
      ),
    )
  } else {
    reasons.push(
      reason(
        `Your longest term here is ${monthsText(maxTenureMonths)}, the product ceiling. Age is not the constraint: at ${Math.round(ageUsed)} you have room until ${maxAgeAtMaturity}, which would allow ${monthsText(byAge)}.`,
        ['age', 'employmentType'],
      ),
    )
  }

  if (!available) {
    reasons.push(
      reason(
        `This product is not available to you: the shortest term a lender will write is ${monthsText(productMin)} and your age leaves room for ${monthsText(maxTenureMonths)}.`,
        ['age', 'employmentType'],
      ),
    )
  }

  return {
    maxTenureMonths,
    cappedBy,
    maxAgeAtMaturity,
    ageUsed,
    ageWasStated,
    available,
    reasons,
    constraints,
    wouldNarrow,
  }
}

// ====================================================================
// Tenure trade-off
// ====================================================================

export type TenureOption = {
  tenureMonths: number
  emi: number
  totalInterest: number
  totalCost: number
}

/**
 * What a longer term actually costs. A lower instalment is the thing every
 * salesperson leads with; the total interest is the thing they do not, and
 * showing both in one table is most of the argument.
 */
export function tenureTradeOff(
  principal: number,
  annualRatePct: number,
  product: SupportedProduct,
  maxTenureMonths: number,
): TenureOption[] {
  const min = PRODUCTS[product].tenureMonths.low as number
  const options: TenureOption[] = []
  const step = maxTenureMonths - min <= 48 ? 12 : 24

  for (let t = min; t <= maxTenureMonths; t += step) {
    options.push(optionAt(principal, annualRatePct, t))
  }
  const last = options[options.length - 1]
  if (!last || last.tenureMonths < maxTenureMonths) {
    options.push(optionAt(principal, annualRatePct, maxTenureMonths))
  }
  return options
}

function optionAt(principal: number, annualRatePct: number, tenureMonths: number): TenureOption {
  const emi = emiFor(principal, annualRatePct, tenureMonths)
  const interest = totalInterest(principal, annualRatePct, tenureMonths)
  return { tenureMonths, emi, totalInterest: interest, totalCost: principal + interest }
}

// ====================================================================
// Stress (STR-01 to STR-05)
// ====================================================================

export type StressCase = {
  passes: boolean
  incomeDropPct: number
  stressedIncome: number
  stressedExpenses: number
  rateRiseApplied: number
  stressedRatePct: number
  stressedEmi: number
  stressedSafeCarry: number
  liquidityOk: boolean
  liquidityRequired: number
  reasons: Reason[]
}

/**
 * One bad year, not a catastrophe: work dries up for a while, the floating
 * rate moves, prices rise. Buffer rebuilding is suspended under stress -
 * nobody saves during the bad year - so the test is purely whether the
 * instalment still fits.
 */
export function stressTest(input: {
  answers: BorrowerAnswers
  income: IncomeAssessment
  affordability: Affordability
  product: SupportedProduct
  principal: number
  annualRatePct: number
  tenureMonths: number
}): StressCase {
  const { income, affordability: aff, product } = input
  const reasons: Reason[] = []

  const dropPct = STRESS_INCOME_DROP_PCT[income.incomeStability] as number
  const stressedIncome = income.reliableSafetyIncomeMonthly * (1 - dropPct / 100)
  const stressedExpenses =
    aff.household.expensesMonthly * (1 + (STRESS_EXPENSE_INFLATION_PCT as number) / 100)

  const isFloating = PRODUCTS[product].rateType === 'floating'
  const rateRiseApplied =
    STRESS_RATE_RISE_APPLIES_TO === 'floating_only' && !isFloating
      ? 0
      : (STRESS_RATE_RISE_PCT_POINTS as number)
  const stressedRatePct = input.annualRatePct + rateRiseApplied
  const stressedEmi = emiFor(input.principal, stressedRatePct, input.tenureMonths)

  const stressed = safeCarryIdentity({
    safetyIncome: stressedIncome,
    expenses: stressedExpenses,
    rent: aff.household.rentMonthly,
    obligations: aff.existingObligations,
    informalDebtService: aff.informalDebtService,
    bufferAccrual: 0,
    residualFloor: aff.residualFloor,
  })

  const baseEmi = emiFor(input.principal, input.annualRatePct, input.tenureMonths)
  const liquidityRequired =
    (STRESS_LIQUIDITY_MONTHS_REQUIRED as number) *
    (baseEmi + aff.household.expensesMonthly + aff.household.rentMonthly)
  const liquidityOk = aff.household.savings >= liquidityRequired

  const passes = stressedEmi <= stressed.safeCarry && liquidityOk

  reasons.push(
    reason(
      `Under a ${percent(dropPct, 0)} drop in income${rateRiseApplied > 0 ? ` and a ${percent(rateRiseApplied)} rate rise` : ''}, the instalment would be ${rupees(stressedEmi)} against ${rupees(stressed.safeCarry)} your household could then carry — ${passes || stressedEmi <= stressed.safeCarry ? 'it still fits' : 'it no longer fits'}.`,
      ['incomeStability', 'employmentType'],
    ),
  )

  if (!isFloating && STRESS_RATE_RISE_APPLIES_TO === 'floating_only') {
    reasons.push(
      reason(
        'No rate rise is applied: this product is fixed-rate, so it does not reprice.',
        ['productType'],
      ),
    )
  }

  if (!liquidityOk) {
    reasons.push(
      reason(
        `You would also need about ${rupees(liquidityRequired)} put by to cover one month of instalment, rent and living costs. You have ${rupees(aff.household.savings)}.`,
        ['savingsBuffer'],
      ),
    )
  }

  return {
    passes,
    incomeDropPct: dropPct,
    stressedIncome,
    stressedExpenses,
    rateRiseApplied,
    stressedRatePct,
    stressedEmi,
    stressedSafeCarry: stressed.safeCarry,
    liquidityOk,
    liquidityRequired,
    reasons,
  }
}
