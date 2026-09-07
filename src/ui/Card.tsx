/**
 * The negotiation card.
 *
 * One screen, held up at a counter, read while somebody is waiting for an
 * answer. Everything above the fold is a number the borrower decided before
 * they walked in - the rate they will accept, the payment they will agree
 * to, the amount they are actually asking for - so that the conversation
 * starts from their position rather than the lender's.
 *
 * The comparator below it is the part that changes the conversation. "That
 * seems high" is an opinion. "That is 259 rupees a month more than the best
 * rate I should get, which is about 15,500 over five years" is a
 * negotiation.
 */

import { useState } from 'react'
import {
  buildNegotiationCard,
  compareQuote,
  type Quote,
} from '../engine/negotiation'
import type { BorrowerAnswers } from '../types'
import { timeframeWords } from './copy'
import { duration, money, moneyBand, percent, percentBand } from './format'

export function Card({ answers, onBack }: { answers: BorrowerAnswers; onBack: () => void }) {
  const card = buildNegotiationCard(answers)
  const principal = card.safeAmount.band.high as number

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-stone-500 underline underline-offset-4 print:hidden"
      >
        Back to my results
      </button>

      {/* Everything a borrower needs in the first thirty seconds. */}
      <section className="rounded-2xl border-2 border-stone-900 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
          What I am asking for
        </p>

        <div className="mt-3 space-y-3">
          <Headline
            label="A fair rate for me"
            value={percentBand(card.fairRateBand.low as number, card.fairRateBand.high as number)}
            note="a year, before fees"
          />
          {/* Both render as ranges because the engine returned ranges. A
              single figure here would be a decision the arithmetic did not
              make, on the one screen where being wrong is most expensive. */}
          <Headline
            label="What I can pay each month"
            value={moneyBand(card.maxEmi.band.low as number, card.maxEmi.band.high as number)}
            note="I will not agree to go past the top of this"
          />
          <Headline
            label="What I am asking to borrow"
            value={moneyBand(card.safeAmount.band.low as number, card.safeAmount.band.high as number)}
            note={`what my household can carry over ${duration(card.tenureMonths)}`}
          />
        </div>
      </section>

      {/* The claim, with the four things behind it. A rate band on its own is
          an opinion; the same band with its reasons is an argument. */}
      <section className="rounded-2xl border border-stone-300 bg-stone-50 p-4">
        <h2 className="text-base font-semibold text-stone-900">Why that is fair for me</h2>
        <dl className="mt-3 space-y-2">
          {card.claimFactors.map((f) => (
            <div key={f.label} className="flex gap-2 text-sm">
              <dt className="w-36 shrink-0 text-stone-500">{f.label}</dt>
              <dd className="text-stone-800">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-base font-semibold text-stone-900">
          The number I will compare offers on
        </h2>
        <p className="mt-2 text-2xl font-semibold text-stone-900">
          {percentBand(card.allInApr.band.low as number, card.allInApr.band.high as number)}
        </p>
        <p className="text-sm text-stone-600">
          the true yearly cost, counting the fee — not the rate on the poster
        </p>
        <p className="mt-3 text-sm leading-relaxed text-stone-700">
          {card.feeAssumption.stated
            ? `I am counting the ${percent(card.feeAssumption.pct)} fee you told me about, plus tax on it, taken out before the money reaches me.`
            : `I am assuming a ${percent(card.feeAssumption.pct)} fee plus tax, taken out before the money reaches me. If yours is different, tell me and I will work it out again.`}
        </p>
      </section>

      <Comparator card={card} principal={principal} />

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-base font-semibold text-stone-900">What I will ask you</h2>
        <ol className="mt-3 space-y-3">
          {card.questions.map((q, i) => (
            <li key={i}>
              <p className="text-base font-medium leading-snug text-stone-900">
                {i + 1}. {q.question}
              </p>
              <p className="mt-1 text-sm text-stone-500">{q.because}</p>
            </li>
          ))}
        </ol>
      </section>

      {card.actions.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="text-base font-semibold text-stone-900">Before I sign anything</h2>
          <ul className="mt-3 space-y-3">
            {card.actions.map((a, i) => (
              <li key={i}>
                <p className="text-base leading-snug text-stone-900">{a.text}</p>
                <p className="mt-1 text-sm text-stone-600">{a.changesWhat}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">
                  {timeframeWords(a.timeframe)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="pb-4 text-center text-xs text-stone-400 print:hidden">
        These are my own figures, worked out before I came in.
      </p>
    </div>
  )
}

function Headline({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <p className="text-sm text-stone-600">{label}</p>
      <p className="text-2xl font-bold leading-tight text-stone-900">{value}</p>
      <p className="text-xs text-stone-500">{note}</p>
    </div>
  )
}

/**
 * The quote comparator.
 *
 * Pre-filled when the borrower already told us about an offer, and editable
 * either way, because the real use of this is standing at a counter typing in
 * what has just been said out loud.
 */
function Comparator({
  card,
  principal,
}: {
  card: ReturnType<typeof buildNegotiationCard>
  principal: number
}) {
  const [quote, setQuote] = useState<Quote>(
    card.prefilledQuote ?? {
      annualRatePct: 0,
      tenureMonths: card.tenureMonths,
      processingFeePct: card.feeAssumption.pct,
    },
  )

  const ready = quote.annualRatePct > 0 && quote.tenureMonths > 0
  const c = ready ? compareQuote(card, quote, principal) : null

  return (
    <section className="rounded-2xl border-2 border-teal-700 bg-teal-50 p-4">
      <h2 className="text-base font-semibold text-stone-900">Check an offer against this</h2>
      <p className="mt-1 text-sm text-stone-600">
        Type in what they just told you. Nothing leaves this phone.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Field
          label="Their rate"
          suffix="%"
          value={quote.annualRatePct}
          onChange={(n) => setQuote({ ...quote, annualRatePct: n })}
        />
        <Field
          label="Months"
          value={quote.tenureMonths}
          onChange={(n) => setQuote({ ...quote, tenureMonths: n })}
        />
        <Field
          label="Their fee"
          suffix="%"
          value={quote.processingFeePct}
          onChange={(n) => setQuote({ ...quote, processingFeePct: n })}
        />
      </div>

      {c && (
        <div className="mt-4 border-t border-teal-200 pt-4">
          <p className="text-sm text-stone-700">
            Their true yearly cost, once the fee is counted:{' '}
            <strong className="text-stone-900">{percent(c.quoteAllInPct)}</strong>
          </p>

          {c.judgement === 'fair' && (
            <p className="mt-3 text-base font-medium leading-relaxed text-emerald-900">
              This is a fair offer. It sits inside what someone in your position should be paying,
              and there is nothing here worth arguing about.
            </p>
          )}

          {c.judgement === 'cannot_judge_yet' && (
            <p className="mt-3 text-base leading-relaxed text-stone-800">
              We cannot tell you whether this is a fair price yet — your credit score has not been
              checked, so the range of what you might fairly be offered is too wide to judge against.
              Checking it is free, and it is the single thing that would settle this.
            </p>
          )}

          {c.judgement === 'above_fair' && (
            <p className="mt-3 text-base font-medium leading-relaxed text-stone-900">
              This is {percent(c.gapPoints)} above the most you should be paying.
            </p>
          )}

          {c.extraVsBestInr > 0 && (
            <div className="mt-3 rounded-xl bg-white p-3">
              <p className="text-3xl font-bold leading-tight text-stone-900">
                {money(c.extraVsBestInr)}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-stone-700">
                more than the best rate you should be able to get ({percent(c.bestRatePct)}), over{' '}
                {duration(c.tenureMonths)}. That is {money(c.extraMonthlyInr)} a month —{' '}
                {money(c.quoteEmiInr)} instead of {money(c.bestEmiInr)}.
              </p>
            </div>
          )}

          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            Worked out on {money(c.principalInr)} over {duration(c.tenureMonths)}, comparing the same
            amount and the same length of loan, and counting both fees.
          </p>
        </div>
      )}
    </section>
  )
}

function Field({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string
  value: number
  suffix?: string
  onChange: (n: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-stone-600">{label}</span>
      <div className="flex items-center rounded-xl border border-stone-300 bg-white px-2">
        <input
          inputMode="decimal"
          value={value === 0 ? '' : String(value)}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
          className="min-h-11 w-full bg-transparent py-2 text-base outline-none"
        />
        {suffix && <span className="text-sm text-stone-500">{suffix}</span>}
      </div>
    </label>
  )
}
