/**
 * The small pieces every screen is built from.
 *
 * The important one is `Why`. Every figure the app shows has the engine's own
 * explanation attached to it, one tap away. No component writes explanation
 * copy of its own - if a number has no reason behind it, that is a gap in the
 * engine, and it should be visible as one rather than papered over here.
 */

import type { ReactNode } from 'react'
import type { Confidence, Reason } from '../types'
import { confidenceWords } from './copy'
import { inWords, money, moneyBand, percentBand } from './format'

export function Card({
  title,
  eyebrow,
  children,
}: {
  title?: string
  eyebrow?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      {eyebrow && (
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">{eyebrow}</p>
      )}
      {title && <h2 className="mb-3 text-lg font-semibold text-stone-900">{title}</h2>}
      {children}
    </section>
  )
}

/**
 * The engine's reasons, behind a tap.
 *
 * A disclosure rather than always-open text: the numbers have to be readable
 * at a glance on a small screen, but the explanation can never be more than
 * one tap away, and it is never optional for a number to have one.
 */
export function Why({ reasons, label = 'Why this number?' }: { reasons: Reason[]; label?: string }) {
  if (reasons.length === 0) return null
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-teal-800 underline decoration-dotted underline-offset-4">
        {label}
      </summary>
      <div className="mt-2 space-y-2 border-l-2 border-stone-200 pl-3">
        {reasons.map((r, i) => (
          <p key={i} className="text-sm leading-relaxed text-stone-600">
            {r.text}
          </p>
        ))}
      </div>
    </details>
  )
}

/** Confidence said in words, not as a colour somebody has to decode. */
export function ConfidenceNote({ confidence }: { confidence: Confidence }) {
  const tone =
    confidence === 'high'
      ? 'text-emerald-800'
      : confidence === 'medium'
        ? 'text-amber-800'
        : 'text-stone-600'
  return <p className={`mt-1 text-sm ${tone}`}>{confidenceWords(confidence)}</p>
}

/**
 * A money range. Renders as a range unless the engine genuinely returned one
 * figure, because showing a midpoint as though it were the answer is the
 * most misleading thing this interface could do.
 */
export function MoneyBand({
  low,
  high,
  size = 'lg',
}: {
  low: number
  high: number
  size?: 'lg' | 'md'
}) {
  const words = Math.round(low) === Math.round(high) ? inWords(low) : null
  return (
    <p
      className={
        size === 'lg'
          ? 'text-2xl font-semibold leading-tight text-stone-900'
          : 'text-lg font-semibold leading-tight text-stone-900'
      }
    >
      {moneyBand(low, high)}
      {words && <span className="ml-2 text-sm font-normal text-stone-500">about {words}</span>}
    </p>
  )
}

export function PercentBand({ low, high }: { low: number; high: number }) {
  return <p className="text-2xl font-semibold leading-tight text-stone-900">{percentBand(low, high)}</p>
}

export function Money({ value }: { value: number }) {
  return <span className="font-semibold text-stone-900">{money(value)}</span>
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'quiet'
  type?: 'button' | 'submit'
}) {
  const base =
    'w-full rounded-xl px-4 py-3 text-base font-medium transition active:scale-[0.99] min-h-12'
  const styles = {
    primary: 'bg-teal-800 text-white hover:bg-teal-900',
    secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50',
    quiet: 'text-stone-600 underline underline-offset-4 hover:text-stone-900',
  }
  return (
    <button type={type} onClick={onClick} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  )
}
