import { useEffect, useState } from 'react'
import { ScoreList } from './components/ScoreList'
import { ScoreViewer } from './components/ScoreViewer'
import { TransposeControls } from './components/TransposeControls'
import { PresentationMode } from './components/PresentationMode'
import { AddScoreModal } from './components/AddScoreModal'
import { UpdatePrompt } from './components/UpdatePrompt'
import { stopPreviewAudio } from './lib/previewAudio'
import { resetBackingRate, stopBackingTrack } from './lib/backingTrack'
import { stopMidi } from './lib/midiPlayback'
import { useAppStore } from './store'
import { sampleScores } from './data/sampleScores'
import './App.css'

type MobileView = 'library' | 'preview'

function useCompactLayout() {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches
  )

  useEffect(() => {
    const query = window.matchMedia('(max-width: 860px)')
    const onChange = (e: MediaQueryListEvent) => setCompact(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return compact
}

function App() {
  const scores = useAppStore((s) => s.scores)
  const initialized = useAppStore((s) => s.initialized)
  const setScores = useAppStore((s) => s.setScores)
  const setCurrentScore = useAppStore((s) => s.setCurrentScore)
  const setInitialized = useAppStore((s) => s.setInitialized)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const [presentation, setPresentation] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('library')
  const [showAdd, setShowAdd] = useState(false)
  const compact = useCompactLayout()

  useEffect(() => {
    if (initialized) return

    if (scores.length === 0) {
      setScores(sampleScores)
      setCurrentScore(sampleScores[0].id)
    }
    setInitialized()
  }, [initialized, scores.length, setScores, setCurrentScore, setInitialized])

  const openPresentation = () => {
    stopPreviewAudio()
    stopBackingTrack()
    resetBackingRate()
    stopMidi()
    setPresentation(true)
  }

  const showPreview = !compact || mobileView === 'preview'

  return (
    <div className={`app app--${mobileView}`}>
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
          <button
            className="header-icon-btn"
            onClick={() => setShowAdd(true)}
            title="Nueva partitura"
            aria-label="Nueva partitura"
          >
            +
          </button>
          <div className="header-transpose">
            <TransposeControls compact={compact} />
          </div>
          {!compact && currentScoreId && (
            <button
              className="btn-present"
              onClick={openPresentation}
              title="Modo presentación / live"
            >
              ⛶ Presentar
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        <ScoreList onSelectScore={() => compact && setMobileView('preview')} />
        {showPreview && (
          <section className="viewer-area">
            <ScoreViewer
              onBack={compact ? () => setMobileView('library') : undefined}
              onPresent={openPresentation}
            />
          </section>
        )}
      </main>

      <PresentationMode
        open={presentation}
        onClose={() => setPresentation(false)}
      />
      <AddScoreModal open={showAdd} onClose={() => setShowAdd(false)} />
      <UpdatePrompt />
    </div>
  )
}

export default App
