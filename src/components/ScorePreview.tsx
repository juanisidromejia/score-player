import { useEffect, useMemo, useRef, useState } from 'react'
import { OpenSheetMusicDisplay, TransposeCalculator } from 'opensheetmusicdisplay'
import { useAppStore } from '../store'
import { getPreviewNavigationScores } from '../lib/visibleScores'
import { onMidiStop, parseMelody, playMidi, stopMidi } from '../lib/midiPlayback'
import { stopPreviewAudio } from '../lib/previewAudio'

const MIN_ZOOM = 0.3
const MAX_ZOOM = 2

export function ScorePreview() {
  const paperRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const loadedRef = useRef(false)
  const transposeRef = useRef(0)
  const zoomRef = useRef(0.5)
  const gestureRef = useRef<{
    id: number
    x: number
    y: number
    axis: 'x' | 'y' | null
  } | null>(null)
  const swipeCooldownRef = useRef(0)

  const scores = useAppStore((s) => s.scores)
  const playlists = useAppStore((s) => s.playlists)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const previewNavigation = useAppStore((s) => s.previewNavigation)
  const openScore = useAppStore((s) => s.openScore)
  const transposeSemitones = useAppStore((s) => s.transposeSemitones)

  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(0.5)
  const [isPlayingMidi, setIsPlayingMidi] = useState(false)
  const [midiProgress, setMidiProgress] = useState({ current: 0, total: 0 })

  transposeRef.current = transposeSemitones
  zoomRef.current = zoom
  const current = scores.find((s) => s.id === currentScoreId)
  const melody = useMemo(() => parseMelody(current?.musicxml || ''), [current?.musicxml])
  const navigationScores = useMemo(
    () => getPreviewNavigationScores({ scores, playlists, previewNavigation }),
    [scores, playlists, previewNavigation]
  )
  const navigationIndex = navigationScores.findIndex((s) => s.id === currentScoreId)
  const playlistName = previewNavigation.origin === 'set'
    ? playlists.find((p) => p.id === previewNavigation.playlistId)?.name
    : undefined

  useEffect(() => onMidiStop(() => {
    setIsPlayingMidi(false)
    setMidiProgress({ current: 0, total: 0 })
  }), [])

  useEffect(() => () => stopMidi(), [])

  useEffect(() => {
    const container = paperRef.current
    if (!container || !current) return

    stopMidi()
    osmdRef.current?.dispose()
    osmdRef.current = null
    loadedRef.current = false
    container.innerHTML = ''

    if (!current.musicxml) {
      setLoading(false)
      container.innerHTML =
        '<p class="score-placeholder">Esta partitura se guardó en formato ABC antiguo. Impórtala de nuevo en MusicXML.</p>'
      return
    }

    setLoading(true)
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
        osmd.zoom = zoomRef.current
        osmd.Sheet.Transpose = transposeRef.current
        osmd.updateGraphic()
        osmd.render()
        loadedRef.current = true
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('Error renderizando el preview:', err)
        container.innerHTML =
          '<p class="score-placeholder">No se pudo mostrar la partitura</p>'
        setLoading(false)
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
    osmd.zoom = zoom
    osmd.render()
  }, [zoom])

  useEffect(() => {
    const osmd = osmdRef.current
    const container = paperRef.current
    if (!osmd || !container || !loadedRef.current) return
    osmd.Sheet.Transpose = transposeSemitones
    osmd.updateGraphic()
    osmd.render()
  }, [transposeSemitones])

  const changeZoom = (delta: number) => {
    setZoom((z) => Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)) * 10) / 10)
  }

  const goScore = (delta: number) => {
    if (navigationIndex < 0) return
    const target = navigationScores[navigationIndex + delta]
    if (!target) return
    openScore(target.id, previewNavigation)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    gestureRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      axis: null,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.id !== e.pointerId || gesture.axis) return
    const dx = e.clientX - gesture.x
    const dy = e.clientY - gesture.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return
    gesture.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    gestureRef.current = null
    if (!gesture || gesture.id !== e.pointerId || gesture.axis !== 'x') return
    if (Date.now() - swipeCooldownRef.current < 350) return

    const dx = e.clientX - gesture.x
    const dy = e.clientY - gesture.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return
    swipeCooldownRef.current = Date.now()
    goScore(dx < 0 ? 1 : -1)
  }

  const handlePointerCancel = () => {
    gestureRef.current = null
  }

  const toggleMidi = async () => {
    if (isPlayingMidi) {
      stopMidi()
      return
    }
    stopPreviewAudio()
    await playMidi(melody, {
      onEnd: () => setIsPlayingMidi(false),
      onProgress: (current, total) => setMidiProgress({ current, total }),
    })
    setIsPlayingMidi(true)
  }

  if (!current) return null

  return (
    <div className="score-preview">
      <div className="score-preview-controls">
        <div className="preview-zoom" aria-label="Zoom del preview">
          <button
            onClick={() => changeZoom(-0.1)}
            disabled={zoom <= MIN_ZOOM}
            title="Reducir zoom del preview"
            aria-label="Reducir zoom del preview"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => changeZoom(0.1)}
            disabled={zoom >= MAX_ZOOM}
            title="Aumentar zoom del preview"
            aria-label="Aumentar zoom del preview"
          >
            +
          </button>
        </div>

        <div className="preview-midi">
          <button
            className={isPlayingMidi ? 'playing' : ''}
            onClick={toggleMidi}
            disabled={melody.length === 0}
            title={isPlayingMidi ? 'Pausar melodía MIDI' : 'Reproducir melodía MIDI'}
            aria-label={isPlayingMidi ? 'Detener melodía MIDI' : 'Reproducir melodía MIDI'}
          >
            {isPlayingMidi ? '⏸' : '▶'} <span>Melodía</span>
          </button>
          <button
            onClick={() => stopMidi()}
            disabled={!isPlayingMidi}
            title="Detener melodía MIDI"
            aria-label="Detener melodía MIDI"
          >
            ⏹
          </button>
        </div>
      </div>

      {navigationScores.length > 1 && (
        <div className="preview-nav-context" aria-live="polite">
          <span title={playlistName ?? 'Todas las partituras'}>
            {playlistName ? `Set · ${playlistName}` : 'Todas'}
          </span>
          <span>
            {navigationIndex >= 0 ? navigationIndex + 1 : '–'}/{navigationScores.length}
          </span>
        </div>
      )}

      {melody.length > 0 && (
        <div className="preview-midi-progress">
          <span className="midi-progress-label">Melodía MIDI</span>
          <div className="midi-progress-track" aria-hidden="true">
            <span
              style={{
                width: `${Math.min(100, midiProgress.total > 0 ? (midiProgress.current / midiProgress.total) * 100 : 0)}%`,
              }}
            />
          </div>
          <span className="audio-time">
            {formatTime(midiProgress.current)} / {formatTime(midiProgress.total)}
          </span>
        </div>
      )}

      <div
        ref={paperRef}
        className="score-preview-paper"
        aria-label="Partitura. Desliza para cambiar de partitura"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
      {loading && current.musicxml && (
        <div className="score-preview-loading">Cargando partitura…</div>
      )}
    </div>
  )
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
