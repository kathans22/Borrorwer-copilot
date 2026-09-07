/**
 * What the borrower could answer next, ranked by how much it would help.
 *
 * Drives both the adaptive question ordering and the "answering this narrows
 * your rate by about a point and a half" hint, so the ranking has to be the
 * same one the widening actually uses rather than a second opinion about it.
 */

import {
  WIDENING_EXEMPT_FIELDS,
  WIDENING_FACTOR,
  WOULD_NARROW_DISTRIBUTION_IMPACT,
  WOULD_NARROW_EXCLUDES_ANSWERED,
  WOULD_NARROW_MAX_ITEMS,
  type OutputId,
} from '../rules/rules.config'
import type { AnswerFieldId, BorrowerAnswers } from '../types'
import { isUnanswered } from './resolve'

/**
 * NAR-01/NAR-02 - The unanswered fields ranked by how much of this band they
 * are responsible for, most useful first.
 *
 * Fields exempt from widening still appear here. Checking a credit score is
 * usually the single most valuable thing a borrower can do, and it would be
 * perverse to leave it off the list because its uncertainty is modelled as a
 * pricing distribution rather than as a widening factor.
 */
export function rankWouldNarrow(answers: BorrowerAnswers, output: OutputId): AnswerFieldId[] {
  const widening = WIDENING_FACTOR[output]
  const distribution = WOULD_NARROW_DISTRIBUTION_IMPACT[output]

  const impacts = new Map<AnswerFieldId, number>()
  for (const [field, weight] of Object.entries(widening) as [AnswerFieldId, number][]) {
    if (!WIDENING_EXEMPT_FIELDS.includes(field)) impacts.set(field, weight)
  }
  for (const [field, weight] of Object.entries(distribution) as [AnswerFieldId, number][]) {
    impacts.set(field, Math.max(impacts.get(field) ?? 0, weight))
  }

  return [...impacts.entries()]
    .filter(([field]) => !WOULD_NARROW_EXCLUDES_ANSWERED || isUnanswered(answers, field))
    .sort((a, b) => b[1] - a[1])
    .slice(0, WOULD_NARROW_MAX_ITEMS)
    .map(([field]) => field)
}

/**
 * How much narrower this output would get if one field were answered, as a
 * fraction of the band's centre. Used for the "answering this narrows your
 * rate by about 1.5 points" hint.
 */
export function narrowingImpact(output: OutputId, field: AnswerFieldId): number {
  return (
    WIDENING_FACTOR[output][field] ?? WOULD_NARROW_DISTRIBUTION_IMPACT[output][field] ?? 0
  )
}

