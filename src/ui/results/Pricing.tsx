/**
 * O3 - what it should cost.
 *
 * Two figures, because they are genuinely different and the gap between
 * them is where borrowers get caught: the rate they will be quoted, and what
 * the loan actually costs once the fee is taken out of the money before it
 * reaches them. The fee is broken out rather than folded in, because a
 * borrower who knows the fee exists can ask about it.
 */

import type { EngineTrace } from '../../engine/index'
import type { CopilotResult } from '../../types'
import { LABELS } from '../copy'
import { money } from '../format'
import { ConfidenceNote, PercentBand, Why } from '../primitives'

export function Pricing({ result, trace }: { result: CopilotResult; trace: EngineTrace }) {
  const pricing = trace.pricing
  const apr = result.fairRate

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-stone-900">{LABELS.rateBand}</h2>

      {pricing && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-sm font-medium text-stone-600">The rate you should be offered</p>
          <div className="mt-1">
            <PercentBand low={pricing.rateBand.low} high={pricing.rateBand.high} />
          </div>
          <p className="mt-1 text-sm text-stone-500">a year</p>
        </div>
      )}

      <div className="rounded-2xl border-2 border-stone-300 bg-white p-4">
        <p className="text-sm font-medium text-stone-600">{LABELS.allIn}</p>
        <div className="mt-1">
          <PercentBand low={apr.band.low as number} high={apr.band.high as number} />
        </div>
        <ConfidenceNote confidence={apr.confidence} />

        {pricing && (
          <div className="mt-4 space-y-1 border-t border-stone-200 pt-3 text-sm">
            <Row label="Fee for arranging the loan" value={money(pricing.processingFeeAmount)} />
            <Row label="Tax on that fee" value={money(pricing.gstOnFees)} />
            {pricing.otherCharges > 0 && (
              <Row label="Paperwork and valuation" value={money(pricing.otherCharges)} />
            )}
            <p className="pt-2 text-sm leading-relaxed text-stone-600">
              These are usually taken out of the loan before the money reaches you. You would receive{' '}
              <strong>{money(pricing.netDisbursal)}</strong>, and pay interest on the full amount — which
              is why the real cost is higher than the rate you are quoted.
            </p>
          </div>
        )}

        <Why reasons={apr.reasons} />
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-stone-600">{label}</span>
      <span className="font-medium text-stone-900">{value}</span>
    </div>
  )
}
