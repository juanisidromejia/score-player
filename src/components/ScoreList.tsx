import { useMemo, useState } from 'react'
import { useAppStore } from '../store'
import { useVisibleScores } from '../lib/visibleScores'
import { ManageScoresModal } from './ManageScoresModal'
import { PlaylistPanel } from './PlaylistPanel'

interface Props {
  activeTab?: 'scores' | 'sets'
  onTabChange?: (tab: 'scores' | 'sets') => void
  onSelectScore?: () => void
  onPresent?: () => void
}

export function ScoreList({ activeTab, onTabChange, onSelectScore, onPresent }: Props) {
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const openScore = useAppStore((s) => s.openScore)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const selectedRepertoire = useAppStore((s) => s.selectedRepertoire)
  const setSelectedRepertoire = useAppStore((s) => s.setSelectedRepertoire)
  const selectedTag = useAppStore((s) => s.selectedTag)
  const setSelectedTag = useAppStore((s) => s.setSelectedTag)
  const scores = useAppStore((s) => s.scores)
  const playlists = useAppStore((s) => s.playlists)
  const librarySetFilter = useAppStore((s) => s.librarySetFilter)
  const setLibrarySetFilter = useAppStore((s) => s.setLibrarySetFilter)

  const [showManage, setShowManage] = useState(false)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [localTab, setLocalTab] = useState<'scores' | 'sets'>('scores')
  const tab = activeTab ?? localTab
  const changeTab = (next: 'scores' | 'sets') => {
    setLocalTab(next)
    onTabChange?.(next)
  }

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

  const setFilterValue =
    librarySetFilter.kind === 'all'
      ? 'all'
      : librarySetFilter.kind === 'no-set'
        ? 'none'
        : librarySetFilter.id

  const changeSetFilter = (value: string) => {
    if (value === 'all') setLibrarySetFilter({ kind: 'all' })
    else if (value === 'none') setLibrarySetFilter({ kind: 'no-set' })
    else setLibrarySetFilter({ kind: 'set', id: value })
  }

  const select = (id: string) => {
    openScore(id, { origin: 'library', playlistId: null })
    onSelectScore?.()
  }

  return (
    <aside className="score-list">
      <div className="list-tabs">
        <button
          className={tab === 'scores' ? 'active' : ''}
          onClick={() => changeTab('scores')}
        >
          Partituras
        </button>
        <button
          className={tab === 'sets' ? 'active' : ''}
          onClick={() => changeTab('sets')}
        >
          Sets
        </button>
        <button
          className="list-admin-toggle"
          onClick={() => setShowManage(true)}
          disabled={scores.length === 0}
          title="Gestionar partituras"
          aria-label="Gestionar partituras"
        >
          ⋯
        </button>
      </div>

      {tab === 'sets' ? (
        <PlaylistPanel onSelectScore={onSelectScore} onPresent={onPresent} />
      ) : (
        <>
          <div className="search-box">
            <input
              type="search"
              placeholder="Buscar partitura o tag…"
              aria-label="Buscar partitura o tag"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="library-set-filter">
            <label htmlFor="library-set-filter">Filtrar por Set</label>
            <select
              id="library-set-filter"
              value={setFilterValue}
              onChange={(e) => changeSetFilter(e.target.value)}
            >
              <option value="all">Todos los repertorios</option>
              <option value="none">Sin Set</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-section">
            <div className="filter-row">
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
              {allTags.length > 0 && (
                <button
                  className={`filter-more ${showMoreFilters || selectedTag ? 'active' : ''}`}
                  onClick={() => setShowMoreFilters((v) => !v)}
                  aria-expanded={showMoreFilters}
                >
                  {selectedTag ? `#${selectedTag}` : 'Más filtros'} ▾
                </button>
              )}
            </div>

            {showMoreFilters && allTags.length > 0 && (
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

          <ul role="listbox" aria-label="Partituras">
            {filtered.map((s) => (
              <li
                key={s.id}
                role="option"
                aria-selected={s.id === currentScoreId}
                tabIndex={0}
                className={s.id === currentScoreId ? 'active' : ''}
                onClick={() => select(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    select(s.id)
                  }
                }}
              >
                <div className="score-item-main">
                  <strong>
                    {s.title}
                    {s.hasAudio && (
                      <span className="audio-badge" title="Tiene backing track">♪</span>
                    )}
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
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="empty">No hay partituras</li>
            )}
          </ul>
        </>
      )}

      <ManageScoresModal open={showManage} onClose={() => setShowManage(false)} />
    </aside>
  )
}
