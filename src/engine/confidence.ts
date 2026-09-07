/**
 * Confidence, read off the band rather than decided.
 *
 * Confidence is not a separate judgement about the borrower - it is a
 * reading of how wide the answer came out, so that the label and the number
 * can never disagree. A "high confidence" figure spanning a factor of three
 * is exactly what this module exists to prevent, and before it existed three
 * different modules each had their own rule of thumb wearing the same word.
 */

import {
  CONFIDENCE_BY_RELATIVE_WIDTH,
  VERDICT_CONFIDENCE_SOURCES,
  type OutputId,
} from '../rules/rules.config'
import type { Band, Confidence } from '../types'

/** CONF-01 - dimensionless, so one set of thresholds works for rupees and rates. */
export function relativeWidth(band: Band<number>): number {
  const centre = (band.low + band.high) / 2
  if (centre === 0) return band.high === band.low ? 0 : Number.POSITIVE_INFINITY
  return Math.abs(band.high - band.low) / Math.abs(centre)
}

/**
 * CONF-02 - The only place a confidence label is produced. Every output
 * takes its confidence from here, so the label and the number cannot
 * disagree.
 */
export function confidenceFromBand(band: Band<number>): Confidence {
  const width = relativeWidth(band)
  for (const step of CONFIDENCE_BY_RELATIVE_WIDTH) {
    if (width <= step.upToRelativeWidth) return step.confidence
  }
  return 'low'
}

const RANK: Record<Confidence, number> = { high: 2, medium: 1, low: 0 }

/**
 * CONF-03 - The verdict has no band, so it takes the weakest confidence of
 * the numbers it was decided from. A verdict cannot be more certain than the
 * arithmetic underneath it.
 */
export function verdictConfidence(byOutput: Partial<Record<OutputId, Confidence>>): Confidence {
  const sources = VERDICT_CONFIDENCE_SOURCES.map((id) => byOutput[id]).filter(
    (c): c is Confidence => c !== undefined,
  )
  if (sources.length === 0) return 'low'
  return sources.reduce((worst, c) => (RANK[c] < RANK[worst] ? c : worst))
}

