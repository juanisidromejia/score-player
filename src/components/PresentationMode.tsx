import { useEffect, useRef, useState, useCallback } from 'react'
import abcjs from 'abcjs'
import * as Tone from 'tone'
import { useAppStore } from '../store'
import { loadAudio } from '../lib/audioStorage'

interface Props {
  open: boolean
  onClose: () => void
}

export function PresentationMode({ open, onClose }: Props) {
  const scores = useAppStore((s) => s.scores)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const transposeSemitones = useAppStore((s) => s.transposeSemitones)
  const setTranspose = useAppStore((s) => s.setTranspose)

  const current = scores.find((s) => s.id === currentScoreId)

  const paperRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Tone.Player | null>(null)
  const pitchShiftRef = useRef<Tone.PitchShift | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [showUi, setShowUi] = useState(true)

  // Render partitura
  useEffect(() => {
    if (!open || !paperRef.current || !current) return

    const paper = paperRef.current
    paper.innerHTML = ''

    let abc = current.abc
    const visualObjs = abcjs.renderAbc(paper, abc, {
      add_classes: true,
      paddingtop: 20,
      paddingbottom: 20,
      paddingleft: 16,
      paddingright: 16,
      staffwidth: Math.min(window.innerWidth - 48, 900),
      responsive: 'resize',
    })

    if (transposeSemitones !== 0 && visualObjs) {
      abc = abcjs.strTranspose(current.abc, visualObjs, transposeSemitones)
      paper.innerHTML = ''
      abcjs.renderAbc(paper, abc, {
        add_classes: true,
        paddingtop: 20,
        paddingbottom: 20,
        paddingleft: 16,
        paddingright: 16,
        staffwidth: Math.min(window.innerWidth - 48, 900),
        responsive: 'resize',
      })
    }

    // Calcular páginas según altura del viewport
    requestAnimationFrame(() => {
      const container = pagesRef.current
      if (!container) return
      const pageH = container.clientHeight
      const contentH = paper.scrollHeight
      const pages = Math.max(1, Math.ceil(contentH / pageH))
      setTotalPages(pages)
      setPage(0)
      container.scrollTop = 0
    })
  }, [open, current, transposeSemitones])

  // Audio en modo presentación
  useEffect(() => {
    if (!open || !current?.hasAudio) {
      setAudioReady(false)
      return
    }

    let cancelled = false

    async function setup() {
      cleanupAudio()
      try {
        const blob = await loadAudio(current!.id)
        if (cancelled || !blob) return
        await Tone.start()
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url

        const pitchShift = new Tone.PitchShift({
          pitch: transposeSemitones,
          windowSize: 0.1,
        }).toDestination()

        const player = new Tone.Player({
          url,
          onload: () => {
            if (!cancelled) setAudioReady(true)
          },
        }).connect(pitchShift)

        playerRef.current = player
        pitchShiftRef.current = pitchShift
      } catch (e) {
        console.error(e)
      }
    }

    setup()
    return () => {
      cancelled = true
      cleanupAudio()
    }
  }, [open, current?.id, current?.hasAudio])

  useEffect(() => {
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = transposeSemitones
    }
  }, [transposeSemitones])

  function cleanupAudio() {
    if (playerRef.current) {
      try { playerRef.current.stop() } catch { /* */ }
      playerRef.current.dispose()
      playerRef.current = null
    }
    if (pitchShiftRef.current) {
      pitchShiftRef.current.dispose()
      pitchShiftRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setIsPlaying(false)
    setAudioReady(false)
  }

  const goPage = useCallback(
    (delta: number) => {
      const container = pagesRef.current
      if (!container) return
      const pageH = container.clientHeight
      const next = Math.min(Math.max(0, page + delta), totalPages - 1)
      setPage(next)
      container.scrollTo({ top: next * pageH, behavior: 'smooth' })
    },
    [page, totalPages]
  )

  const togglePlay = async () => {
    if (!playerRef.current || !audioReady) return
    await Tone.start()
    if (isPlaying) {
      playerRef.current.stop()
      setIsPlaying(false)
    } else {
      playerRef.current.start()
      setIsPlaying(true)
      const dur = playerRef.current.buffer.duration
      setTimeout(() => setIsPlaying(false), dur * 1000)
    }
  }

  // Teclado: flechas, espacio, Escape, T para ocultar UI
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        if (e.key === ' ' && current?.hasAudio) togglePlay()
        else goPage(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goPage(-1)
      } else if (e.key === 'h' || e.key === 'H') {
        setShowUi((v) => !v)
      } else if (e.key === '+' || e.key === '=') {
        setTranspose(transposeSemitones + 1)
      } else if (e.key === '-') {
        setTranspose(transposeSemitones - 1)
      } else if (e.key === '0') {
        setTranspose(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, goPage, onClose, transposeSemitones, setTranspose, current?.hasAudio, isPlaying, audioReady])

  if (!open || !current) return null

  const pitchLabel =
    transposeSemitones === 0
      ? 'Original'
      : `${transposeSemitones > 0 ? '+' : ''}${transposeSemitones}`

  return (
    <div className="presentation">
      <div className="presentation-pages" ref={pagesRef}>
        <div ref={paperRef} className="presentation-paper" />
      </div>

      {showUi && (
        <div className="presentation-bar">
          <div className="pres-left">
            <button className="pres-btn" onClick={onClose} title="Salir (Esc)">
              ✕ Salir
            </button>
            <span className="pres-title">{current.title}</span>
          </div>

          <div className="pres-center">
            <button className="pres-btn" onClick={() => goPage(-1)} disabled={page <= 0}>
              ◀
            </button>
            <span className="pres-page">
              {page + 1} / {totalPages}
            </span>
            <button
              className="pres-btn"
              onClick={() => goPage(1)}
              disabled={page >= totalPages - 1}
            >
              ▶
            </button>
          </div>

          <div className="pres-right">
            <div className="pres-transpose">
              <button className="pres-btn" onClick={() => setTranspose(transposeSemitones - 1)}>
                −1
              </button>
              <span className="pres-pitch" title="Transporte (partitura + audio)">
                {pitchLabel}
              </span>
              <button className="pres-btn" onClick={() => setTranspose(transposeSemitones + 1)}>
                +1
              </button>
            </div>

            {current.hasAudio && (
              <button
                className="pres-btn play"
                onClick={togglePlay}
                disabled={!audioReady}
                title="Play/Pause (Espacio)"
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
            )}

            <button
              className="pres-btn"
              onClick={() => setShowUi(false)}
              title="Ocultar controles (H)"
            >
              Ocultar
            </button>
          </div>
        </div>
      )}

      {!showUi && (
        <button
          className="presentation-tap"
          onClick={() => setShowUi(true)}
          title="Mostrar controles (H)"
        />
      )}
    </div>
  )
}
