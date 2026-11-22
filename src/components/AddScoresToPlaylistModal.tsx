import { useEffect, useMemo, useState } from 'react'
import { useAppStore, type Playlist } from '../store'
import { normalize } from '../lib/visibleScores'

interface Props {
  playlist: Playlist
  onClose: () => void
}

export function AddScoresToPlaylistModal({ playlist, onClose }: Props) {
  const scores = useAppStore((s) => s.scores)
  const setPlaylistScores = useAppStore((s) => s.setPlaylistScores)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(playlist.scoreIds)
  )

  const inSet = useMemo(() => new Set(playlist.scoreIds), [playlist.scoreIds])

  const available = useMemo(() => {
    const q = normalize(query)
    if (!q) return scores
    return scores.filter(
      (s) =>
        normalize(s.title).includes(q) ||
        normalize(s.repertoire).includes(q) ||
        s.tags.some((t) => normalize(t).includes(q))
    )
  }, [scores, query])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const allFilteredSelected =
    available.length > 0 && available.every((s) => selected.has(s.id))

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      available.forEach((s) =>
        allFilteredSelected ? next.delete(s.id) : next.add(s.id)
      )
      return next
    })
  }

  const confirm = () => {
    if (selected.size === 0) return
    const kept = playlist.scoreIds.filter((id) => selected.has(id))
    const added = scores
      .map((s) => s.id)
      .filter((id) => !inSet.has(id) && selected.has(id))
    setPlaylistScores(playlist.id, [...kept, ...added])
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal selector-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Agregar partituras al set"
      >
        <h2>Agregar partituras</h2>
        <p className="selector-subtitle">
          Set: <strong>{playlist.name}</strong>
        </p>
        <p className="manage-help">
          Las partituras ya incluidas aparecen marcadas. Desmárcalas para
          quitarlas del set.
        </p>

        <input
          type="search"
          className="selector-search"
          placeholder="Buscar partitura o tag…"
          aria-label="Buscar partituras"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button type="button" className="btn-secondary selector-select-all" onClick={toggleAll}>
          {allFilteredSelected ? 'Deseleccionar visibles' : 'Seleccionar visibles'}
        </button>

        <ul className="manage-list selector-list">
          {available.map((s) => (
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
                {inSet.has(s.id) && <span className="selector-badge">En el set</span>}
              </label>
            </li>
          ))}
          {available.length === 0 && (
            <li className="empty">No hay partituras que coincidan</li>
          )}
        </ul>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={selected.size === 0}
            onClick={confirm}
          >
            Agregar al Set ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
