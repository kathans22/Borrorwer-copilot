/**
 * Keeping the assessment across a refresh, without it leaving the phone.
 *
 * The brief says no personal data is stored. Our reading, recorded as PRV-01
 * in RULES.md: that is about a server holding somebody's finances, not about
 * a browser remembering what they typed two minutes ago. Losing a
 * part-finished assessment to an accidental refresh would be its own small
 * cruelty, and the borrower can wipe it at any point with one visible
 * control.
 *
 * Nothing here makes a network call. There is no analytics, no reporting and
 * no identifier of any kind - the whole application has no server to send
 * anything to.
 */

import type { BorrowerAnswers } from '../types'

const KEY = 'borrower-copilot.answers.v1'

export function loadAnswers(): BorrowerAnswers {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as BorrowerAnswers) : {}
  } catch {
    // A private window, cleared site data, or storage switched off. None of
    // those are errors worth showing somebody - they just start fresh.
    return {}
  }
}

export function saveAnswers(answers: BorrowerAnswers): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(answers))
  } catch {
    // Storage full or unavailable. The assessment still works for this
    // session; only the refresh-safety is lost, and silently is the right
    // way to lose it.
  }
}

export function clearAnswers(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do. If we could not write it, we cannot fail to remove it.
  }
}
