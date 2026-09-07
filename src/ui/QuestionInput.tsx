/**
 * One question, whatever kind it is.
 *
 * Driven entirely by the objects in `questions.config.ts`: adding a question
 * there puts it on screen with no edit here. That is the whole point of
 * questions being data - the interface walks the graph, it does not encode
 * it.
 *
 * "I don't know" is rendered as a full-width option the same size as every
 * real answer. It is a genuine answer that the engine treats differently
 * from silence, and burying it in small grey text would quietly push people
 * into guessing - which is worse for them and worse for the numbers.
 */

import { useState } from 'react'
import type { Question } from '../questions/questions.config'
import { LABELS } from './copy'

export type AnswerValue =
  | { value: string | number | boolean }
  | { range: { low: number; high: number } }
  | { unknown: true }

export function QuestionInput({
  question,
  onAnswer,
}: {
  question: Question
  onAnswer: (a: AnswerValue) => void
}) {
  return (
    <div className="space-y-3">
      {question.inputType === 'select' && <SelectInput question={question} onAnswer={onAnswer} />}
      {question.inputType === 'boolean' && <BooleanInput onAnswer={onAnswer} />}
      {(question.inputType === 'number' || question.inputType === 'currency') && (
        <NumberInput question={question} onAnswer={onAnswer} />
      )}
      {question.inputType === 'range' && <RangeInput onAnswer={onAnswer} />}

      {question.allowUnknown && (
        <button
          type="button"
          onClick={() => onAnswer({ unknown: true })}
          className="min-h-12 w-full rounded-xl border border-dashed border-stone-400 bg-stone-50 px-4 py-3 text-base font-medium text-stone-700"
        >
          {LABELS.dontKnow}
        </button>
      )}
    </div>
  )
}

const optionClass =
  'min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-left text-base text-stone-800 active:bg-stone-100'

function SelectInput({
  question,
  onAnswer,
}: {
  question: Question
  onAnswer: (a: AnswerValue) => void
}) {
  return (
    <div className="space-y-2">
      {(question.options ?? []).map((o) => (
        <button key={o.value} type="button" onClick={() => onAnswer({ value: o.value })} className={optionClass}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function BooleanInput({ onAnswer }: { onAnswer: (a: AnswerValue) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => onAnswer({ value: true })} className={optionClass}>
        Yes
      </button>
      <button type="button" onClick={() => onAnswer({ value: false })} className={optionClass}>
        No
      </button>
    </div>
  )
}

function NumberInput({
  question,
  onAnswer,
}: {
  question: Question
  onAnswer: (a: AnswerValue) => void
}) {
  const [text, setText] = useState('')
  const n = Number(text)
  const valid = text.trim() !== '' && Number.isFinite(n) && n >= 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onAnswer({ value: n })
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="sr-only">{question.prompt}</span>
        <div className="flex items-center rounded-xl border border-stone-300 bg-white px-4">
          {question.inputType === 'currency' && <span className="mr-2 text-lg text-stone-500">₹</span>}
          <input
            autoFocus
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder={question.hint ?? ''}
            className="min-h-12 w-full bg-transparent py-3 text-lg outline-none"
          />
        </div>
      </label>
      <button
        type="submit"
        disabled={!valid}
        className="min-h-12 w-full rounded-xl bg-teal-800 px-4 py-3 text-base font-medium text-white disabled:bg-stone-300"
      >
        Continue
      </button>
    </form>
  )
}

/**
 * Two figures rather than one, because a range is the honest answer for
 * anybody whose income moves - and the engine reads the two ends
 * differently on purpose.
 */
function RangeInput({ onAnswer }: { onAnswer: (a: AnswerValue) => void }) {
  const [low, setLow] = useState('')
  const [high, setHigh] = useState('')
  const l = Number(low)
  const h = Number(high)
  const valid = low.trim() !== '' && high.trim() !== '' && Number.isFinite(l) && Number.isFinite(h) && h >= l

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onAnswer({ range: { low: l, high: h } })
      }}
      className="space-y-3"
    >
      <p className="text-sm text-stone-600">A quiet month, and a good month.</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: low, set: setLow, label: 'In a quiet month' },
          { v: high, set: setHigh, label: 'In a good month' },
        ].map((f) => (
          <label key={f.label} className="block">
            <span className="mb-1 block text-xs text-stone-500">{f.label}</span>
            <div className="flex items-center rounded-xl border border-stone-300 bg-white px-3">
              <span className="mr-1 text-stone-500">₹</span>
              <input
                inputMode="numeric"
                value={f.v}
                onChange={(e) => f.set(e.target.value.replace(/[^0-9.]/g, ''))}
                className="min-h-12 w-full bg-transparent py-3 text-lg outline-none"
              />
            </div>
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={!valid}
        className="min-h-12 w-full rounded-xl bg-teal-800 px-4 py-3 text-base font-medium text-white disabled:bg-stone-300"
      >
        Continue
      </button>
    </form>
  )
}
