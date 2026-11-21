import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import abcjs from 'abcjs'
import * as Tone from 'tone'
import { useAppStore } from '../store'
import { loadAudio } from '../lib/audioStorage'
import { getPresentationScores } from '../lib/visibleScores'
import { computePageLayout } from '../lib/presentationLayout'

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
    isEdgeDrawer?: boolean
  } | null>(null)
  const swipeCooldownRef = useRef(0)
  const scrollRafRef = useRef<number | null>(null)

  const [page, setPage] = useState(0)
  const [pageOffsets, setPageOffsets] = useState<number[]>([0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const totalPages = Math.max(pageOffsets.length, 1)

  const clearEndTimer = () => {
    if (endTimerRef.current !== null) {
      clearTimeout(endTimerRef.current)
      endTimerRef.current = null
    }
  }

  // Render abcjs score and compute layout/pages
  const renderScore = useCallback(() => {
    const container = pagesRef.current
    const paper = paperRef.current
    if (!open || !container || !paper || !current) return

    paper.innerHTML = ''
    const containerW = container.clientWidth || window.innerWidth
    // Ancho base justo para la hoja, sin sobrar a los lados
    const staffwidth = Math.max(240, containerW - 16)

    let abc = current.abc
    const renderOpts: Record<string, unknown> = {
      add_classes: true,
      paddingtop: 6,
      paddingbottom: 6,
      paddingleft: 6,
      paddingright: 6,
      staffwidth,
    }

    const visualObjs = abcjs.renderAbc(paper, abc, renderOpts as Record<string, unknown>)
    if (transposeSemitones !== 0 && visualObjs) {
      abc = abcjs.strTranspose(current.abc, visualObjs, transposeSemitones)
      paper.innerHTML = ''
      abcjs.renderAbc(paper, abc, renderOpts as Record<string, unknown>)
    }

    // Ajustar SVG al ancho del contenedor: nunca se corta horizontalmente
    const svgEl = paper.querySelector('svg')
    if (svgEl) {
      svgEl.style.width = '100%'
      svgEl.style.maxWidth = '100%'
      svgEl.style.height = 'auto'
      svgEl.style.transformOrigin = 'top center'
    }

    // Calcular layout y paginación por sistemas tras un frame
    requestAnimationFrame(() => {
      if (!pagesRef.current || !paperRef.current) return
      const containerH = pagesRef.current.clientHeight
      const { offsets } = computePageLayout(paperRef.current, containerH)
      setPageOffsets(offsets)
      setPage(0)
      pagesRef.current.scrollTop = 0
    })
  }, [open, current, transposeSemitones])

  // Si la partitura actual no está en la lista de presentación, usar la primera
  useEffect(() => {
    if (!open || presentationScores.length === 0) return
    if (currentScoreId && presentationScores.some((s) => s.id === currentScoreId)) {
      return
    }
    setCurrentScore(presentationScores[0].id, { keepTranspose: true })
  }, [open, presentationScores, currentScoreId, setCurrentScore])

  useEffect(() => {
    renderScore()
  }, [renderScore])

  // Recalcular al redimensionar
  useEffect(() => {
    if (!open) return
    const container = pagesRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      renderScore()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [open, renderScore])

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
      if (!container || pageOffsets.length === 0) return
      const nextIndex = Math.min(Math.max(0, page + delta), pageOffsets.length - 1)
      setPage(nextIndex)
      const top = pageOffsets[nextIndex] || 0
      container.scrollTo({ top, behavior: 'smooth' })
    },
    [page, pageOffsets]
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

  // Sincronizar indicador de página con scroll manual
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      const container = pagesRef.current
      if (!container || pageOffsets.length === 0) return
      const scrollTop = container.scrollTop

      // Buscar el offset de página más cercano
      let closestIdx = 0
      let minDiff = Infinity
      for (let i = 0; i < pageOffsets.length; i++) {
        const diff = Math.abs(scrollTop - pageOffsets[i])
        if (diff < minDiff) {
          minDiff = diff
          closestIdx = i
        }
      }
      setPage(closestIdx)
    })
  }, [pageOffsets])

  // Gestos: swipe horizontal para cambiar canción y arrastre desde borde izquierdo para abrir drawer
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const isEdge = e.clientX < 28 && !drawerOpen
    gestureRef.current = {
      x: e.clientX,
      y: e.clientY,
      axis: null,
      id: e.pointerId,
      isEdgeDrawer: isEdge,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.id !== e.pointerId) return

    const dx = e.clientX - gesture.x
    const dy = e.clientY - gesture.y

    if (gesture.isEdgeDrawer && dx > 30) {
      setDrawerOpen(true)
      gestureRef.current = null
      return
    }

    if (!gesture.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (gesture.axis === 'x') {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* */
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

  // Teclado
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawerOpen) setDrawerOpen(false)
        else onClose()
      } else if (e.key === 'ArrowRight') {
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
        setDrawerOpen((v) => !v)
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
    drawerOpen,
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
      {/* Botón flotante para abrir el menú lateral */}
      <button
        className="presentation-menu-toggle"
        onClick={() => setDrawerOpen(true)}
        title="Abrir controles (H)"
        aria-label="Abrir menú de controles"
      >
        ☰
      </button>

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

      {/* Backdrop del drawer */}
      {drawerOpen && (
        <div
          className="presentation-backdrop"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer lateral deslizable */}
      <div
        className={`presentation-drawer ${drawerOpen ? 'open' : ''}`}
        aria-hidden={!drawerOpen}
      >
        <div className="drawer-header">
          <div className="drawer-title-group">
            <span className="drawer-title">{current.title}</span>
            <span
              className="drawer-set"
              title={
                activePlaylist
                  ? `Set: ${activePlaylist.name}`
                  : 'Todas las partituras visibles'
              }
            >
              {activePlaylist ? activePlaylist.name : 'Todas'} · {songNumber}/{songCount}
            </span>
          </div>
          <button
            className="drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        <div className="drawer-section">
          <span className="drawer-label">Paginación ({page + 1} / {totalPages})</span>
          <div className="drawer-row">
            <button
              className="pres-btn"
              onClick={() => goPage(-1)}
              disabled={page <= 0}
            >
              ↑ Página anterior
            </button>
            <button
              className="pres-btn"
              onClick={() => goPage(1)}
              disabled={page >= totalPages - 1}
            >
              ↓ Página siguiente
            </button>
          </div>
        </div>

        {presentationScores.length > 1 && (
          <div className="drawer-section">
            <span className="drawer-label">Navegación de canciones</span>
            <div className="drawer-row">
              <button
                className="pres-btn"
                onClick={() => goSong(-1)}
              >
                ◀ Anterior
              </button>
              <button
                className="pres-btn"
                onClick={() => goSong(1)}
              >
                Siguiente ▶
              </button>
            </div>
          </div>
        )}

        <div className="drawer-section">
          <span className="drawer-label">Transporte ({pitchLabel})</span>
          <div className="drawer-row">
            <button
              className="pres-btn"
              onClick={() => setTranspose(transposeSemitones - 1)}
            >
              −1 Semitono
            </button>
            <button
              className="pres-btn"
              onClick={() => setTranspose(0)}
              disabled={transposeSemitones === 0}
            >
              Reset
            </button>
            <button
              className="pres-btn"
              onClick={() => setTranspose(transposeSemitones + 1)}
            >
              +1 Semitono
            </button>
          </div>
        </div>

        {current.hasAudio && (
          <div className="drawer-section">
            <span className="drawer-label">Backing Track</span>
            <button
              className="pres-btn play-wide"
              onClick={togglePlay}
              disabled={!audioReady}
            >
              {isPlaying ? '⏸ Pausar Audio' : '▶ Reproducir Audio'}
            </button>
          </div>
        )}

        <div className="drawer-footer">
          <button
            className="pres-btn danger"
            onClick={() => {
              setDrawerOpen(false)
              onClose()
            }}
          >
            ✕ Salir de Presentación (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
