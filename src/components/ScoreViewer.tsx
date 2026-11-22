import { useAppStore } from '../store'
import { ScoreMetaEditor } from './ScoreMetaEditor'
import { AudioPlayer } from './AudioPlayer'
import { ScorePreview } from './ScorePreview'
import { TransposeControls } from './TransposeControls'

interface Props {
  onBack?: () => void
  onPresent: () => void
}

export function ScoreViewer({ onBack, onPresent }: Props) {
  const scores = useAppStore((s) => s.scores)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const previewNavigation = useAppStore((s) => s.previewNavigation)
  const current = scores.find((s) => s.id === currentScoreId)

  if (!current) {
    return (
      <div className="empty-score">
        <p>Selecciona una partitura o crea una nueva</p>
      </div>
    )
  }

  return (
    <div className="score-viewer">
      <div className="preview-toolbar">
        {onBack && (
          <button
            className="preview-back"
            onClick={onBack}
            title={previewNavigation.origin === 'set' ? 'Volver al Set' : 'Volver a la biblioteca'}
            aria-label={previewNavigation.origin === 'set' ? 'Volver al Set' : 'Volver a la biblioteca'}
          >
            ‹
          </button>
        )}

        <div className="score-header">
          <h2>{current.title}</h2>
          <div className="preview-meta">
            <span className="preview-repertoire">{current.repertoire || 'general'}</span>
            {current.tags.slice(0, 3).map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
            {current.hasAudio && (
              <span className="preview-has-audio" title="Backing track disponible">♪ audio</span>
            )}
          </div>
        </div>

        <button
          className="preview-present"
          onClick={onPresent}
          title="Abrir modo presentación"
        >
          ⛶ <span>Presentar</span>
        </button>
      </div>

      {onBack && (
        <div className="preview-transpose">
          <TransposeControls compact />
        </div>
      )}

      <details className="preview-admin">
        <summary aria-label="Opciones de la partitura">
          <span aria-hidden="true">⋯</span> Opciones
        </summary>
        <div className="preview-admin-body">
          <ScoreMetaEditor />
          <AudioPlayer />
        </div>
      </details>

      <ScorePreview />
    </div>
  )
}
