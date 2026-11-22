import { useEffect, useState } from 'react'
import { useAppStore, type Playlist } from '../store'
import { getPlaylistScores } from '../lib/visibleScores'
import { AddScoresToPlaylistModal } from './AddScoresToPlaylistModal'
import { ConfirmDeleteSetModal } from './ConfirmDeleteSetModal'

interface Props {
  onSelectScore?: () => void
  onPresent?: () => void
}

export function PlaylistPanel({ onSelectScore, onPresent }: Props) {
  const playlists = useAppStore((s) => s.playlists)
  const scores = useAppStore((s) => s.scores)
  const currentPlaylistId = useAppStore((s) => s.currentPlaylistId)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const createPlaylist = useAppStore((s) => s.createPlaylist)
  const deletePlaylist = useAppStore((s) => s.deletePlaylist)
  const setCurrentPlaylist = useAppStore((s) => s.setCurrentPlaylist)
  const removeScoreFromPlaylist = useAppStore((s) => s.removeScoreFromPlaylist)
  const openScore = useAppStore((s) => s.openScore)

  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null)
  const [openSetId, setOpenSetId] = useState<string | null>(null)

  const viewedSet = playlists.find((p) => p.id === openSetId)
  const playlistScores = viewedSet
    ? getPlaylistScores(scores, playlists, viewedSet.id)
    : []

  useEffect(() => {
    if (openSetId && !playlists.some((p) => p.id === openSetId)) {
      setOpenSetId(null)
    }
  }, [openSetId, playlists])

  const openSetView = (id: string) => {
    setCurrentPlaylist(id)
    setOpenSetId(id)
    setMenuFor(null)
  }

  const handleCreate = () => {
    if (!newName.trim()) return
    const id = createPlaylist(newName)
    setCurrentPlaylist(id)
    setOpenSetId(id)
    setNewName('')
    setShowCreate(false)
    setMenuFor(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deletePlaylist(deleteTarget.id)
    setDeleteTarget(null)
    setMenuFor(null)
  }

  const presentSet = () => {
    if (!viewedSet || playlistScores.length === 0) return
    openScore(playlistScores[0].id, {
      origin: 'set',
      playlistId: viewedSet.id,
    })
    onPresent?.()
  }

  if (viewedSet) {
    return (
      <div className="playlist-panel">
        <div className="playlist-detail set-view">
          <div className="set-view-header">
            <button
              type="button"
              className="btn-small set-view-back"
              onClick={() => setOpenSetId(null)}
            >
              ‹ Sets
            </button>
            <h4 title={viewedSet.name}>{viewedSet.name}</h4>
          </div>

          <div className="set-view-actions">
            <button
              type="button"
              className="btn-primary full set-present-btn"
              disabled={playlistScores.length === 0}
              title={
                playlistScores.length === 0
                  ? 'Agrega partituras antes de presentar'
                  : undefined
              }
              onClick={presentSet}
            >
              ▶ Presentar Set
            </button>
            <button
              type="button"
              className="btn-secondary full playlist-add-btn"
              onClick={() => setShowSelector(true)}
            >
              + Agregar partituras
            </button>
          </div>

          <ul>
            {playlistScores.map((sc) => (
              <li
                key={sc.id}
                className={sc.id === currentScoreId ? 'active' : ''}
                onClick={() => {
                  openScore(sc.id, { origin: 'set', playlistId: viewedSet.id })
                  onSelectScore?.()
                }}
              >
                <span>{sc.title}</span>
                <button
                  className="btn-icon playlist-remove"
                  title="Quitar del set"
                  aria-label={`Quitar ${sc.title} del set`}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeScoreFromPlaylist(viewedSet.id, sc.id)
                  }}
                >
                  ×
                </button>
              </li>
            ))}
            {playlistScores.length === 0 && (
              <li className="empty">
                Este set aún no tiene partituras. Agrega partituras para poder
                presentarlo.
              </li>
            )}
          </ul>
        </div>

        {showSelector && (
          <AddScoresToPlaylistModal
            playlist={viewedSet}
            onClose={() => setShowSelector(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="playlist-panel">
      <div className="playlist-header">
        <h3>Sets / Playlists</h3>
        <button className="btn-small" onClick={() => setShowCreate((v) => !v)}>
          + Nuevo
        </button>
      </div>

      {showCreate && (
        <div className="create-playlist">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del set…"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button className="btn-small primary" onClick={handleCreate}>
            Crear
          </button>
        </div>
      )}

      <div className="playlist-list">
        <button
          className={`playlist-item ${!currentPlaylistId ? 'active' : ''}`}
          onClick={() => {
            setCurrentPlaylist(null)
            setMenuFor(null)
          }}
        >
          Todas las partituras
        </button>
        {playlists.map((p) => (
          <div key={p.id} className="playlist-row">
            <button
              className={`playlist-item ${currentPlaylistId === p.id ? 'active' : ''}`}
              onClick={() => {
                setCurrentPlaylist(p.id)
                setMenuFor(null)
              }}
              onDoubleClick={() => openSetView(p.id)}
              title="Doble clic para ver el contenido"
            >
              {p.name}
              <span className="count">{p.scoreIds.length}</span>
            </button>
            <button
              className="btn-small set-open-btn"
              title={`Abrir contenido de ${p.name}`}
              aria-label={`Abrir contenido del set ${p.name}`}
              onClick={() => openSetView(p.id)}
            >
              Abrir
            </button>
            <button
              className="btn-icon playlist-options"
              title={`Opciones de ${p.name}`}
              aria-label={`Opciones del set ${p.name}`}
              aria-expanded={menuFor === p.id}
              onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
            >
              ⋯
            </button>
            {menuFor === p.id && (
              <div className="playlist-options-menu">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(p)
                    setMenuFor(null)
                  }}
                >
                  Eliminar Set
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmDeleteSetModal
          playlist={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
