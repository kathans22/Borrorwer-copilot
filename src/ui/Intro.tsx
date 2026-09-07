/**
 * The first screen.
 *
 * Says what this is, who it is for and what it will not do, in the fewest
 * words that survive being read once on a phone. The promise that nothing
 * leaves the device is made here rather than buried in a policy, because it
 * is the reason somebody would be willing to type the numbers in the first
 * place.
 */

import { Button } from './primitives'

export function Intro({ onStart, hasSaved, onClear }: { onStart: () => void; hasSaved: boolean; onClear: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold leading-tight text-stone-900">
          Before you take that loan
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-700">
          Answer about ten questions and we will tell you four things: whether to borrow, how much is
          safe for you, what it should cost, and what you can pay each month.
        </p>
      </div>

      <ul className="space-y-3 text-base leading-relaxed text-stone-700">
        <li className="flex gap-3">
          <span aria-hidden className="text-teal-800">
            •
          </span>
          <span>
            We tell you what your household can carry, not just what a lender will hand you. They are
            rarely the same number.
          </span>
        </li>
        <li className="flex gap-3">
          <span aria-hidden className="text-teal-800">
            •
          </span>
          <span>
            Every figure comes with the reason behind it. If you disagree with something we assumed,
            you can change it.
          </span>
        </li>
        <li className="flex gap-3">
          <span aria-hidden className="text-teal-800">
            •
          </span>
          <span>
            &ldquo;I don&rsquo;t know&rdquo; is a real answer. We will show you a wider range and say
            so, rather than guess.
          </span>
        </li>
        <li className="flex gap-3">
          <span aria-hidden className="text-teal-800">
            •
          </span>
          <span>
            Nothing you type leaves this phone. There is nowhere for it to go — no account, no server.
          </span>
        </li>
      </ul>

      <div className="space-y-3">
        <Button onClick={onStart}>{hasSaved ? 'Carry on where I left off' : 'Start'}</Button>
        {hasSaved && (
          <button
            type="button"
            onClick={onClear}
            className="w-full text-center text-sm text-stone-500 underline underline-offset-4"
          >
            Start again from the beginning
          </button>
        )}
      </div>

      <p className="text-xs leading-relaxed text-stone-400">
        This is guidance, not an offer of credit. The figures are estimates of what the market would
        likely do, and no lender is bound by them.
      </p>
    </div>
  )
}
