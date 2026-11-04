import { useEffect, useRef } from 'react'
import abcjs from 'abcjs'
import { useAppStore } from '../store'
import { ScoreMetaEditor } from './ScoreMetaEditor'
import { AudioPlayer } from './AudioPlayer'

export function ScoreViewer() {
  const paperRef = useRef<HTMLDivElement>(null)

  const scores = useAppStore((s) => s.scores)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const transposeSemitones = useAppStore((s) => s.transposeSemitones)

  const current = scores.find((s) => s.id === currentScoreId)

  useEffect(() => {
    if (!paperRef.current || !current) return

    const paper = paperRef.current
    paper.innerHTML = ''

    const staffwidth = Math.max(320, Math.floor(paper.clientWidth - 24) || 700)

    const visualObjs = abcjs.renderAbc(paper, current.abc, {
      responsive: 'resize',
      add_classes: true,
      paddingtop: 10,
      paddingbottom: 10,
      paddingleft: 10,
      paddingright: 10,
      staffwidth,
    })

    if (transposeSemitones !== 0 && visualObjs) {
      const transposedAbc = abcjs.strTranspose(
        current.abc,
        visualObjs,
        transposeSemitones
      )
      paper.innerHTML = ''
      abcjs.renderAbc(paper, transposedAbc, {
        responsive: 'resize',
        add_classes: true,
        paddingtop: 10,
        paddingbottom: 10,
        paddingleft: 10,
        paddingright: 10,
        staffwidth,
      })
    }
  }, [current, transposeSemitones])

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

      <div ref={paperRef} className="abc-paper" />
    </div>
  )
}
