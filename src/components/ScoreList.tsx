import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store'
import { useVisibleScores } from '../lib/visibleScores'
import { AddScoreModal } from './AddScoreModal'
import { PlaylistPanel } from './PlaylistPanel'

export function ScoreList() {
  const scores = useAppStore((s) => s.scores)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const setCurrentScore = useAppStore((s) => s.setCurrentScore)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const selectedRepertoire = useAppStore((s) => s.selectedRepertoire)
  const setSelectedRepertoire = useAppStore((s) => s.setSelectedRepertoire)
  const selectedTag = useAppStore((s) => s.selectedTag)
  const setSelectedTag = useAppStore((s) => s.setSelectedTag)
  const removeScore = useAppStore((s) => s.removeScore)

  const [showAdd, setShowAdd] = useState(false)
  const [tab, setTab] = useState<'scores' | 'sets'>('scores')
  const [menuOpen, setMenuOpen] = useState<{ id: string; x: number; y: number } | null>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    scores.forEach((s) => s.tags.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [scores])

  const repertoires = useMemo(() => {
    const set = new Set(scores.map((s) => s.repertoire).filter(Boolean))
    return Array.from(set).sort()
  }, [scores])

  const filtered = useVisibleScores()

  const handleDelete = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setMenuOpen(null)
    if (confirm(`¿Eliminar "${title}"?`)) {
      removeScore(id)
    }
  }

  const handleMenuClick = (e: React.MouseEvent, scoreId: string) => {
    e.stopPropagation()
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuOpen({ id: scoreId, x: rect.left, y: rect.bottom })
  }

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.context-menu') || target.closest('.btn-menu')) return
      setMenuOpen(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <aside className="score-list">
      <div className="list-tabs">
        <button
          className={tab === 'scores' ? 'active' : ''}
          onClick={() => setTab('scores')}
        >
          Partituras
        </button>
        <button
          className={tab === 'sets' ? 'active' : ''}
          onClick={() => setTab('sets')}
        >
          Sets
        </button>
      </div>

      {tab === 'sets' ? (
        <PlaylistPanel />
      ) : (
        <>
          <div className="search-box">
            <input
              type="search"
              placeholder="Buscar partitura o tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-section">
            <div className="repertoire-filter">
              <button
                className={!selectedRepertoire && !selectedTag ? 'active' : ''}
                onClick={() => {
                  setSelectedRepertoire(null)
                  setSelectedTag(null)
                }}
              >
                Todos
              </button>
              {repertoires.map((r) => (
                <button
                  key={r}
                  className={selectedRepertoire === r ? 'active' : ''}
                  onClick={() => setSelectedRepertoire(r)}
                >
                  {r}
                </button>
              ))}
            </div>

            {allTags.length > 0 && (
              <div className="tag-filter">
                {allTags.map((t) => (
                  <button
                    key={t}
                    className={`tag-chip ${selectedTag === t ? 'active' : ''}`}
                    onClick={() =>
                      setSelectedTag(selectedTag === t ? null : t)
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="list-actions">
            <button className="btn-primary full" onClick={() => setShowAdd(true)}>
              + Nueva partitura
            </button>
          </div>

          <ul>
            {filtered.map((s) => (
              <li
                key={s.id}
                className={s.id === currentScoreId ? 'active' : ''}
                onClick={() => setCurrentScore(s.id)}
              >
                <div className="score-item-main">
                  <strong>
                    {s.title}
                    {s.hasAudio && <span className="audio-badge" title="Tiene backing track">♪</span>}
                  </strong>
                  <span className="meta">{s.repertoire}</span>
                  {s.tags.length > 0 && (
                    <div className="mini-tags">
                      {s.tags.slice(0, 3).map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="btn-menu"
                  title="Opciones"
                  aria-label={`Opciones para ${s.title}`}
                  onClick={(e) => handleMenuClick(e, s.id)}
                >
                  ⋮
                </button>
                {menuOpen && menuOpen.id === s.id && (
                  <div className="context-menu" style={{ left: menuOpen.x, top: menuOpen.y }}>
                    <button
                      className="context-item"
                      onClick={() => {
                        setMenuOpen(null)
                        setCurrentScore(s.id)
                      }}
                    >
                      Ver partitura
                    </button>
                    <button
                      className="context-item danger"
                      onClick={(e) => handleDelete(s.id, s.title, e)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="empty">No hay partituras</li>
            )}
          </ul>
        </>
      )}

      <AddScoreModal open={showAdd} onClose={() => setShowAdd(false)} />
    </aside>
  )
}
