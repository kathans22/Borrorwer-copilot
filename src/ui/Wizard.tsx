/**
 * The question flow: one question a screen, in the order the engine says is
 * most useful to this borrower next.
 *
 * Once the opening questions are done, a "see my results" button stays on
 * screen permanently. Stopping is a first-class option, not an escape hatch
 * - the assessment is complete at every step, and the only thing further
 * answers do is tighten the ranges. The button says how much the next answer
 * would be worth, so that carrying on is a decision rather than a
 * conveyor belt.
 */

import { computeWithTrace } from '../engine/index'
import { narrowingImpact } from '../engine/narrowing'
import { MUST_QUESTIONS } from '../questions/questions.config'
import { questionQueue } from '../questions/order'
import type { BorrowerAnswers } from '../types'
import { confidenceShort, LABELS } from './copy'
import { percent } from './format'
import { QuestionInput, type AnswerValue } from './QuestionInput'
import { Button } from './primitives'

export function Wizard({
  answers,
  onAnswer,
  onFinish,
  onClear,
}: {
  answers: BorrowerAnswers
  onAnswer: (id: string, a: AnswerValue) => void
  onFinish: () => void
  onClear: () => void
}) {
  const queue = questionQueue(answers)
  const question = queue[0]

  const mustRemaining = queue.filter((q) => q.tier === 'must').length
  const mustDone = MUST_QUESTIONS.length - mustRemaining
  const canSeeResults = mustRemaining === 0

  if (!question) {
    return (
      <div className="space-y-4">
        <p className="text-base text-stone-700">
          That is everything we can usefully ask you. Your answers are as complete as they get.
        </p>
        <Button onClick={onFinish}>{LABELS.seeResults}</Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Progress done={mustDone} total={MUST_QUESTIONS.length} past={canSeeResults} />

      <div>
        <h1 className="text-xl font-semibold leading-snug text-stone-900">{question.prompt}</h1>
        <details className="mt-2">
          <summary className="cursor-pointer list-none text-sm font-medium text-teal-800 underline decoration-dotted underline-offset-4">
            {LABELS.whyWeAsk}
          </summary>
          <p className="mt-2 border-l-2 border-stone-200 pl-3 text-sm leading-relaxed text-stone-600">
            {question.whyWeAsk}
          </p>
        </details>
      </div>

      <QuestionInput question={question} onAnswer={(a) => onAnswer(question.id, a)} />

      {canSeeResults && <StopHere answers={answers} onFinish={onFinish} />}

      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-stone-500 underline underline-offset-4"
        >
          {LABELS.clear}
        </button>
      </div>
    </div>
  )
}

function Progress({ done, total, past }: { done: number; total: number; past: boolean }) {
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-teal-700 transition-all"
          style={{ width: `${Math.min((done / total) * 100, 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-stone-500">
        {past
          ? 'You have answered enough for a full assessment. Everything from here just sharpens it.'
          : `Question ${Math.min(done + 1, total)} of ${total} to get your first answer`}
      </p>
    </div>
  )
}

/**
 * The persistent stop button, with what stopping costs.
 *
 * "Answering two more narrows your rate range by about 1.5 points" is the
 * honest version of a progress bar: it tells somebody what they get for
 * their next minute, rather than how far along a form they are.
 */
function StopHere({ answers, onFinish }: { answers: BorrowerAnswers; onFinish: () => void }) {
  const { result } = computeWithTrace(answers)
  const upcoming = questionQueue(answers).slice(0, 2)

  const rateCentre = ((result.fairRate.band.low as number) + (result.fairRate.band.high as number)) / 2
  const rateGain = upcoming.reduce((sum, q) => sum + narrowingImpact('fairRate', q.id) * rateCentre, 0)

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-sm text-stone-700">
        Your answer so far is a <strong>{confidenceShort(result.verdict.confidence)}</strong>.
      </p>
      {upcoming.length > 0 && rateGain >= 0.1 && (
        <p className="mt-1 text-sm text-stone-600">
          Answering {upcoming.length === 1 ? 'one more question' : `${upcoming.length} more questions`} would
          narrow what this should cost you by roughly {percent(rateGain)}.
        </p>
      )}
      <div className="mt-3">
        <Button onClick={onFinish} variant="secondary">
          {LABELS.seeResults}
        </Button>
      </div>
    </div>
  )
}
