/**
 * How wide a band is, given what the borrower has not told us.
 *
 * A band's width is computed, never assigned. With only the opening
 * questions answered every band should be visibly wide; each further answer
 * removes its own contribution and the band tightens. If a module wants to
 * express doubt, this is the only honest place to put it - a wider band is
 * something the borrower can see, unlike a confidence label they cannot
 * check.
 */

import {
  MAX_TOTAL_WIDENING_RATIO,
  WIDENED_BAND_FLOOR_AT_ZERO,
  WIDENING_EXEMPT_FIELDS,
  WIDENING_FACTOR,
  type OutputId,
} from '../rules/rules.config'
import { ALL_QUESTIONS } from '../questions/questions.config'
import type { AnswerFieldId, Band, BorrowerAnswers } from '../types'
import { isUnanswered } from './resolve'

/**
 * Fields this borrower would actually be asked about.
 *
 * Widening for a question that will never be put to them is not honest
 * uncertainty - it is a band that can never close. A salaried borrower does
 * not file business returns, so an unanswered ITR field is not a gap in what
 * we know about them; it is a question that does not exist on their path.
 */
function applicableFields(answers: BorrowerAnswers): Set<AnswerFieldId> {
  const out = new Set<AnswerFieldId>()
  for (const q of ALL_QUESTIONS) if (q.appliesWhen(answers)) out.add(q.id)
  return out
}

/** Which of an output's inputs the borrower has not settled. */
export function unansweredFor(answers: BorrowerAnswers, output: OutputId): AnswerFieldId[] {
  const table = WIDENING_FACTOR[output]
  const applicable = applicableFields(answers)
  return (Object.keys(table) as AnswerFieldId[]).filter(
    (field) =>
      !WIDENING_EXEMPT_FIELDS.includes(field) &&
      applicable.has(field) &&
      isUnanswered(answers, field),
  )
}

/**
 * WID-01/WID-03 - Total widening for an output, as a fraction of its centre.
 * Additive across unanswered fields, capped so that the low end does not
 * collapse and the high end does not become fantasy.
 */
export function wideningRatio(answers: BorrowerAnswers, output: OutputId): number {
  const table = WIDENING_FACTOR[output]
  const total = unansweredFor(answers, output).reduce(
    (sum, field) => sum + (table[field] ?? 0),
    0,
  )
  return Math.min(total, MAX_TOTAL_WIDENING_RATIO)
}

/**
 * Widen a band by a ratio of its own centre. A point estimate becomes a
 * band; an existing band gets wider without moving its centre.
 */
export function widenBand<U extends number>(
  band: Band<U>,
  ratio: number,
  /** WID-05 - floor under the scale widening works from. */
  minScale = 0,
): Band<U> {
  const low = band.low as number
  const high = band.high as number
  const centre = (low + high) / 2
  const extra = Math.max(Math.abs(centre), minScale) * ratio
  const widenedLow = low - extra
  return {
    low: (WIDENED_BAND_FLOOR_AT_ZERO ? Math.max(widenedLow, 0) : widenedLow) as U,
    high: (high + extra) as U,
  }
}

