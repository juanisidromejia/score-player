import { useState } from 'react'
import { useAppStore } from '../store'

export function PlaylistPanel() {
  const playlists = useAppStore((s) => s.playlists)
  const scores = useAppStore((s) => s.scores)
  const currentPlaylistId = useAppStore((s) => s.currentPlaylistId)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const createPlaylist = useAppStore((s) => s.createPlaylist)
  const deletePlaylist = useAppStore((s) => s.deletePlaylist)
  const setCurrentPlaylist = useAppStore((s) => s.setCurrentPlaylist)
  const addScoreToPlaylist = useAppStore((s) => s.addScoreToPlaylist)
  const removeScoreFromPlaylist = useAppStore((s) => s.removeScoreFromPlaylist)
  const setCurrentScore = useAppStore((s) => s.setCurrentScore)

  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const currentPlaylist = playlists.find((p) => p.id === currentPlaylistId)

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
          <h4>{currentPlaylist.name}</h4>
          <ul>
            {currentPlaylist.scoreIds.map((sid) => {
              const sc = scores.find((s) => s.id === sid)
              if (!sc) return null
              return (
                <li
                  key={sid}
                  className={sid === currentScoreId ? 'active' : ''}
                  onClick={() => setCurrentScore(sid)}
                >
                  <span>{sc.title}</span>
                  <button
                    className="btn-icon"
                    title="Quitar del set"
                    aria-label={`Quitar ${sc.title} del set`}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeScoreFromPlaylist(currentPlaylist.id, sid)
                    }}
                  >
                    ×
                  </button>
                </li>
              )
            })}
            {currentPlaylist.scoreIds.length === 0 && (
              <li className="empty">Set vacío — añade partituras desde la lista</li>
            )}
          </ul>

          {currentScoreId && !currentPlaylist.scoreIds.includes(currentScoreId) && (
            <button
              className="btn-small primary full"
              onClick={() => addScoreToPlaylist(currentPlaylist.id, currentScoreId)}
            >
              + Añadir partitura actual al set
            </button>
          )}
        </div>
      )}
    </div>
  )
}
