/**
 * The debt the borrower already has, shown before anything about new
 * borrowing.
 *
 * For somebody paying three per cent a month to a local lender, this is the
 * headline and the loan they came in asking about is a distraction. Putting
 * it after the new-borrowing numbers would bury the single most valuable
 * thing the assessment found.
 *
 * Note the monthly figure can go up while the total goes down. That is not a
 * presentation problem to be smoothed over - it is the actual trade, and it
 * is stated plainly, because informal debt is interest-only and never ends
 * on its own.
 */

import type { RefinanceResult } from '../../types'
import { LABELS } from '../copy'
import { duration, money } from '../format'
import { Why } from '../primitives'

export function Refinance({ refinance }: { refinance: RefinanceResult }) {
  const monthly = refinance.monthlySaving.band.low as number
  const total = refinance.totalSavingOverTenure.band.low as number
  const cost = refinance.switchingCost.band.low as number
  const breakEven = refinance.breakEven.band.low as number
  const worth = refinance.worthIt.value

  if (worth === 'stay') {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-stone-900">{LABELS.refinance}</h2>
        <p className="mt-2 text-base leading-relaxed text-stone-700">
          We looked at whether replacing what you already owe would help. On these numbers it would not
          — you are better off leaving it as it is.
        </p>
        <Why reasons={refinance.worthIt.reasons} label="How we worked that out" />
      </section>
    )
  }

  return (
    <section className="rounded-2xl border-2 border-teal-700 bg-teal-50 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-800">Start here</p>
      <h2 className="mt-1 text-xl font-semibold leading-snug text-stone-900">
        {worth === 'refinance'
          ? 'The money you already owe is costing you more than the loan you asked about'
          : 'Take this back to the lender you already have'}
      </h2>

      <p className="mt-3 text-3xl font-semibold text-stone-900">{money(Math.abs(total))}</p>
      <p className="text-sm text-stone-700">
        {total > 0 ? 'what moving it would save you in total' : 'what staying put would cost you'}
      </p>

      <dl className="mt-4 space-y-2 border-t border-teal-200 pt-4 text-sm">
        <Row
          label={monthly >= 0 ? 'Less each month' : 'More each month'}
          value={money(Math.abs(monthly))}
        />
        <Row label="Cost of making the switch" value={money(cost)} />
        <Row label="You are ahead from" value={`month ${Math.round(breakEven)}`} />
      </dl>

      {monthly < 0 && (
        <p className="mt-3 text-sm leading-relaxed text-stone-700">
          Yes, the monthly payment goes up. What you pay now only covers the interest — the amount you
          owe never comes down, so it never ends. The replacement finishes in{' '}
          {duration(refinance.breakEven.band.high as number)} or so and then you owe nothing.
        </p>
      )}

      <Why reasons={refinance.worthIt.reasons} label="How we worked that out" />
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-stone-700">{label}</dt>
      <dd className="font-semibold text-stone-900">{value}</dd>
    </div>
  )
}
