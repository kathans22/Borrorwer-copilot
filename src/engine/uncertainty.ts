/**
 * The three uncertainty concerns, composed.
 *
 * Widening, confidence and narrowing are the same fact seen three ways. They
 * live in separate modules so each can be read on its own, and they are
 * resolved together here so they cannot drift apart - which is how an output
 * ends up labelled certain while spanning a factor of three.
 */

import type { OutputId } from '../rules/rules.config'
import type { AnswerFieldId, Band, BorrowerAnswers, Confidence } from '../types'
import { confidenceFromBand, relativeWidth } from './confidence'
import { rankWouldNarrow } from './narrowing'
import { widenBand, wideningRatio } from './widening'

export { widenBand, wideningRatio, unansweredFor } from './widening'
export { confidenceFromBand, relativeWidth, verdictConfidence } from './confidence'
export { rankWouldNarrow, narrowingImpact } from './narrowing'

/** Everything an output needs, computed together so the three cannot drift. */
export type Uncertainty<U extends number> = {
  band: Band<U>
  confidence: Confidence
  wouldNarrow: AnswerFieldId[]
  wideningApplied: number
  relativeWidth: number
}

export function resolveUncertainty<U extends number>(
  answers: BorrowerAnswers,
  output: OutputId,
  baseBand: Band<U>,
  /**
   * WID-05. The scale below which this output's uncertainty is not
   * meaningfully proportional - typically a share of monthly income, or the
   * principal that share would service.
   */
  minScale = 0,
): Uncertainty<U> {
  const ratio = wideningRatio(answers, output)
  const band = widenBand(baseBand, ratio, minScale)
  return {
    band,
    confidence: confidenceFromBand(band as Band<number>),
    wouldNarrow: rankWouldNarrow(answers, output),
    wideningApplied: ratio,
    relativeWidth: relativeWidth(band as Band<number>),
  }
}
