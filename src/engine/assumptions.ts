/**
 * The ledger of everything the engine assumed.
 *
 * Two things are treated as bugs rather than as states this engine is
 * allowed to be in:
 *
 *   ASR-01  an unanswered field coerced to zero without DEF-* permitting it
 *   ASR-03  a default applied whose Reason never reached the borrower
 *
 * Both failures are silent, and both are the exact failure this product
 * exists not to commit. A tool that quietly assumes no existing EMIs and
 * reports a bigger number is not a neutral tool, and the borrower has no
 * way of knowing. So the engine throws instead.
 *
 * Every module that reaches for a value the borrower did not give records
 * it here, together with the Reason it emitted. `assertLedgerIsHonest` then
 * checks the finished result rather than the intent: the Reason has to have
 * actually survived into the output the borrower reads.
 */

import {
  ASSERT_EVERY_DEFAULT_HAS_A_REASON,
  ASSERT_NO_UNJUSTIFIED_ZERO_COERCION,
  ZERO_COERCION_JUSTIFIED,
} from '../rules/rules.config'
import type { AnswerFieldId, Reason } from '../types'

export type Assumption = {
  field: AnswerFieldId
  value: number | string | boolean
  /** The Reason emitted when this default fired. */
  reason: Reason
  /** Set where the value came out as zero, which ASR-01 polices. */
  isZero: boolean
}

export type Ledger = {
  record: (field: AnswerFieldId, value: number | string | boolean, reason: Reason) => void
  entries: () => Assumption[]
}

export function createLedger(): Ledger {
  const entries: Assumption[] = []
  return {
    record(field, value, reason) {
      entries.push({ field, value, reason, isZero: value === 0 })
    },
    entries() {
      return entries
    },
  }
}

/**
 * ASR-01 - Zero is the most dangerous default in lending arithmetic. Zero
 * expenses, zero existing EMIs and zero informal debt all make a borrower
 * look richer than they are, and none of them is visible in the output.
 *
 * A zero is allowed only where `ZERO_COERCION_JUSTIFIED` records why it does
 * not flatter the borrower.
 */
export function assertNoUnjustifiedZero(ledger: Ledger): void {
  if (!ASSERT_NO_UNJUSTIFIED_ZERO_COERCION) return

  for (const entry of ledger.entries()) {
    if (!entry.isZero) continue
    const justification = ZERO_COERCION_JUSTIFIED[entry.field]
    if (!justification) {
      throw new Error(
        `ASR-01: '${entry.field}' was assumed to be zero with nothing in DEF-* justifying it. ` +
          `A zero here makes the borrower look more affordable than they are and is invisible in the output. ` +
          `Either give the field a non-zero default, or add it to ZERO_COERCION_JUSTIFIED with the reason it does not flatter them.`,
      )
    }
  }
}

/**
 * ASR-03 - A default that fired but never reached the borrower is a silent
 * assumption, checked against the finished output rather than against what
 * the engine meant to do.
 *
 * `emitted` is every Reason that survived into the result the borrower
 * reads. If an assumption's Reason is not among them, it was computed with
 * and then dropped somewhere between here and the screen.
 */
export function assertEveryDefaultWasExplained(ledger: Ledger, emitted: Reason[]): void {
  if (!ASSERT_EVERY_DEFAULT_HAS_A_REASON) return

  const seen = new Set(emitted.map((r) => r.text))
  const orphaned = ledger
    .entries()
    .filter((e) => !seen.has(e.reason.text))
    .map((e) => e.field)

  if (orphaned.length > 0) {
    throw new Error(
      `ASR-03: the engine assumed a value for ${[...new Set(orphaned)].join(', ')} ` +
        `but the explanation never reached the borrower. Every default has to be visible and correctable ` +
        `(DEF-21). Route the Reason into an output the interface shows, or stop applying the default.`,
    )
  }
}

/** Both assertions, run over the finished result. */
export function assertLedgerIsHonest(ledger: Ledger, emitted: Reason[]): void {
  assertNoUnjustifiedZero(ledger)
  assertEveryDefaultWasExplained(ledger, emitted)
}
