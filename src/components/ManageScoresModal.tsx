import { useState } from 'react'
import { useAppStore } from '../store'

interface Props {
  open: boolean
  onClose: () => void
}

export function ManageScoresModal({ open, onClose }: Props) {
  const scores = useAppStore((s) => s.scores)
  const removeScore = useAppStore((s) => s.removeScore)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (!open) return null

  const allSelected = scores.length > 0 && selected.size === scores.length

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelected(allSelected ? new Set() : new Set(scores.map((s) => s.id)))
  }

  const handleDelete = () => {
    if (selected.size === 0) return
    const count = selected.size
    if (!confirm(`¿Eliminar ${count} partitura${count === 1 ? '' : 's'}?`)) return
    selected.forEach((id) => removeScore(id))
    setSelected(new Set())
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal manage-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Gestionar partituras</h2>
        <p className="manage-help">
          Selecciona las partituras que quieres eliminar. Esta acción no se
          puede deshacer.
        </p>

        <button type="button" className="btn-secondary manage-select-all" onClick={selectAll}>
          {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
        </button>

        <ul className="manage-list">
          {scores.map((s) => (
            <li key={s.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                />
                <span className="manage-item">
                  <strong>{s.title}</strong>
                  <span className="meta">
                    {s.repertoire}
                    {s.tags.length > 0 && ` · ${s.tags.join(', ')}`}
                  </span>
                </span>
              </label>
            </li>
          ))}
          {scores.length === 0 && <li className="empty">No hay partituras</li>}
        </ul>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={selected.size === 0}
            onClick={handleDelete}
          >
            Eliminar seleccionadas ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
