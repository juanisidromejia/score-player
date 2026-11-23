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

      <details className="score-follow-settings">
        <summary>Sincronización del backing track</summary>
        <label className="score-follow-toggle">
          <input
            type="checkbox"
            checked={current.scoreFollowEnabled ?? false}
            onChange={(e) => updateScore(current.id, { scoreFollowEnabled: e.target.checked })}
          />
          <span>Activar seguimiento automático de la partitura</span>
        </label>
        {current.scoreFollowEnabled && (
          <div className="score-follow-fields">
            <div className="meta-row">
              <label htmlFor="score-follow-bpm">Tempo (BPM, negra)</label>
              <input
                id="score-follow-bpm"
                type="number"
                min="20"
                max="300"
                step="1"
                value={current.scoreFollowBpm ?? 120}
                onChange={(e) => updateScore(current.id, { scoreFollowBpm: Math.max(20, Math.min(300, Number(e.target.value) || 120)) })}
              />
            </div>
            <div className="score-follow-meter">
              <div className="meta-row">
                <label htmlFor="score-follow-numerator">Numerador</label>
                <input
                  id="score-follow-numerator"
                  type="number"
                  min="1"
                  max="32"
                  value={current.scoreFollowNumerator ?? 4}
                  onChange={(e) => updateScore(current.id, { scoreFollowNumerator: Math.max(1, Math.min(32, Number(e.target.value) || 4)) })}
                />
              </div>
              <div className="meta-row">
                <label htmlFor="score-follow-denominator">Denominador</label>
                <select
                  id="score-follow-denominator"
                  value={current.scoreFollowDenominator ?? 4}
                  onChange={(e) => updateScore(current.id, { scoreFollowDenominator: Number(e.target.value) })}
                >
                  {[2, 4, 8, 16].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            </div>
            <div className="meta-row">
              <label htmlFor="score-follow-offset">Inicio musical en el audio (segundos)</label>
              <input
                id="score-follow-offset"
                type="number"
                min="0"
                max="3600"
                step="0.1"
                value={current.scoreFollowStartOffset ?? 0}
                onChange={(e) => updateScore(current.id, { scoreFollowStartOffset: Math.max(0, Math.min(3600, Number(e.target.value) || 0)) })}
              />
            </div>
            <p className="score-follow-hint">
              Para esta versión se asume tempo constante durante toda la obra. El BPM corresponde a la negra.
            </p>
          </div>
        )}
      </details>

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
