import { useState } from 'react'
import { useAppStore } from '../store'

export function ScoreMetaEditor() {
  const scores = useAppStore((s) => s.scores)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const updateScore = useAppStore((s) => s.updateScore)
  const addTagToScore = useAppStore((s) => s.addTagToScore)
  const removeTagFromScore = useAppStore((s) => s.removeTagFromScore)
  const playlists = useAppStore((s) => s.playlists)
  const addScoreToPlaylist = useAppStore((s) => s.addScoreToPlaylist)

  const [newTag, setNewTag] = useState('')

  const current = scores.find((s) => s.id === currentScoreId)
  if (!current) return null

  const handleAddTag = () => {
    if (!newTag.trim()) return
    addTagToScore(current.id, newTag)
    setNewTag('')
  }

  return (
    <div className="score-meta-editor">
      <div className="meta-row">
        <label>Repertorio</label>
        <input
          value={current.repertoire}
          onChange={(e) => updateScore(current.id, { repertoire: e.target.value })}
          placeholder="wedding, party…"
        />
      </div>

      <div className="meta-row">
        <label>Tags</label>
        <div className="tags-edit">
          {current.tags.map((t) => (
            <span key={t} className="tag editable">
              {t}
              <button
                title={`Quitar tag ${t}`}
                aria-label={`Quitar tag ${t}`}
                onClick={() => removeTagFromScore(current.id, t)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="+ tag"
            className="tag-input"
          />
        </div>
      </div>

      {playlists.length > 0 && (
        <div className="meta-row">
          <label>Añadir a set</label>
          <div className="playlist-quick-add">
            {playlists.map((p) => {
              const already = p.scoreIds.includes(current.id)
              return (
                <button
                  key={p.id}
                  className={`btn-small ${already ? 'active' : ''}`}
                  disabled={already}
                  onClick={() => addScoreToPlaylist(p.id, current.id)}
                >
                  {already ? '✓ ' : '+ '}
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
