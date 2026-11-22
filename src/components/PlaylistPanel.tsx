import { useState } from 'react'
import { useAppStore } from '../store'
import { getPlaylistScores } from '../lib/visibleScores'
import { AddScoresToPlaylistModal } from './AddScoresToPlaylistModal'

interface Props {
  onSelectScore?: () => void
}

export function PlaylistPanel({ onSelectScore }: Props) {
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

  const currentPlaylist = playlists.find((p) => p.id === currentPlaylistId)
  const playlistScores = currentPlaylist
    ? getPlaylistScores(scores, playlists, currentPlaylist.id)
    : []

  const handleCreate = () => {
    if (!newName.trim()) return
    const id = createPlaylist(newName)
    setCurrentPlaylist(id)
    setNewName('')
    setShowCreate(false)
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
          onClick={() => setCurrentPlaylist(null)}
        >
          Todas las partituras
        </button>
        {playlists.map((p) => (
          <div key={p.id} className="playlist-row">
            <button
              className={`playlist-item ${currentPlaylistId === p.id ? 'active' : ''}`}
              onClick={() => setCurrentPlaylist(p.id)}
            >
              {p.name}
              <span className="count">{p.scoreIds.length}</span>
            </button>
            <button
              className="btn-icon danger"
              title="Eliminar set"
              aria-label={`Eliminar set ${p.name}`}
              onClick={() => deletePlaylist(p.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {currentPlaylist && (
        <div className="playlist-detail">
          <div className="playlist-detail-head">
            <h4 title={currentPlaylist.name}>{currentPlaylist.name}</h4>
            <button
              type="button"
              className="btn-primary full playlist-add-btn"
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
                  openScore(sc.id, { origin: 'set', playlistId: currentPlaylist.id })
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
                    removeScoreFromPlaylist(currentPlaylist.id, sc.id)
                  }}
                >
                  ×
                </button>
              </li>
            ))}
            {playlistScores.length === 0 && (
              <li className="empty">Este set aún no tiene partituras.</li>
            )}
          </ul>
        </div>
      )}

      {showSelector && currentPlaylist && (
        <AddScoresToPlaylistModal
          playlist={currentPlaylist}
          onClose={() => setShowSelector(false)}
        />
      )}
    </div>
  )
}
