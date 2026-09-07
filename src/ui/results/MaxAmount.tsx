/**
 * O2 - the two numbers, and which one to go by.
 *
 * These are deliberately given equal room and different colouring. They are
 * not a number and a caveat: they are two answers to two different
 * questions, and the gap between them is the thing this whole application
 * exists to show. For a borrower whose income is real but undocumented, or
 * whose household is tighter than a payslip suggests, they differ by three
 * or four times.
 *
 * `useWhich` is a computed field, not a design decision - the engine works
 * out which figure to lead with and why, and this component only renders it.
 */

import type { CopilotResult } from '../../types'
import { LABELS } from '../copy'
import { ConfidenceNote, MoneyBand, Why } from '../primitives'

export function MaxAmount({ result }: { result: CopilotResult }) {
  const { lenderLikely, borrowerSafe, useWhich, useWhichReason } = result.maxAmount
  const leading = useWhich === 'borrowerSafe' ? borrowerSafe : lenderLikely

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-stone-900">How much you could borrow</h2>

      <div className="grid gap-3">
        <div
          className={`rounded-2xl border p-4 ${
            useWhich === 'lenderLikely'
              ? 'border-teal-300 bg-teal-50'
              : 'border-stone-200 bg-white'
          }`}
        >
          <p className="text-sm font-medium text-stone-600">{LABELS.lenderLikely}</p>
          <div className="mt-1">
            <MoneyBand low={lenderLikely.band.low as number} high={lenderLikely.band.high as number} />
          </div>
          <ConfidenceNote confidence={lenderLikely.confidence} />
          <Why reasons={lenderLikely.reasons} />
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            useWhich === 'borrowerSafe'
              ? 'border-teal-300 bg-teal-50'
              : 'border-stone-200 bg-white'
          }`}
        >
          <p className="text-sm font-medium text-stone-600">{LABELS.borrowerSafe}</p>
          <div className="mt-1">
            <MoneyBand low={borrowerSafe.band.low as number} high={borrowerSafe.band.high as number} />
          </div>
          <ConfidenceNote confidence={borrowerSafe.confidence} />
          <Why reasons={borrowerSafe.reasons} />
        </div>
      </div>

      {/* The engine's own answer to "so which is it?", given the weight it
          deserves rather than tucked underneath as a note. */}
      <div className="rounded-2xl border-2 border-teal-700 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-teal-800">{LABELS.useWhich}</p>
        <p className="mt-1 text-base font-medium leading-relaxed text-stone-900">
          {useWhichReason.text}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Go by the {useWhich === 'borrowerSafe' ? 'second' : 'first'} figure above.
        </p>
      </div>

      {leading.wouldNarrow.length > 0 && (
        <p className="text-sm text-stone-500">
          Telling us about your {leading.wouldNarrow.slice(0, 2).map(readable).join(' and ')} would
          tighten this range.
        </p>
      )}
    </section>
  )
}

/** Field ids are for the engine. This is what a person calls the same thing. */
function readable(field: string): string {
  const words: Record<string, string> = {
    householdExpensesMonthly: 'monthly spending',
    existingEmiMonthly: 'existing loan payments',
    rentMonthly: 'rent',
    dependents: 'dependants',
    savingsBuffer: 'savings',
    cityTier: 'town or city',
    incomeProof: 'income paperwork',
    employmentType: 'work',
    itrIncomeAnnual: 'tax return',
    creditScore: 'credit score',
    propertyValue: 'property',
    guaranteedIncomeMonthly: 'quietest month',
    informalDebtOutstanding: 'other borrowing',
    creditCardOutstanding: 'card balance',
    upcomingExpenses12m: 'big costs coming up',
    hasCoApplicant: 'household earners',
    coApplicantIncomeProof: "co-applicant's paperwork",
    incomeStability: 'how steady your income is',
    timeInCurrentWork: 'how long you have done this work',
    lenderType: 'who has quoted you',
    quotedProcessingFee: 'the fee you were quoted',
  }
  return words[field] ?? field
}
