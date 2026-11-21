import { useEffect, useRef } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { useAppStore } from '../store'
import { ScoreMetaEditor } from './ScoreMetaEditor'
import { AudioPlayer } from './AudioPlayer'

export function ScoreViewer() {
  const paperRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

  const scores = useAppStore((s) => s.scores)
  const currentScoreId = useAppStore((s) => s.currentScoreId)

  const current = scores.find((s) => s.id === currentScoreId)

  useEffect(() => {
    if (!paperRef.current || !current) return

    const container = paperRef.current
    osmdRef.current?.dispose()
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
    osmdRef.current = osmd

    let cancelled = false
    osmd
      .load(current.musicxml)
      .then(() => {
        if (!cancelled) osmd.render()
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
