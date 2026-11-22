import { useRef, useState } from 'react'
import { useAppStore } from '../store'
import { importScorePack, type ScorePack } from '../lib/scorepack'
import { readMusicXmlFile, titleFromMusicXml } from '../lib/musicxmlImport'

interface Props {
  open: boolean
  onClose: () => void
}

export function AddScoreModal({ open, onClose }: Props) {
  const addScore = useAppStore((s) => s.addScore)
  const openScore = useAppStore((s) => s.openScore)

  const [mode, setMode] = useState<'musicxml' | 'pack'>('pack')
  const [importing, setImporting] = useState(false)
  const packInputRef = useRef<HTMLInputElement>(null)
  const xmlInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleImportPack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const pack = JSON.parse(text) as ScorePack
      const score = await importScorePack(pack, { newId: true })
      addScore(score)
      openScore(score.id, { origin: 'library', playlistId: null })
      onClose()
    } catch (err) {
      console.error(err)
      alert('No se pudo importar el archivo .scorepack')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleImportXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const musicxml = await readMusicXmlFile(file)
      if (!/<score-(partwise|timewise)[\s>]/i.test(musicxml)) {
        throw new Error('El archivo no contiene una partitura MusicXML')
      }

      const id = `score-${Date.now()}`
      addScore({
        id,
        title: titleFromMusicXml(musicxml, file.name),
        tags: [],
        repertoire: 'general',
        musicxml: musicxml.trim(),
        hasAudio: false,
      })
      openScore(id, { origin: 'library', playlistId: null })
      onClose()
    } catch (err) {
      console.error(err)
      alert('No se pudo importar el archivo MusicXML')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
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
            className={mode === 'musicxml' ? 'active' : ''}
            onClick={() => setMode('musicxml')}
          >
            Importar MusicXML (.xml, .mxl)
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
          <div className="import-pack">
            <p>
              Importa un archivo <strong>.xml</strong>,{' '}
              <strong>.musicxml</strong> o <strong>.mxl</strong> comprimido con
              la partitura. El título se toma del archivo y luego puedes
              editarlo junto a los tags y el repertorio.
            </p>
            <button
              type="button"
              className="btn-primary full"
              disabled={importing}
              onClick={() => xmlInputRef.current?.click()}
            >
              {importing ? 'Importando…' : 'Elegir archivo .xml / .musicxml / .mxl'}
            </button>
            <input
              ref={xmlInputRef}
              type="file"
              accept=".xml,.musicxml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml,application/zip,text/xml"
              hidden
              onChange={handleImportXml}
            />
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
