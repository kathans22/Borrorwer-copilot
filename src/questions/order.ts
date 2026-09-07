/**
 * What to ask next.
 *
 * The must-set comes first and in its written order, because it is the
 * minimum needed to say anything at all. After that the order is not fixed:
 * the engine already knows which unanswered fields are widening this
 * borrower's bands, and the next question is whichever applicable one would
 * tighten them most.
 *
 * That means two borrowers see the same questions in different orders, and a
 * borrower who stops after three additional questions has answered the three
 * that mattered most to them rather than the three that happened to come
 * first in a form.
 */

import { computeWithTrace } from '../engine/index'
import { narrowingImpact } from '../engine/narrowing'
import { normaliseAnswers } from '../engine/resolve'
import { ORDERING_BONUS_FOR_LIVE_NARROWING, type OutputId } from '../rules/rules.config'
import type { AnswerFieldId, BorrowerAnswers, CopilotResult } from '../types'
import {
  ADDITIONAL_QUESTIONS,
  MUST_QUESTIONS,
  type Question,
} from './questions.config'

/** Answered means answered - including an explicit "I don't know". */
function isAnswered(answers: BorrowerAnswers, field: AnswerFieldId): boolean {
  return answers[field] !== undefined
}

/** The `wouldNarrow` lists the engine produced for this borrower, by output. */
function liveNarrowing(result: CopilotResult): Record<OutputId, AnswerFieldId[]> {
  return {
    verdict: result.verdict.wouldNarrow,
    // Both amount figures share a widening table, so either list will do.
    maxAmount: result.maxAmount.borrowerSafe.wouldNarrow,
    fairRate: result.fairRate.wouldNarrow,
    emiCeiling: result.emiCeiling.wouldNarrow,
  }
}

/**
 * How much this question is worth to this borrower, right now.
 *
 * The static widening table says what a field is worth in general; the live
 * result says what it is worth here. NAR-04 tips the ordering towards the
 * second without discarding the first.
 */
export function questionImpact(
  question: Question,
  live: Record<OutputId, AnswerFieldId[]>,
): number {
  return question.tightens.reduce((score, output) => {
    const named = live[output].includes(question.id)
    return score + narrowingImpact(output, question.id) + (named ? ORDERING_BONUS_FOR_LIVE_NARROWING : 0)
  }, 0)
}

export type PlannedQuestion = Question & { impact: number }

/**
 * The full remaining queue, in the order it should be asked.
 *
 * The borrower can stop at any point: everything before the cut still
 * produces a complete result, and everything after it is only ever an
 * improvement to the bands.
 */
export function questionQueue(rawAnswers: BorrowerAnswers): PlannedQuestion[] {
  const answers = normaliseAnswers(rawAnswers)

  const must = MUST_QUESTIONS.filter(
    (q) => q.appliesWhen(answers) && !isAnswered(answers, q.id),
  ).map((q) => ({ ...q, impact: Number.POSITIVE_INFINITY }))

  // Ranking the additional set needs a result to rank against, and a result
  // needs the must-set answered. Until then the static table is all there is,
  // which is the right fallback: nothing borrower-specific is yet known.
  const live = must.length > 0
    ? { verdict: [], maxAmount: [], fairRate: [], emiCeiling: [] }
    : liveNarrowing(computeWithTrace(answers).result)

  const additional = ADDITIONAL_QUESTIONS.filter(
    (q) => q.appliesWhen(answers) && !isAnswered(answers, q.id),
  )
    .map((q) => ({ ...q, impact: questionImpact(q, live) }))
    .sort((a, b) => b.impact - a.impact)

  return [...must, ...hoistGates(additional)]
}

/**
 * Move each gate question above the one it gates.
 *
 * Impact ranking alone will happily ask "how much is outstanding on your
 * cards" before "do you use credit cards", which is the sort of thing that
 * makes a good engine feel like a bad form.
 */
function hoistGates(questions: PlannedQuestion[]): PlannedQuestion[] {
  const out = [...questions]
  for (const gate of questions) {
    if (!gate.gateFor) continue
    const gateAt = out.findIndex((q) => q.id === gate.id)
    const gatedAt = out.findIndex((q) => q.id === gate.gateFor)
    if (gateAt === -1 || gatedAt === -1 || gateAt < gatedAt) continue
    out.splice(gateAt, 1)
    out.splice(gatedAt, 0, gate)
  }
  return out
}

/** The single next question, or null when there is nothing left worth asking. */
export function nextQuestion(answers: BorrowerAnswers): PlannedQuestion | null {
  return questionQueue(answers)[0] ?? null
}

/**
 * The whole path a borrower would walk, from the first question to the last.
 *
 * Starts from nothing and reveals the borrower's answers one at a time, which
 * is the only way to see the real path: answering a question changes both
 * which questions apply next and which of them matters most, so the order
 * cannot be worked out in a single pass over a completed form.
 *
 * `known` is used as an oracle - what this borrower would say if asked.
 * Anything they have no answer for is treated as "I don't know", which is a
 * real answer and moves the path along.
 */
export function fullPath(known: BorrowerAnswers): PlannedQuestion[] {
  const answers = known
  const path: PlannedQuestion[] = []
  let current: Record<string, unknown> = {}
  const seen = new Set<AnswerFieldId>()

  for (let guard = 0; guard < 100; guard++) {
    const next = questionQueue(current as BorrowerAnswers)[0]
    if (!next || seen.has(next.id)) break
    path.push(next)
    seen.add(next.id)
    // Mark it answered using the borrower's own answer where we have one, so
    // that later `appliesWhen` predicates see what they would really see.
    current = {
      ...current,
      [next.id]: (answers as Record<string, unknown>)[next.id] ?? { unknown: true },
    }
  }
  return path
}
