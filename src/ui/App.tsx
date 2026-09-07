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
import { Intro } from './Intro'
import { Results } from './Results'
import { Wizard } from './Wizard'
import type { AnswerValue } from './QuestionInput'
import { clearAnswers, loadAnswers, saveAnswers } from './session'

type Screen = 'intro' | 'wizard' | 'results'

export function App() {
  const [answers, setAnswers] = useState<BorrowerAnswers>(() => loadAnswers())
  const [screen, setScreen] = useState<Screen>('intro')

  useEffect(() => {
    saveAnswers(answers)
  }, [answers])

  const answered = Object.keys(answers).length

  function handleAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }) as BorrowerAnswers)
  }

  function handleClear() {
    clearAnswers()
    setAnswers({})
    setScreen('intro')
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <main className="mx-auto w-full max-w-[420px] px-4 py-6 pb-16">
        {screen === 'intro' && (
          <Intro onStart={() => setScreen('wizard')} hasSaved={answered > 0} onClear={handleClear} />
        )}

        {screen === 'wizard' && (
          <Wizard
            answers={answers}
            onAnswer={handleAnswer}
            onFinish={() => setScreen('results')}
            onClear={handleClear}
          />
        )}

        {screen === 'results' && (
          <Results answers={answers} onBack={() => setScreen('wizard')} onClear={handleClear} />
        )}
      </main>
    </div>
  )
}
