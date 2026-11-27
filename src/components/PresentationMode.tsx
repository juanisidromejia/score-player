import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { OpenSheetMusicDisplay, TransposeCalculator } from 'opensheetmusicdisplay'
import { useAppStore } from '../store'
import { getPresentationScores } from '../lib/visibleScores'
import { computePageLayout } from '../lib/presentationLayout'
import { getMusicXmlMeasureTempos } from '../lib/musicXmlTempo'
import {
  getBackingTrackState,
  loadBackingTrack,
  pauseBackingTrack,
  playBackingTrack,
  resetBackingRate,
  seekBackingTrack,
  setBackingRate,
  setBackingTranspose,
  setBackingVolume,
  stopBackingTrack,
  subscribeBackingTrack,
  TEMPO_STEPS,
  type BackingTrackState,
} from '../lib/backingTrack'
import { AudioProgressBar } from './AudioProgressBar'
import { TransposeControls } from './TransposeControls'

interface Props {
  open: boolean
  onClose: () => void
}

export function PresentationMode({ open, onClose }: Props) {
  const scores = useAppStore((s) => s.scores)
  const playlists = useAppStore((s) => s.playlists)
  const previewNavigation = useAppStore((s) => s.previewNavigation)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const transposeSemitones = useAppStore((s) => s.transposeSemitones)
  const setTranspose = useAppStore((s) => s.setTranspose)
  const respectXmlSystemBreaks = useAppStore((s) => s.respectXmlSystemBreaks)
  const setRespectXmlSystemBreaks = useAppStore((s) => s.setRespectXmlSystemBreaks)
  const setCurrentScore = useAppStore((s) => s.setCurrentScore)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const selectedRepertoire = useAppStore((s) => s.selectedRepertoire)
  const selectedTag = useAppStore((s) => s.selectedTag)

  const activePlaylist =
    previewNavigation.origin === 'set'
      ? playlists.find((p) => p.id === previewNavigation.playlistId)
      : undefined

  const presentationScores = useMemo(
    () =>
      getPresentationScores({
        scores,
        playlists,
        previewNavigation,
        searchQuery,
        selectedRepertoire,
        selectedTag,
      }),
    [
      scores,
      playlists,
      previewNavigation,
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [track, setTrack] = useState<BackingTrackState>(getBackingTrackState)
  const [activeMeasure, setActiveMeasure] = useState<number | null>(null)
  const [scoreRenderVersion, setScoreRenderVersion] = useState(0)
  const activeMeasureElementsRef = useRef<SVGElement[]>([])

  const totalPages = Math.max(pageOffsets.length, 1)

  const measureTempos = useMemo(
    () => getMusicXmlMeasureTempos(current?.musicxml ?? '', current?.scoreFollowBpm ?? 120),
    [current?.musicxml, current?.scoreFollowBpm]
  )

  useEffect(() => subscribeBackingTrack(setTrack), [])

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

    const containerW = container.clientWidth
    if (!containerW) return
    const baseWidth = Math.max(720, containerW) * Math.pow(1.25, zoomStep)
    const autoZoom = Math.min(1, containerW / baseWidth)
    const zoom = Math.max(0.3, Math.min(1, autoZoom * manualZoom))

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

        const availableH = container.clientHeight
        if (!availableH) return

        const paperRect = paper.getBoundingClientRect()
        const systems = Array.from(paper.querySelectorAll('svg > g.osmd-staffline')).map(
          (el) => {
            const rect = el.getBoundingClientRect()
            return {
              top: rect.top - paperRect.top,
              bottom: rect.bottom - paperRect.top,
            }
          }
        )
        const { offsets, counts } = computePageLayout(
          systems,
          availableH,
          paper.scrollHeight
        )
        const targetPerPage = Math.max(2, Math.min(5, Math.round(availableH / 220)))

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

        setPageOffsets(offsets)
        setPage(0)
        setScoreRenderVersion((version) => version + 1)
      })
      .catch((err: unknown) => {
        if (renderId !== renderIdRef.current) return
        console.error('Error renderizando MusicXML con OSMD:', err)
        paper.innerHTML =
          '<p style="color: var(--text); text-align: center; padding: 2rem;">Error al cargar la partitura</p>'
      })
  }, [open, current, respectXmlSystemBreaks, zoomStep, manualZoom, transposeSemitones])

  // Seguimiento por compás con tempo extraído del MusicXML y offset configurable.
  // El tiempo de Tone.js se expresa en segundos de la pista original, incluso al variar playbackRate.
  useEffect(() => {
    activeMeasureElementsRef.current.forEach((element) =>
      element.classList.remove('score-follow-active-note')
    )
    activeMeasureElementsRef.current = []

    if (
      !open ||
      !current?.scoreFollowEnabled ||
      !current.hasAudio ||
      !track.loaded ||
      !osmdRef.current ||
      !paperRef.current
    ) {
      setActiveMeasure(null)
      return
    }

    const numerator = Math.max(1, current.scoreFollowNumerator ?? 4)
    const denominator = Math.max(1, current.scoreFollowDenominator ?? 4)
    const startOffset = Math.max(0, current.scoreFollowStartOffset ?? 0)
    const elapsed = track.currentTime - startOffset

    if (elapsed < 0) {
      setActiveMeasure(null)
      return
    }

    const osmd = osmdRef.current as unknown as {
      GraphicSheet?: { MeasureList?: Array<Array<{
        staffEntries?: Array<{ graphicalVoiceEntries?: Array<{ notes?: Array<{ getSVGGElement?: () => SVGElement | undefined }> }> }>
      }>> }
      graphic?: { measureList?: Array<Array<{
        staffEntries?: Array<{ graphicalVoiceEntries?: Array<{ notes?: Array<{ getSVGGElement?: () => SVGElement | undefined }> }> }>
      }>> }
    }
    const measureList = osmd.GraphicSheet?.MeasureList ?? osmd.graphic?.measureList
    if (!measureList?.length) return

    let remaining = elapsed
    let measureIndex = 0
    while (measureIndex < measureList.length - 1) {
      const measureBpm = measureTempos[measureIndex] ?? current.scoreFollowBpm ?? 120
      const measureSeconds = (60 / measureBpm) * numerator * (4 / denominator)
      if (remaining < measureSeconds) break
      remaining -= measureSeconds
      measureIndex += 1
    }
    setActiveMeasure(measureIndex + 1)

    const graphicalStaves = measureList[measureIndex] ?? []
    const noteElements: SVGElement[] = []
    for (const graphicalMeasure of graphicalStaves) {
      for (const staffEntry of graphicalMeasure?.staffEntries ?? []) {
        for (const voiceEntry of staffEntry.graphicalVoiceEntries ?? []) {
          for (const note of voiceEntry.notes ?? []) {
            const element = note.getSVGGElement?.()
            if (element && !noteElements.includes(element)) {
              element.classList.add('score-follow-active-note')
              noteElements.push(element)
            }
          }
        }
      }
    }
    activeMeasureElementsRef.current = noteElements

    // Cambiar de página cuando el compás activo pertenece a otra página.
    const firstNote = noteElements[0]
    const paper = paperRef.current
    if (firstNote && paper && pageOffsets.length > 1) {
      const paperRect = paper.getBoundingClientRect()
      const noteRect = firstNote.getBoundingClientRect()
      const documentY = noteRect.top - paperRect.top + (pageOffsets[page] ?? 0)
      let targetPage = 0
      for (let index = 1; index < pageOffsets.length; index++) {
        if (pageOffsets[index] <= documentY) targetPage = index
        else break
      }
      if (targetPage !== page) setPage(targetPage)
    }
  }, [
    open,
    current?.id,
    current?.scoreFollowEnabled,
    current?.scoreFollowBpm,
    measureTempos,
    current?.scoreFollowNumerator,
    current?.scoreFollowDenominator,
    current?.scoreFollowStartOffset,
    current?.hasAudio,
    track.loaded,
    track.currentTime,
    pageOffsets,
    scoreRenderVersion,
    page,
  ])

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

  // Backing track compartido con el preview. Si está cerrado no se toca el
  // cargador global: AudioPlayer es el responsable de la partitura en Opciones.
  useEffect(() => {
    if (!open) return
    loadBackingTrack(current?.hasAudio ? current.id : null)
  }, [open, current?.id, current?.hasAudio])

  useEffect(() => {
    setBackingTranspose(transposeSemitones)
  }, [transposeSemitones])

  useEffect(() => {
    if (!open) stopBackingTrack()
  }, [open])

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

  const togglePlay = () => {
    if (track.isPlaying) pauseBackingTrack()
    else void playBackingTrack()
  }

  const stopPlayback = stopBackingTrack
  const seek = seekBackingTrack

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) < 10) return
    if (Date.now() - wheelCooldownRef.current < 250) return
    wheelCooldownRef.current = Date.now()
    goPage(e.deltaY > 0 ? 1 : -1)
  }

  // Gestos: swipe vertical cambia de hoja, horizontal de canción y el borde derecho abre el drawer
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const isEdge = e.clientX > window.innerWidth - 28 && !drawerOpen
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

    if (gesture.isEdgeDrawer && dx < -30) {
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
        if (current?.hasAudio && track.loaded) togglePlay()
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
    track.loaded,
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
      <header className="presentation-topbar">
        <button
          className="pres-top-btn exit"
          onClick={onClose}
          title="Salir de la presentación (Esc)"
          aria-label="Salir de la presentación"
        >
          ‹
        </button>

        <div className="pres-top-title">
          <strong>{current.title}</strong>
          <span>
            {activePlaylist ? activePlaylist.name : 'Todas'} · {songNumber}/{songCount} · {page + 1}/{totalPages}
            {current.scoreFollowEnabled && activeMeasure !== null ? ` · Compás ${activeMeasure}` : ''}
          </span>
        </div>

        <TransposeControls compact />

        <button
          className="pres-top-btn"
          onClick={() => setDrawerOpen(true)}
          title="Abrir controles (H)"
          aria-label="Abrir menú de controles"
        >
          ☰
        </button>
      </header>

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

      {current.hasAudio && (
        <footer className="presentation-audio-bar">
          <AudioProgressBar
            currentTime={track.currentTime}
            duration={track.duration}
            onSeek={seek}
            label="Posición del backing track"
          />
          <div className="presentation-audio-row">
            <span className="audio-time">{formatTime(track.currentTime)}</span>
            <button
              className="audio-bar-btn"
              onClick={togglePlay}
              disabled={!track.loaded}
              title={track.isPlaying ? 'Pausar backing track' : 'Reproducir backing track'}
              aria-label={track.isPlaying ? 'Pausar backing track' : 'Reproducir backing track'}
            >
              {track.isPlaying ? '⏸' : '▶'}
            </button>
            <button
              className="audio-bar-btn"
              onClick={stopPlayback}
              disabled={!track.loaded}
              title="Detener y volver al inicio"
              aria-label="Detener y volver al inicio"
            >
              ⏹
            </button>
            <span className="audio-time">{formatTime(track.duration)}</span>
            <div className="tempo-control" title="Velocidad del backing track (no afecta al MIDI)">
              <select
                value={track.rate}
                onChange={(e) => setBackingRate(Number(e.target.value))}
                aria-label="Tempo del backing track"
              >
                {TEMPO_STEPS.map((rate) => (
                  <option key={rate} value={rate}>
                    {Math.round(rate * 100)}%
                  </option>
                ))}
              </select>
              <button
                onClick={resetBackingRate}
                disabled={track.rate === 1}
                title="Volver al 100%"
                aria-label="Volver al tempo original 100%"
              >
                ↺
              </button>
            </div>
            <input
              className="audio-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={track.volume}
              onChange={(e) => setBackingVolume(Number(e.target.value))}
              title="Volumen"
              aria-label="Volumen"
            />
          </div>
        </footer>
      )}

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

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
