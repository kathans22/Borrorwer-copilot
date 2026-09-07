/**
 * How numbers are written on screen.
 *
 * Indian digit grouping throughout - eight lakh is 8,00,000, never 800,000 -
 * and lakh or crore in words where that is how somebody would actually say
 * it. Below a lakh the plain figure is clearer than any words.
 */

/** ₹8,00,000. Whole rupees; nobody is negotiating paise. */
export function money(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

/**
 * The same figure as most people would say it out loud, for the big
 * headline numbers. Returns null below a lakh, where the digits are already
 * the clearest form.
 */
export function inWords(n: number): string | null {
  const abs = Math.abs(Math.round(n))
  if (abs >= 1_00_00_000) return trim(abs / 1_00_00_000) + ' crore'
  if (abs >= 1_00_000) return trim(abs / 1_00_000) + ' lakh'
  return null
}

function trim(x: number): string {
  const s = x.toFixed(2)
  return s.replace(/\.?0+$/, '')
}

/** 14.5% — one decimal, and no pointless trailing zero. */
export function percent(n: number, dp = 1): string {
  const s = n.toFixed(dp)
  return (s.endsWith('.0') ? s.slice(0, -2) : s) + '%'
}

/** "3 years" reads better than "36 months" wherever it divides evenly. */
export function duration(monthsCount: number): string {
  const m = Math.round(monthsCount)
  if (m >= 12 && m % 12 === 0) {
    const y = m / 12
    return `${y} year${y === 1 ? '' : 's'}`
  }
  if (m > 12) {
    const y = Math.floor(m / 12)
    const rest = m % 12
    return `${y} year${y === 1 ? '' : 's'} ${rest} month${rest === 1 ? '' : 's'}`
  }
  return `${m} month${m === 1 ? '' : 's'}`
}

/**
 * A band, written as a band.
 *
 * The only time a single figure appears is when the engine genuinely
 * returned one - low equal to high. Everything else is a range on screen
 * because it is a range underneath, and collapsing it to a midpoint would be
 * the most misleading thing this interface could do.
 */
export function moneyBand(low: number, high: number): string {
  return Math.round(low) === Math.round(high)
    ? money(low)
    : `${money(low)} to ${money(high)}`
}

export function percentBand(low: number, high: number, dp = 1): string {
  return low.toFixed(dp) === high.toFixed(dp)
    ? percent(low, dp)
    : `${percent(low, dp)} to ${percent(high, dp)}`
}
