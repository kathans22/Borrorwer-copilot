/**
 * The fifth output.
 *
 * The brief asks that every borrower leaves with something they could do
 * tomorrow, so this is not a footer. Each action says what it would change
 * about this borrower's own numbers, because "get your credit score" is a
 * chore and "get your credit score, it would narrow your rate range from
 * eleven points to about two" is a reason to get out of the chair.
 *
 * It sits immediately under the verdict when the answer is no, which is the
 * one case where a list of next steps matters more than any number on the
 * page.
 */

import type { ActionStep } from '../../types'
import { LABELS, timeframeWords } from '../copy'

export function Actions({ actions }: { actions: ActionStep[] }) {
  if (actions.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-stone-900">{LABELS.actions}</h2>
      <ol className="space-y-3">
        {actions.map((a, i) => (
          <li key={i} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-800 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-base font-medium leading-snug text-stone-900">{a.text}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{a.changesWhat}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-stone-500">
                  {timeframeWords(a.timeframe)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
