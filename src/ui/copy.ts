/**
 * Screen copy that is not a reason.
 *
 * Explanations are never written here - those come from the engine, so that
 * what the borrower reads is what the engine actually did. This file holds
 * the fixed furniture: headings, labels, and the words used for confidence.
 *
 * Two standards apply to everything below.
 *
 * No trade vocabulary. The reader is somebody who rides a delivery bike and
 * takes in tailoring at home. If a sentence would not survive her reading it
 * once, on a phone, between jobs, it is the wrong sentence.
 *
 * Nothing that shames. "Your income doesn't stretch to this right now" is a
 * fact about arithmetic. "You cannot afford this" is a verdict on a person,
 * and it is also less useful, because it does not say what would change it.
 */

import type { Confidence, VerdictValue } from '../types'

/**
 * Confidence in words, because a colour or a bar says nothing to somebody
 * who is not already fluent in dashboards, and the brief asks the app to
 * say plainly when it is unsure.
 */
export function confidenceWords(c: Confidence): string {
  switch (c) {
    case 'high':
      return 'We are fairly confident of this'
    case 'medium':
      return 'This is a reasonable estimate, not a quote'
    case 'low':
      return 'This is a wide guess for now — more answers will tighten it'
  }
}

export function confidenceShort(c: Confidence): string {
  switch (c) {
    case 'high':
      return 'fairly confident'
    case 'medium':
      return 'reasonable estimate'
    case 'low':
      return 'wide guess for now'
  }
}

/** The headline. Advice, with somewhere to go next. */
export function verdictHeadline(v: VerdictValue): string {
  switch (v) {
    case 'borrow':
      return 'This looks manageable'
    case 'borrow_less':
      return 'Yes — but for less than you asked'
    case 'do_not_borrow':
      return 'Not this loan, not right now'
  }
}

/**
 * The line under the headline. `do_not_borrow` in particular has to read as
 * advice with a path rather than as a door closing, and it sits directly
 * above the list of things that would change it.
 */
export function verdictSubhead(v: VerdictValue): string {
  switch (v) {
    case 'borrow':
      return 'The amount you asked for fits inside both what a lender would offer and what your household can carry.'
    case 'borrow_less':
      return 'A smaller loan works. The figure below is what fits without a bad month turning into a missed payment.'
    case 'do_not_borrow':
      return 'Taking this on now would put your household under real strain. That is not permanent — the steps below are what would change it, and some of them are worth more to you than the loan was.'
  }
}

export const LABELS = {
  lenderLikely: 'What a lender would probably offer',
  borrowerSafe: 'What you can carry comfortably',
  useWhich: 'Which number to go by',
  rateBand: 'What this should cost you',
  allIn: 'The real cost, including fees',
  monthly: 'What you can pay each month',
  tenureTable: 'Shorter loan, or smaller payments?',
  stress: 'If things got harder for a while',
  actions: 'What you can do about it',
  refinance: 'The money you already owe',
  why: 'Why this number?',
  whyWeAsk: 'Why are we asking?',
  dontKnow: "I don't know",
  seeResults: 'See my results now',
  clear: 'Clear my answers',
}

/** Timeframes, in words a person uses. */
export function timeframeWords(t: 'today' | 'weeks' | 'months'): string {
  switch (t) {
    case 'today':
      return 'You can do this today'
    case 'weeks':
      return 'A few weeks'
    case 'months':
      return 'A few months'
  }
}
