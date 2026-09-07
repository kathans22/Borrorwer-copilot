/**
 * O1 - the headline.
 *
 * A refusal sits directly above the things that would change it, and is
 * worded as advice rather than as a judgement about the person reading it.
 * Somebody told "no" with nothing to do next is exactly the borrower who
 * goes to the lender down the road at three per cent a month.
 */

import type { CopilotResult } from '../../types'
import { confidenceWords, verdictHeadline, verdictSubhead } from '../copy'

export function Verdict({ result }: { result: CopilotResult }) {
  const v = result.verdict.value
  const tone =
    v === 'borrow'
      ? 'border-emerald-200 bg-emerald-50'
      : v === 'borrow_less'
        ? 'border-amber-200 bg-amber-50'
        : 'border-stone-300 bg-stone-100'

  return (
    <section className={`rounded-2xl border p-5 ${tone}`}>
      <h1 className="text-2xl font-semibold leading-tight text-stone-900">{verdictHeadline(v)}</h1>
      <p className="mt-2 text-base leading-relaxed text-stone-700">{verdictSubhead(v)}</p>

      <div className="mt-4 space-y-2 border-t border-stone-300/60 pt-4">
        {result.verdict.reasons.map((r, i) => (
          <p key={i} className="text-sm leading-relaxed text-stone-700">
            {r.text}
          </p>
        ))}
      </div>

      <p className="mt-4 text-sm text-stone-600">{confidenceWords(result.verdict.confidence)}</p>
    </section>
  )
}
