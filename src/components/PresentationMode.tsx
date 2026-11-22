import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { OpenSheetMusicDisplay, TransposeCalculator } from 'opensheetmusicdisplay'
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
  const respectXmlSystemBreaks = useAppStore((s) => s.respectXmlSystemBreaks)
  const setRespectXmlSystemBreaks = useAppStore((s) => s.setRespectXmlSystemBreaks)
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
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const renderIdRef = useRef(0)

  const gestureRef = useRef<{
    x: number
    y: number
    axis: 'x' | 'y' | null
    id: number
    isEdgeDrawer?: boolean
  } | null>(null)
  const swipeCooldownRef = useRef(0)
  const wheelCooldownRef = useRef(0)
  const zoomStepRef = useRef(0)

  const [page, setPage] = useState(0)
  const [pageOffsets, setPageOffsets] = useState<number[]>([0])
  const [zoomStep, setZoomStep] = useState(0)
  const [manualZoom, setManualZoom] = useState(1)
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

  // Render MusicXML score con OSMD y calcular paginación
  const renderScore = useCallback(() => {
    const container = pagesRef.current
    const paper = paperRef.current
    if (!open || !container || !paper || !current) return

    const renderId = ++renderIdRef.current
    osmdRef.current?.dispose()
    paper.innerHTML = ''

    if (!current.musicxml) {
      paper.innerHTML =
        '<p class="score-placeholder">Esta partitura se guardó en formato ABC antiguo. Vuelve a crearla en MusicXML o importa un .scorepack actualizado.</p>'
      setPageOffsets([0])
      setPage(0)
      return
    }

    const containerW = container.clientWidth || window.innerWidth
    const containerH = container.clientHeight || window.innerHeight
    const baseWidth = Math.max(720, containerW) * Math.pow(1.25, zoomStep)
    const autoZoom = Math.min(1, containerW / baseWidth)
    const zoom = Math.max(0.3, Math.min(1, autoZoom * manualZoom))
    const targetPerPage = Math.max(2, Math.min(5, Math.round(containerH / 220)))

    const osmd = new OpenSheetMusicDisplay(paper, {
      autoResize: false,
      backend: 'svg',
      newSystemFromXML: respectXmlSystemBreaks,
      newPageFromXML: respectXmlSystemBreaks,
    })
    osmd.TransposeCalculator = new TransposeCalculator()
    osmdRef.current = osmd

    osmd
      .load(current.musicxml)
      .then(() => {
        if (renderId !== renderIdRef.current) return
        osmd.zoom = zoom
        osmd.Sheet.Transpose = transposeSemitones
        osmd.updateGraphic()
        osmd.render()
      })
      .then(() => {
        if (renderId !== renderIdRef.current) return
        if (!pagesRef.current || !paperRef.current) return
        if (!paper.querySelector('svg')) return

        const paperRect = paper.getBoundingClientRect()
        const paperHeight = paper.scrollHeight
        const systems = Array.from(paper.querySelectorAll('svg > g.osmd-staffline'))

        const maxH = Math.max(200, containerH - 24)
        let offsets: number[]
        let counts: number[]

        if (systems.length > 0) {
          // Agrupar sistemas completos hasta llenar cada pantalla.
          offsets = [0]
          counts = []
          let groupTop = systems[0].getBoundingClientRect().top - paperRect.top
          let groupBottom = 0
          let count = 0

          systems.forEach((system) => {
            const rect = system.getBoundingClientRect()
            const top = rect.top - paperRect.top
            const bottom = rect.bottom - paperRect.top

            if (groupBottom > 0 && bottom - groupTop > maxH) {
              counts.push(count)
              offsets.push(top)
              groupTop = top
              count = 0
            }
            count++
            groupBottom = bottom
          })
          counts.push(count)
        } else {
          const pageCount = Math.max(1, Math.ceil(paperHeight / maxH))
          offsets = Array.from({ length: pageCount }, (_, i) => i * maxH)
          counts = offsets.map(() => 1)
        }

        const minPerPage = Math.min(...counts)
        if (
          manualZoom === 1 &&
          zoomStep < 3 &&
          zoom > 0.45 &&
          systems.length >= targetPerPage * 2 &&
          minPerPage < targetPerPage
        ) {
          const next = Math.min(3, zoomStep + 1)
          if (next > zoomStepRef.current) {
            zoomStepRef.current = next
            setZoomStep(next)
          }
          return
        }

        offsets = offsets.filter((offset, i, all) => i === 0 || offset !== all[i - 1])

        if (offsets.length <= 1 || paperHeight <= maxH) {
          setPageOffsets([0])
          setPage(0)
          return
        }

        setPageOffsets(offsets)
        setPage(0)
      })
      .catch((err: unknown) => {
        if (renderId !== renderIdRef.current) return
        console.error('Error renderizando MusicXML con OSMD:', err)
        paper.innerHTML =
          '<p style="color: var(--text); text-align: center; padding: 2rem;">Error al cargar la partitura</p>'
      })
  }, [open, current, respectXmlSystemBreaks, zoomStep, manualZoom, transposeSemitones])

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

  useEffect(() => {
    zoomStepRef.current = 0
    setZoomStep(0)
  }, [current?.id, respectXmlSystemBreaks])

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
      setPage((current) =>
        Math.min(Math.max(0, current + delta), Math.max(0, pageOffsets.length - 1))
      )
    },
    [pageOffsets]
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

  const stopPlayback = () => {
    if (!playerRef.current || !audioReady) return
    try { playerRef.current.stop() } catch { /* */ }
    clearEndTimer()
    resumeOffsetRef.current = 0
    setIsPlaying(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) < 10) return
    if (Date.now() - wheelCooldownRef.current < 250) return
    wheelCooldownRef.current = Date.now()
    goPage(e.deltaY > 0 ? 1 : -1)
  }

  // Gestos: swipe vertical cambia de hoja, horizontal de canción y el borde izquierdo abre el drawer
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
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* */
      }
    }

    if (gesture.axis && e.cancelable) {
      e.preventDefault()
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    gestureRef.current = null

    if (!gesture || gesture.id !== e.pointerId || !gesture.axis) return
    if (Date.now() - swipeCooldownRef.current < 350) return

    const dx = e.clientX - gesture.x
    const dy = e.clientY - gesture.y

    if (gesture.axis === 'x') {
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return
      swipeCooldownRef.current = Date.now()
      goSong(dx < 0 ? 1 : -1)
    } else {
      if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx) * 1.2) return
      swipeCooldownRef.current = Date.now()
      goPage(dy < 0 ? 1 : -1)
    }
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

  const changeZoom = (delta: number) => {
    setManualZoom((z) =>
      Math.max(0.4, Math.min(1, Math.round((z + delta) * 10) / 10))
    )
  }

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

      <div className="presentation-floating">
        {current.hasAudio && (
          <>
            <button
              className="presentation-float-btn audio"
              onClick={togglePlay}
              disabled={!audioReady}
              title={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
              aria-label={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              className="presentation-float-btn stop"
              onClick={stopPlayback}
              disabled={!audioReady}
              title="Detener y volver al inicio"
              aria-label="Detener y volver al inicio"
              onPointerDown={(e) => e.stopPropagation()}
            >
              ⏹
            </button>
          </>
        )}
        <button
          className="presentation-float-btn exit"
          onClick={onClose}
          title="Salir de la presentación (Esc)"
          aria-label="Salir de la presentación"
          onPointerDown={(e) => e.stopPropagation()}
        >
          ✕
        </button>
      </div>

      <div
        className="presentation-pages"
        ref={pagesRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          key={current.id}
          ref={paperRef}
          className="presentation-paper"
          style={{ transform: `translateY(-${pageOffsets[page] || 0}px)` }}
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

        <div className="drawer-section">
          <span className="drawer-label">Diseño de la partitura</span>
          <label className="drawer-toggle">
            <input
              type="checkbox"
              checked={respectXmlSystemBreaks}
              onChange={(e) => setRespectXmlSystemBreaks(e.target.checked)}
            />
            <span>Respetar saltos de sistema de MuseScore</span>
          </label>
          <p className="drawer-hint">
            Usa los saltos guardados en el XML. Si está desactivado, OSMD
            calcula el layout automáticamente para la pantalla.
          </p>
        </div>

        <div className="drawer-section">
          <span className="drawer-label">Zoom ({Math.round(manualZoom * 100)}%)</span>
          <div className="drawer-row">
            <button
              className="pres-btn"
              onClick={() => changeZoom(-0.1)}
              disabled={manualZoom <= 0.4}
            >
              − Reducir
            </button>
            <button
              className="pres-btn"
              onClick={() => setManualZoom(1)}
              disabled={manualZoom === 1}
            >
              Reset
            </button>
            <button
              className="pres-btn"
              onClick={() => changeZoom(0.1)}
              disabled={manualZoom >= 1}
            >
              + Ampliar
            </button>
          </div>
          <p className="drawer-hint">
            Reduce el tamaño para que la partitura quepa en menos hojas.
          </p>
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

      </div>
    </div>
  )
}
