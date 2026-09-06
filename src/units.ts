/**
 * Constructors for the branded scalars in `types.ts`.
 *
 * These exist so that `rules.config.ts` can read as declarative data
 * (`pctPerYear(14)`) instead of as a wall of casts, while still refusing to
 * let a monthly figure stand in for an annual one.
 *
 * There are deliberately no lending constants in this file. It converts
 * units; it does not decide anything.
 */

import type {
  AnnualRatePct,
  Count,
  CreditScore,
  Grams,
  Karat,
  Months,
  MonthlyRatePct,
  Percent,
  Ratio,
  Rupees,
  RupeesPerMonth,
  RupeesPerYear,
  Years,
} from './types'

/** A rupee amount at a point in time. */
export const inr = (n: number): Rupees => n as Rupees
/** A rupee amount per month. */
export const inrPerMonth = (n: number): RupeesPerMonth => n as RupeesPerMonth
/** A rupee amount per year. */
export const inrPerYear = (n: number): RupeesPerYear => n as RupeesPerYear

/** An interest rate per annum, in percent. `pctPerYear(14)` is 14% p.a. */
export const pctPerYear = (n: number): AnnualRatePct => n as AnnualRatePct
/** An interest rate per month, in percent. `pctPerMonth(3)` is 3% a month. */
export const pctPerMonth = (n: number): MonthlyRatePct => n as MonthlyRatePct
/** A percentage that is not an interest rate - a fee, a haircut. */
export const pct = (n: number): Percent => n as Percent
/** A dimensionless 0-1 ratio. */
export const ratio = (n: number): Ratio => n as Ratio

export const months = (n: number): Months => n as Months
export const years = (n: number): Years => n as Years
export const count = (n: number): Count => n as Count

export const grams = (n: number): Grams => n as Grams
export const karat = (n: number): Karat => n as Karat
export const creditScore = (n: number): CreditScore => n as CreditScore

/**
 * A spread or adjustment expressed in percentage points per annum, which
 * shares the unit of an annual rate: 100 bps is `pctPointsPerYear(1)`.
 * Named separately from `pctPerYear` so a reader can tell a level from a
 * difference at the call site.
 */
export const pctPointsPerYear = (n: number): AnnualRatePct => n as AnnualRatePct
