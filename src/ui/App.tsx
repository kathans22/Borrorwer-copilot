/**
 * The shell: three screens and the answers that move between them.
 *
 * No router. There are three states, the back button is a button on the
 * page, and adding a dependency to manage that would be more machinery than
 * the problem deserves.
 *
 * Answers live here and are written to the phone's own storage on every
 * change, so a dropped connection or an accidental refresh never costs
 * somebody a part-finished assessment.
 */

import { useEffect, useState } from 'react'
import type { BorrowerAnswers } from '../types'
import { Card } from './Card'
import { Intro } from './Intro'
import { Results } from './Results'
import { Wizard } from './Wizard'
import type { AnswerValue } from './QuestionInput'
import { clearAnswers, loadAnswers, saveAnswers } from './session'

type Screen = 'intro' | 'wizard' | 'results' | 'card'

/**
 * The card gets a real address, because it is a thing somebody opens on its
 * own - at a counter, from a bookmark, with the rest of the assessment behind
 * them. Everything else is a step in one flow and does not need one.
 *
 * Done with the history API rather than a routing library: there is exactly
 * one addressable screen, and a dependency to manage that would be more
 * machinery than the problem deserves.
 */
const CARD_PATH = '/card'

function screenFromPath(): Screen | null {
  return typeof window !== 'undefined' && window.location.pathname.endsWith(CARD_PATH)
    ? 'card'
    : null
}

export function App() {
  const [answers, setAnswers] = useState<BorrowerAnswers>(() => loadAnswers())
  const [screen, setScreen] = useState<Screen>(() => screenFromPath() ?? 'intro')

  useEffect(() => {
    saveAnswers(answers)
  }, [answers])

  // Keep the address bar and the screen in step, so the back button behaves
  // the way somebody expects it to.
  useEffect(() => {
    const onPop = () => setScreen(screenFromPath() ?? 'intro')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function go(next: Screen) {
    const path = next === 'card' ? CARD_PATH : '/'
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    setScreen(next)
  }

  const answered = Object.keys(answers).length

  function handleAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }) as BorrowerAnswers)
  }

  function handleClear() {
    clearAnswers()
    setAnswers({})
    go('intro')
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <main className="mx-auto w-full max-w-[420px] px-4 py-6 pb-16">
        {screen === 'intro' && (
          <Intro onStart={() => go('wizard')} hasSaved={answered > 0} onClear={handleClear} />
        )}

        {screen === 'wizard' && (
          <Wizard
            answers={answers}
            onAnswer={handleAnswer}
            onFinish={() => go('results')}
            onClear={handleClear}
          />
        )}

        {screen === 'results' && (
          <Results
            answers={answers}
            onBack={() => go('wizard')}
            onCard={() => go('card')}
            onClear={handleClear}
          />
        )}

        {screen === 'card' && <Card answers={answers} onBack={() => go('results')} />}
      </main>
    </div>
  )
}
