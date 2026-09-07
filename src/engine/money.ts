/**
 * Loan arithmetic. No lending judgement lives here - only the maths that
 * turns the rules in `rules.config.ts` into rupees.
 *
 * Every rate crossing this boundary is annual and every tenure is in months,
 * which is where the annual-to-monthly conversion has to happen and the one
 * place it is allowed to.
 */

import { APR_SOLVER, ITR_ANNUAL_TO_MONTHLY_DIVISOR } from '../rules/rules.config'

const MONTHS_PER_YEAR = ITR_ANNUAL_TO_MONTHLY_DIVISOR

/** Annual percentage rate to the monthly rate used in an EMI schedule. */
function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / MONTHS_PER_YEAR
}

/** The instalment on a reducing-balance loan (EMI-02). */
export function emiFor(principal: number, annualRatePct: number, tenureMonths: number): number {
  if (tenureMonths <= 0) return 0
  const r = monthlyRate(annualRatePct)
  if (r === 0) return principal / tenureMonths
  const g = Math.pow(1 + r, tenureMonths)
  return (principal * r * g) / (g - 1)
}

/** The principal an instalment will service - the inverse of `emiFor`. */
export function principalFor(emi: number, annualRatePct: number, tenureMonths: number): number {
  if (tenureMonths <= 0 || emi <= 0) return 0
  const r = monthlyRate(annualRatePct)
  if (r === 0) return emi * tenureMonths
  const g = Math.pow(1 + r, tenureMonths)
  return (emi * (g - 1)) / (r * g)
}

/** Total interest paid over the full schedule. */
export function totalInterest(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
): number {
  return emiFor(principal, annualRatePct, tenureMonths) * tenureMonths - principal
}

/** Outstanding balance after `elapsed` instalments. */
export function balanceAfter(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
  elapsed: number,
): number {
  const r = monthlyRate(annualRatePct)
  const emi = emiFor(principal, annualRatePct, tenureMonths)
  if (r === 0) return Math.max(principal - emi * elapsed, 0)
  const g = Math.pow(1 + r, elapsed)
  return Math.max(principal * g - emi * ((g - 1) / r), 0)
}

/**
 * A rate quoted per month, compounded to its annual equivalent (REF-02).
 * 3% a month is 42.6% a year, not 36%. The multiplication understates
 * exactly the debt worth finding.
 */
export function monthlyRateToAnnualPct(monthlyPct: number): number {
  return (Math.pow(1 + monthlyPct / 100, MONTHS_PER_YEAR) - 1) * 100
}

/** Present value of a level instalment stream at a given monthly rate. */
function presentValue(emi: number, monthly: number, tenureMonths: number): number {
  if (monthly === 0) return emi * tenureMonths
  const g = Math.pow(1 + monthly, tenureMonths)
  return (emi * (g - 1)) / (monthly * g)
}

/**
 * All-in APR from the actual cash flows (APR-01).
 *
 * The borrower receives `netDisbursal` - the sanctioned amount less the
 * processing fee, the GST on it and any other charges - but repays
 * instalments computed on the full sanctioned amount. Solve for the monthly
 * rate that makes those net to zero, then compound to annual.
 *
 * Adding the fee percentage to the interest rate, which is the usual
 * shortcut, understates a short loan badly: the fee is paid once but earned
 * back over however long the loan runs.
 */
export function aprFromCashFlows(
  netDisbursal: number,
  emi: number,
  tenureMonths: number,
): number {
  if (netDisbursal <= 0 || emi <= 0 || tenureMonths <= 0) return 0

  let lo = 0
  let hi = Math.pow(1 + (APR_SOLVER.searchHighAnnualPct as number) / 100, 1 / MONTHS_PER_YEAR) - 1
  const tolerance = (APR_SOLVER.toleranceAnnualPctPoints as number) / 100 / MONTHS_PER_YEAR

  // Present value falls as the discount rate rises, so bisection is safe.
  if (presentValue(emi, hi, tenureMonths) > netDisbursal) {
    return (Math.pow(1 + hi, MONTHS_PER_YEAR) - 1) * 100
  }

  for (let i = 0; i < APR_SOLVER.maxIterations; i++) {
    const mid = (lo + hi) / 2
    if (presentValue(emi, mid, tenureMonths) > netDisbursal) lo = mid
    else hi = mid
    if (hi - lo < tolerance) break
  }

  const monthly = (lo + hi) / 2
  return (Math.pow(1 + monthly, MONTHS_PER_YEAR) - 1) * 100
}

/** Annual income to monthly (INC-07). The only place this division happens. */
export function annualToMonthly(annual: number): number {
  return annual / MONTHS_PER_YEAR
}

/** Clamp a value into a range. */
export function clamp(n: number, low: number, high: number): number {
  return Math.min(Math.max(n, low), high)
}
