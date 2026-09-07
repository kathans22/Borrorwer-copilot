/**
 * The results screen, in the order the brief asks for - with one deliberate
 * exception.
 *
 * When the borrower is carrying expensive debt, the refinance finding comes
 * before any of the new-borrowing numbers, and when the answer is no, the
 * list of things they can do comes straight after the verdict rather than at
 * the bottom of the page. Both are cases where the most useful thing on the
 * screen is not the thing they came in asking about.
 */

import { computeWithTrace } from '../engine/index'
import type { BorrowerAnswers } from '../types'
import { LABELS } from './copy'
import { Button } from './primitives'
import { Actions } from './results/Actions'
import { MaxAmount } from './results/MaxAmount'
import { Monthly } from './results/Monthly'
import { Pricing } from './results/Pricing'
import { Refinance } from './results/Refinance'
import { Verdict } from './results/Verdict'

export function Results({
  answers,
  onBack,
  onCard,
  onClear,
}: {
  answers: BorrowerAnswers
  onBack: () => void
  onCard: () => void
  onClear: () => void
}) {
  const { result, trace } = computeWithTrace(answers)
  const saidNo = result.verdict.value === 'do_not_borrow'

  return (
    <div className="space-y-6">
      <Verdict result={result} />

      {/* A refusal without a path is the failure this whole thing exists to
          avoid, so the next steps come first when the answer is no. */}
      {saidNo && <Actions actions={result.actions} />}

      {result.refinance && <Refinance refinance={result.refinance} />}

      <MaxAmount result={result} />
      <Pricing result={result} trace={trace} />
      <Monthly result={result} trace={trace} />

      {!saidNo && <Actions actions={result.actions} />}

      <div className="space-y-3 border-t border-stone-200 pt-6">
        <Button onClick={onCard}>Get my card for the counter</Button>
        <p className="text-center text-sm leading-relaxed text-stone-500">
          One screen to hold up when somebody quotes you a rate.
        </p>
        <Button onClick={onBack} variant="secondary">
          Answer more questions to sharpen this
        </Button>
        <button
          type="button"
          onClick={onClear}
          className="w-full text-center text-sm text-stone-500 underline underline-offset-4"
        >
          {LABELS.clear}
        </button>
        <p className="pt-2 text-center text-xs leading-relaxed text-stone-400">
          Everything you typed stays on this phone. Nothing is sent anywhere, and clearing your
          answers removes it for good.
        </p>
      </div>
    </div>
  )
}
