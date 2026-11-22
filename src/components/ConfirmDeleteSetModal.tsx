import { useEffect } from 'react'
import type { Playlist } from '../store'

interface Props {
  playlist: Playlist
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDeleteSetModal({ playlist, onCancel, onConfirm }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal confirm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Eliminar set"
      >
        <h2>Eliminar set</h2>
        <p className="confirm-text">
          ¿Eliminar el set <strong>«{playlist.name}»</strong>? Se eliminará el
          repertorio, pero sus partituras originales se conservarán en la
          biblioteca.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm}>
            Eliminar set
          </button>
        </div>
      </div>
    </div>
  )
}
