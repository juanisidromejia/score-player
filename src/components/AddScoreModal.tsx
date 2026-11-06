import { useRef, useState } from 'react'
import { useAppStore } from '../store'
import { importScorePack, type ScorePack } from '../lib/scorepack'

interface Props {
  open: boolean
  onClose: () => void
}

export function AddScoreModal({ open, onClose }: Props) {
  const addScore = useAppStore((s) => s.addScore)
  const setCurrentScore = useAppStore((s) => s.setCurrentScore)

  const [title, setTitle] = useState('')
  const [abc, setAbc] = useState('')
  const [tags, setTags] = useState('')
  const [repertoire, setRepertoire] = useState('')
  const [mode, setMode] = useState<'abc' | 'pack'>('pack')
  const [importing, setImporting] = useState(false)
  const packInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!abc.trim()) return

    let finalTitle = title.trim()
    if (!finalTitle) {
      const match = abc.match(/^T:\s*(.+)$/m)
      finalTitle = match ? match[1].trim() : 'Sin título'
    }

    const id = `score-${Date.now()}`
    const tagList = tags
      .split(/[,;]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    addScore({
      id,
      title: finalTitle,
      tags: tagList,
      repertoire: repertoire.trim() || 'general',
      abc: abc.trim(),
      hasAudio: false,
    })

    setCurrentScore(id)
    reset()
    onClose()
  }

  const handleImportPack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const pack = JSON.parse(text) as ScorePack
      const score = await importScorePack(pack, { newId: true })
      addScore(score)
      setCurrentScore(score.id)
      reset()
      onClose()
    } catch (err) {
      console.error(err)
      alert('No se pudo importar el archivo .scorepack')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const reset = () => {
    setTitle('')
    setAbc('')
    setTags('')
    setRepertoire('')
    setMode('pack')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nueva partitura</h2>

        <div className="mode-tabs">
          <button
            type="button"
            className={mode === 'pack' ? 'active' : ''}
            onClick={() => setMode('pack')}
          >
            Importar combo (.scorepack)
          </button>
          <button
            type="button"
            className={mode === 'abc' ? 'active' : ''}
            onClick={() => setMode('abc')}
          >
            Pegar ABC
          </button>
        </div>

        {mode === 'pack' ? (
          <div className="import-pack">
            <p>
              Importa un archivo <strong>.scorepack</strong> que contenga la
              partitura y, si tiene, el backing track.
            </p>
            <button
              type="button"
              className="btn-primary full"
              disabled={importing}
              onClick={() => packInputRef.current?.click()}
            >
              {importing ? 'Importando…' : 'Elegir archivo .scorepack'}
            </button>
            <input
              ref={packInputRef}
              type="file"
              accept=".scorepack,application/json"
              hidden
              onChange={handleImportPack}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Título
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Se toma del ABC si lo dejas vacío"
              />
            </label>

            <label>
              Repertorio / categoría
              <input
                value={repertoire}
                onChange={(e) => setRepertoire(e.target.value)}
                placeholder="ej: wedding, party, romantic…"
              />
            </label>

            <label>
              Tags (separados por coma)
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="romántica, clásico, pop…"
              />
            </label>

            <label>
              Código ABC *
              <textarea
                value={abc}
                onChange={(e) => setAbc(e.target.value)}
                rows={10}
                placeholder={`X:1\nT:Mi canción\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |`}
                required
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Guardar
              </button>
            </div>
          </form>
        )}

        {mode === 'pack' && (
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
