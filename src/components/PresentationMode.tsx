import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import abcjs from 'abcjs'
import * as Tone from 'tone'
import { useAppStore } from '../store'
import { loadAudio } from '../lib/audioStorage'
import { getPresentationScores } from '../lib/visibleScores'

interface Props {
  open: boolean
  onClose: () => void
}

export function PresentationMode({ open, onClose }: Props) {
  const scores = useAppStore((s) => s.scores)
  const playlists = useAppStore((s) => s.playlists)
  const currentPlaylistId = useAppStore((s) => s.currentPlaylistId)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const transposeSemitones = useAppStore((s) => s.transposeSemitones)
  const setTranspose = useAppStore((s) => s.setTranspose)
  const setCurrentScore = useAppStore((s) => s.setCurrentScore)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const selectedRepertoire = useAppStore((s) => s.selectedRepertoire)
  const selectedTag = useAppStore((s) => s.selectedTag)

  const activePlaylist = playlists.find((p) => p.id === currentPlaylistId)

  const presentationScores = useMemo(
    () =>
      getPresentationScores({
        scores,
        playlists,
        currentPlaylistId,
        searchQuery,
        selectedRepertoire,
        selectedTag,
      }),
    [
      scores,
      playlists,
      currentPlaylistId,
      searchQuery,
      selectedRepertoire,
      selectedTag,
    ]
  )

  const current = scores.find((s) => s.id === currentScoreId)
  const currentIndex = presentationScores.findIndex((s) => s.id === currentScoreId)
  const songNumber = currentIndex >= 0 ? currentIndex + 1 : 1
  const songCount = Math.max(presentationScores.length, 1)

  const paperRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Tone.Player | null>(null)
  const pitchShiftRef = useRef<Tone.PitchShift | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const resumeOffsetRef = useRef(0)
  const playStartedAtRef = useRef(0)
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gestureRef = useRef<{
    x: number
    y: number
    axis: 'x' | 'y' | null
    id: number
  } | null>(null)
  const swipeCooldownRef = useRef(0)
  const scrollRafRef = useRef<number | null>(null)

  const clearEndTimer = () => {
    if (endTimerRef.current !== null) {
      clearTimeout(endTimerRef.current)
      endTimerRef.current = null
    }
  }

  const recomputePages = useCallback(() => {
    const container = pagesRef.current
    const paper = paperRef.current
    if (!container || !paper) return
    const pageH = container.clientHeight
    if (pageH <= 0) return
    const pages = Math.max(1, Math.ceil(paper.scrollHeight / pageH))
    setTotalPages(pages)
    setPage((p) => Math.min(p, pages - 1))
  }, [])

  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [showUi, setShowUi] = useState(true)

  // Si la partitura actual no pertenece a la lista de presentación, usar la primera
  useEffect(() => {
    if (!open || presentationScores.length === 0) return
    if (currentScoreId && presentationScores.some((s) => s.id === currentScoreId)) {
      return
    }
    setCurrentScore(presentationScores[0].id, { keepTranspose: true })
  }, [open, presentationScores, currentScoreId, setCurrentScore])

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
      container.scrollTop = 0
      setPage(0)
      recomputePages()
    })
  }, [open, current, transposeSemitones, recomputePages])

  // Recalcular páginas al redimensionar
  useEffect(() => {
    if (!open) return
    const container = pagesRef.current
    if (!container) return

    const observer = new ResizeObserver(() => recomputePages())
    observer.observe(container)
    return () => observer.disconnect()
  }, [open, recomputePages])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current)
      }
    }
  }, [])

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
    clearEndTimer()
    resumeOffsetRef.current = 0
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
      const pageH = container.clientHeight || 1
      const currentPage = Math.round(container.scrollTop / pageH)
      const next = Math.min(Math.max(0, currentPage + delta), totalPages - 1)
      setPage(next)
      container.scrollTo({ top: next * pageH, behavior: 'smooth' })
    },
    [totalPages]
  )

  const goSong = useCallback(
    (delta: number) => {
      const count = presentationScores.length
      if (count < 2) return

      const index = presentationScores.findIndex((s) => s.id === currentScoreId)
      const base = index === -1 ? (delta > 0 ? -1 : 0) : index
      const next = ((base + delta) % count + count) % count
      const target = presentationScores[next]

      if (!target || target.id === currentScoreId) return
      setCurrentScore(target.id, { keepTranspose: true })
    },
    [presentationScores, currentScoreId, setCurrentScore]
  )

  const togglePlay = async () => {
    if (!playerRef.current || !audioReady) return
    await Tone.start()

    const player = playerRef.current
    const duration = player.buffer.duration

    if (isPlaying) {
      const elapsed = (Date.now() - playStartedAtRef.current) / 1000
      resumeOffsetRef.current = Math.min(resumeOffsetRef.current + elapsed, duration)
      player.stop()
      clearEndTimer()
      setIsPlaying(false)
    } else {
      if (resumeOffsetRef.current >= duration - 0.01) {
        resumeOffsetRef.current = 0
      }

      player.start(Tone.now(), resumeOffsetRef.current)
      playStartedAtRef.current = Date.now()
      setIsPlaying(true)

      clearEndTimer()
      const remaining = duration - resumeOffsetRef.current
      endTimerRef.current = setTimeout(() => {
        setIsPlaying(false)
        resumeOffsetRef.current = 0
        endTimerRef.current = null
      }, remaining * 1000)
    }
  }

  // Sincronizar el indicador de página con el scroll manual
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      const container = pagesRef.current
      if (!container) return
      const pageH = container.clientHeight || 1
      const next = Math.min(
        Math.max(0, Math.round(container.scrollTop / pageH)),
        totalPages - 1
      )
      setPage(next)
    })
  }, [totalPages])

  // Gestos horizontales: cambiar de canción
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gestureRef.current = {
      x: e.clientX,
      y: e.clientY,
      axis: null,
      id: e.pointerId,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.id !== e.pointerId) return

    const dx = e.clientX - gesture.x
    const dy = e.clientY - gesture.y

    if (!gesture.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (gesture.axis === 'x') {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* pointer capture no disponible */
        }
      }
    }

    if (gesture.axis === 'x' && e.cancelable) {
      e.preventDefault()
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    gestureRef.current = null

    if (!gesture || gesture.id !== e.pointerId || gesture.axis !== 'x') return

    const dx = e.clientX - gesture.x
    const dy = e.clientY - gesture.y

    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return
    if (Date.now() - swipeCooldownRef.current < 350) return

    swipeCooldownRef.current = Date.now()
    goSong(dx < 0 ? 1 : -1)
  }

  const handlePointerCancel = () => {
    gestureRef.current = null
  }

  // Teclado: flechas, espacio, Escape, T para ocultar UI
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goSong(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goSong(-1)
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        goPage(1)
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        goPage(-1)
      } else if (e.key === ' ') {
        e.preventDefault()
        if (current?.hasAudio) togglePlay()
        else goPage(1)
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
  }, [
    open,
    goSong,
    goPage,
    onClose,
    transposeSemitones,
    setTranspose,
    current?.hasAudio,
    isPlaying,
    audioReady,
  ])

  if (!open || !current) return null

  const pitchLabel =
    transposeSemitones === 0
      ? 'Original'
      : `${transposeSemitones > 0 ? '+' : ''}${transposeSemitones}`

  return (
    <div className="presentation">
      <div
        className="presentation-pages"
        ref={pagesRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          key={current.id}
          ref={paperRef}
          className="presentation-paper"
        />
      </div>

      {showUi && (
        <div className="presentation-bar">
          <div className="pres-left">
            <button
              className="pres-btn"
              onClick={onClose}
              title="Salir (Esc)"
              aria-label="Salir de la presentación"
            >
              ✕ Salir
            </button>
            <span className="pres-title">{current.title}</span>
            <span
              className="pres-set"
              title={
                activePlaylist
                  ? `Set: ${activePlaylist.name}`
                  : 'Todas las partituras visibles'
              }
            >
              {activePlaylist ? activePlaylist.name : 'Todas'} · {songNumber}/{songCount}
            </span>
          </div>

          <div className="pres-center">
            <button
              className="pres-btn"
              onClick={() => goPage(-1)}
              disabled={page <= 0}
              title="Página anterior (↑)"
              aria-label="Página anterior"
            >
              ↑
            </button>
            <span className="pres-page">
              {page + 1} / {totalPages}
            </span>
            <button
              className="pres-btn"
              onClick={() => goPage(1)}
              disabled={page >= totalPages - 1}
              title="Página siguiente (↓)"
              aria-label="Página siguiente"
            >
              ↓
            </button>
          </div>

          <div className="pres-right">
            {presentationScores.length > 1 && (
              <div className="pres-song-nav">
                <button
                  className="pres-btn"
                  onClick={() => goSong(-1)}
                  title="Canción anterior (←)"
                  aria-label="Canción anterior"
                >
                  ◀
                </button>
                <button
                  className="pres-btn"
                  onClick={() => goSong(1)}
                  title="Canción siguiente (→)"
                  aria-label="Canción siguiente"
                >
                  ▶
                </button>
              </div>
            )}

            <div className="pres-transpose">
              <button
                className="pres-btn"
                onClick={() => setTranspose(transposeSemitones - 1)}
                aria-label="Bajar un semitono"
              >
                −1
              </button>
              <span className="pres-pitch" title="Transporte (partitura + audio)">
                {pitchLabel}
              </span>
              <button
                className="pres-btn"
                onClick={() => setTranspose(transposeSemitones + 1)}
                aria-label="Subir un semitono"
              >
                +1
              </button>
            </div>

            {current.hasAudio && (
              <button
                className="pres-btn play"
                onClick={togglePlay}
                disabled={!audioReady}
                title="Play/Pause (Espacio)"
                aria-label={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
            )}

            <button
              className="pres-btn"
              onClick={() => setShowUi(false)}
              title="Ocultar controles (H)"
              aria-label="Ocultar controles"
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
          aria-label="Mostrar controles"
        />
      )}
    </div>
  )
}
