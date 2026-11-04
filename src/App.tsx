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
  const setScores = useAppStore((s) => s.setScores)
  const setCurrentScore = useAppStore((s) => s.setCurrentScore)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const [presentation, setPresentation] = useState(false)

  useEffect(() => {
    if (scores.length === 0) {
      setScores(sampleScores)
      setCurrentScore(sampleScores[0].id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <header className="app-header">
        <h1>Score Player</h1>
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
