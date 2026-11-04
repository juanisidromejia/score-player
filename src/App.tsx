import { useEffect, useState } from 'react'
import { ScoreList } from './components/ScoreList'
import { ScoreViewer } from './components/ScoreViewer'
import { TransposeControls } from './components/TransposeControls'
import { PresentationMode } from './components/PresentationMode'
import { useAppStore } from './store'
import { sampleScores } from './data/sampleScores'
import './App.css'

function App() {
  const scores = useAppStore((s) => s.scores)
  const initialized = useAppStore((s) => s.initialized)
  const setScores = useAppStore((s) => s.setScores)
  const setCurrentScore = useAppStore((s) => s.setCurrentScore)
  const setInitialized = useAppStore((s) => s.setInitialized)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const [presentation, setPresentation] = useState(false)

  useEffect(() => {
    if (initialized) return

    if (scores.length === 0) {
      setScores(sampleScores)
      setCurrentScore(sampleScores[0].id)
    }
    setInitialized()
  }, [initialized, scores.length, setScores, setCurrentScore, setInitialized])

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M9 17V5.5L19 4v10.5" strokeLinecap="round" strokeLinejoin="round" />
              <ellipse cx="6.5" cy="17.5" rx="2.5" ry="2" fill="currentColor" stroke="none" />
              <ellipse cx="16.5" cy="15" rx="2.5" ry="2" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div className="brand-text">
            <h1>Score Player</h1>
            <span className="brand-tag">atril · transporte · setlist</span>
          </div>
        </div>

        <div className="header-actions">
          <TransposeControls />
          {currentScoreId && (
            <button
              className="btn-present"
              onClick={() => setPresentation(true)}
              title="Modo presentación / live"
            >
              ⛶ Presentar
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        <ScoreList />
        <section className="viewer-area">
          <ScoreViewer />
        </section>
      </main>

      <PresentationMode
        open={presentation}
        onClose={() => setPresentation(false)}
      />
    </div>
  )
}

export default App
