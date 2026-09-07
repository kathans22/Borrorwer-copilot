/**
 * Formatting for reason text.
 *
 * Reasons are generated from the values that produced them, never written
 * out for a particular borrower, so everything a reason says has to be
 * assembled here from numbers the engine actually computed.
 */

import type { AnswerFieldId, Reason } from '../types'

/** Rupees, in Indian digit grouping, rounded to whole rupees. */
export function rupees(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

/** A rate or ratio as a percentage, trimming a pointless trailing zero. */
export function percent(n: number, dp = 1): string {
  const s = n.toFixed(dp)
  return (s.endsWith('.0') ? s.slice(0, -2) : s) + '%'
}

/** A ratio held as 0-1, shown as a percentage. */
export function ratioAsPercent(n: number, dp = 0): string {
  return percent(n * 100, dp)
}

export function months(n: number): string {
  const m = Math.round(n)
  if (m % 12 === 0 && m >= 12) {
    const y = m / 12
    return `${y} year${y === 1 ? '' : 's'}`
  }
  return `${m} months`
}

/** A rupee range. */
export function rupeeBand(low: number, high: number): string {
  return `${rupees(low)} to ${rupees(high)}`
}

/** A rate range in percent per annum. */
export function rateBand(low: number, high: number): string {
  return `${percent(low)} to ${percent(high)}`
}

/**
 * Build a Reason. `drivenBy` lists the answers that produced it, which is
 * what lets the interface show a borrower which of their own answers moved
 * a number - and what breaks the build if a question is ever renamed.
 */
export function reason(text: string, drivenBy: AnswerFieldId[]): Reason {
  return { text, drivenBy }
}
