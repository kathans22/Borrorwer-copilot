/**
 * O4 - what the household can pay each month.
 *
 * The trade-off table is the honest version of the thing every salesperson
 * leads with. A longer loan means a smaller payment, which is the number
 * they will show you; it also means more interest in total, which is the
 * number they will not. Both columns, side by side.
 *
 * The stress case is labelled as a scenario. It is not a forecast about this
 * borrower's life, and presenting it as one would be both wrong and
 * frightening.
 */

import type { EngineTrace } from '../../engine/index'
import type { CopilotResult } from '../../types'
import { LABELS } from '../copy'
import { duration, money, percent } from '../format'
import { ConfidenceNote, MoneyBand, Why } from '../primitives'

export function Monthly({ result, trace }: { result: CopilotResult; trace: EngineTrace }) {
  const emi = result.emiCeiling
  const options = trace.tenureOptions
  const stress = trace.stress

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-stone-900">{LABELS.monthly}</h2>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <MoneyBand low={emi.band.low as number} high={emi.band.high as number} />
        <p className="mt-1 text-sm text-stone-500">a month</p>
        <ConfidenceNote confidence={emi.confidence} />
        <Why reasons={emi.reasons} />
      </div>

      {options.length > 1 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <h3 className="text-base font-medium text-stone-900">{LABELS.tenureTable}</h3>
          <p className="mt-1 text-sm text-stone-600">
            The same loan, paid back over different lengths of time.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-2 pr-3 font-medium">Paid over</th>
                  <th className="py-2 pr-3 text-right font-medium">Each month</th>
                  <th className="py-2 text-right font-medium">Extra you pay</th>
                </tr>
              </thead>
              <tbody>
                {options.map((o) => (
                  <tr key={o.tenureMonths} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 pr-3 text-stone-700">{duration(o.tenureMonths)}</td>
                    <td className="py-2 pr-3 text-right font-medium text-stone-900">{money(o.emi)}</td>
                    <td className="py-2 text-right text-stone-700">{money(o.totalInterest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            A smaller payment each month always costs more in total. Neither row is the right answer —
            it depends on how much room your household has.
          </p>
        </div>
      )}

      {stress && (
        <div className="rounded-2xl border border-stone-300 bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">A scenario, not a prediction</p>
          <h3 className="mt-1 text-base font-medium text-stone-900">{LABELS.stress}</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">
            If your income dropped by {percent(stress.incomeDropPct, 0)} for a while
            {stress.rateRiseApplied > 0 && ` and rates rose by ${percent(stress.rateRiseApplied)}`}, the
            payment would be {money(stress.stressedEmi)} against the {money(stress.stressedSafeCarry)} your
            household could then manage.
          </p>
          <p className="mt-2 text-sm font-medium text-stone-900">
            {stress.passes
              ? 'It would still hold together.'
              : 'It would not hold together — which is why the figure above is smaller than the most you could take today.'}
          </p>
        </div>
      )}
    </section>
  )
}
