import { useEffect, useRef } from 'react'
import { OpenSheetMusicDisplay, TransposeCalculator } from 'opensheetmusicdisplay'
import { useAppStore } from '../store'
import { ScoreMetaEditor } from './ScoreMetaEditor'
import { AudioPlayer } from './AudioPlayer'

export function ScoreViewer() {
  const paperRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const loadedRef = useRef(false)
  const transposeRef = useRef(0)

  const scores = useAppStore((s) => s.scores)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const transposeSemitones = useAppStore((s) => s.transposeSemitones)

  transposeRef.current = transposeSemitones
  const current = scores.find((s) => s.id === currentScoreId)

  useEffect(() => {
    if (!paperRef.current || !current) return

    const container = paperRef.current
    osmdRef.current?.dispose()
    osmdRef.current = null
    loadedRef.current = false
    container.innerHTML = ''

    if (!current.musicxml) {
      container.innerHTML =
        '<p class="score-placeholder">Esta partitura se guardó en formato ABC antiguo. Vuelve a crearla en MusicXML o importa un .scorepack actualizado.</p>'
      return
    }

    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: false,
      backend: 'svg',
    })
    osmd.TransposeCalculator = new TransposeCalculator()
    osmdRef.current = osmd

    let cancelled = false
    osmd
      .load(current.musicxml)
      .then(() => {
        if (cancelled) return
        osmd.Sheet.Transpose = transposeRef.current
        osmd.updateGraphic()
        osmd.render()
        loadedRef.current = true
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('Error renderizando MusicXML con OSMD:', err)
        container.innerHTML =
          '<p style="color: var(--text); text-align: center; padding: 2rem;">Error al cargar la partitura</p>'
      })

    return () => {
      cancelled = true
      osmd.dispose()
      if (osmdRef.current === osmd) osmdRef.current = null
    }
  }, [current])

  useEffect(() => {
    const osmd = osmdRef.current
    if (!osmd || !loadedRef.current) return
    osmd.Sheet.Transpose = transposeSemitones
    osmd.updateGraphic()
    osmd.render()
  }, [transposeSemitones])

  if (!current) {
    return (
      <div className="empty-score">
        <p>Selecciona una partitura o crea una nueva</p>
      </div>
    )
  }

  return (
    <div className="score-viewer">
      <div className="score-header">
        <h2>{current.title}</h2>
        <div className="tags">
          {current.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </div>

      <ScoreMetaEditor />
      <AudioPlayer />

      <div ref={paperRef} className="musicxml-paper" />
    </div>
  )
}
