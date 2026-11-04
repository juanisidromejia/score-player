import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { useAppStore } from '../store'
import { saveAudio, loadAudio, deleteAudio } from '../lib/audioStorage'
import { buildScorePack, downloadScorePack } from '../lib/scorepack'

export function AudioPlayer() {
  const scores = useAppStore((s) => s.scores)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const transposeSemitones = useAppStore((s) => s.transposeSemitones)
  const updateScore = useAppStore((s) => s.updateScore)

  const current = scores.find((s) => s.id === currentScoreId)

  const playerRef = useRef<Tone.Player | null>(null)
  const pitchShiftRef = useRef<Tone.PitchShift | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cargar audio desde IndexedDB cuando cambia la partitura
  useEffect(() => {
    let cancelled = false

    async function setup() {
      // cleanup
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
      setIsLoaded(false)
      setDuration(0)

      if (!current?.hasAudio) return

      setLoading(true)
      try {
        const blob = await loadAudio(current.id)
        if (cancelled || !blob) {
          setLoading(false)
          return
        }

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
            if (cancelled) return
            setIsLoaded(true)
            setDuration(player.buffer.duration)
            setLoading(false)
          },
        }).connect(pitchShift)

        playerRef.current = player
        pitchShiftRef.current = pitchShift
      } catch (err) {
        console.error('Error cargando audio:', err)
        setLoading(false)
      }
    }

    setup()

    return () => {
      cancelled = true
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
    }
  }, [current?.id, current?.hasAudio])

  // Actualizar pitch en tiempo real
  useEffect(() => {
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = transposeSemitones
    }
  }, [transposeSemitones])

  const togglePlay = async () => {
    if (!playerRef.current || !isLoaded) return
    await Tone.start()

    if (isPlaying) {
      playerRef.current.stop()
      setIsPlaying(false)
    } else {
      playerRef.current.start()
      setIsPlaying(true)
      const dur = playerRef.current.buffer.duration
      setTimeout(() => {
        setIsPlaying(false)
      }, dur * 1000)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !current) return

    setLoading(true)
    try {
      await saveAudio(current.id, file)
      updateScore(current.id, { hasAudio: true })
    } catch (err) {
      console.error('Error guardando audio:', err)
      alert('No se pudo guardar el audio')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const clearAudio = async () => {
    if (!current) return
    await deleteAudio(current.id)
    updateScore(current.id, { hasAudio: false })
  }

  const handleExport = async () => {
    if (!current) return
    setExporting(true)
    try {
      const pack = await buildScorePack(current)
      downloadScorePack(pack)
    } catch (err) {
      console.error(err)
      alert('Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  if (!current) return null

  return (
    <div className="audio-player">
      <div className="audio-header">
        <span className="audio-label">Backing track</span>
        <div className="audio-header-actions">
          <button
            className="btn-small"
            onClick={handleExport}
            disabled={exporting}
            title="Exportar partitura + audio"
          >
            {exporting ? '…' : '⬇ Exportar combo'}
          </button>
          {current.hasAudio ? (
            <button className="btn-small" onClick={clearAudio}>
              Quitar audio
            </button>
          ) : (
            <button
              className="btn-small primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              + Cargar audio
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.ogg,.oga,.opus,audio/ogg"
          hidden
          onChange={handleFile}
        />
      </div>

      {current.hasAudio && (
        <div className="audio-controls">
          <button
            className="play-btn"
            onClick={togglePlay}
            disabled={!isLoaded || loading}
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {loading ? '…' : isPlaying ? '⏸' : '▶'}
          </button>

          <div className="audio-info">
            <span className="status">
              {loading
                ? 'Cargando…'
                : isPlaying
                  ? 'Reproduciendo'
                  : isLoaded
                    ? 'Listo (guardado)'
                    : 'Sin audio'}
            </span>
            <span className={`pitch-hint ${transposeSemitones !== 0 ? 'active' : ''}`}>
              🎵 Transporte audio: {' '}
              {transposeSemitones === 0
                ? 'original'
                : `${transposeSemitones > 0 ? '+' : ''}${transposeSemitones} st`}
              {' '}(igual que la partitura)
            </span>
          </div>

          {duration > 0 && (
            <span className="duration">{formatTime(duration)}</span>
          )}
        </div>
      )}

      {!current.hasAudio && (
        <p className="audio-hint">
          Carga MP3, WAV u OGG. Quedará guardado y se transportará junto con la partitura.
        </p>
      )}
    </div>
  )
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
