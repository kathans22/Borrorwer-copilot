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

import { buildNegotiationCard } from '../engine/negotiation'
import type { BorrowerAnswers } from '../types'
import { timeframeWords } from './copy'
import { duration, moneyBand, percent, percentBand } from './format'

export function Card({ answers, onBack }: { answers: BorrowerAnswers; onBack: () => void }) {
  const card = buildNegotiationCard(answers)

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

