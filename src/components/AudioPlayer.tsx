import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { saveAudio, deleteAudio } from '../lib/audioStorage'
import { buildScorePack, downloadScorePack } from '../lib/scorepack'
import { registerPreviewAudioStop } from '../lib/previewAudio'
import {
  getBackingTrackState,
  loadBackingTrack,
  pauseBackingTrack,
  playBackingTrack,
  seekBackingTrack,
  setBackingTranspose,
  stopBackingTrack,
  subscribeBackingTrack,
  type BackingTrackState,
} from '../lib/backingTrack'
import { AudioProgressBar } from './AudioProgressBar'

export function AudioPlayer() {
  const scores = useAppStore((s) => s.scores)
  const currentScoreId = useAppStore((s) => s.currentScoreId)
  const transposeSemitones = useAppStore((s) => s.transposeSemitones)
  const updateScore = useAppStore((s) => s.updateScore)

  const current = scores.find((s) => s.id === currentScoreId)
  const [track, setTrack] = useState<BackingTrackState>(getBackingTrackState)
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => subscribeBackingTrack(setTrack), [])

  useEffect(() => {
    registerPreviewAudioStop(() => stopBackingTrack())
    return () => registerPreviewAudioStop(null)
  }, [])

  useEffect(() => {
    loadBackingTrack(current?.hasAudio ? current.id : null)
    return () => {
      stopBackingTrack()
    }
  }, [current?.id, current?.hasAudio])

  useEffect(() => {
    setBackingTranspose(transposeSemitones)
  }, [transposeSemitones])

  const togglePlay = () => {
    if (track.isPlaying) pauseBackingTrack()
    else void playBackingTrack()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !current) return

    setTrack((prev) => ({ ...prev, loading: true }))
    try {
      await saveAudio(current.id, file)
      await loadBackingTrack(current.id, { force: true })
      updateScore(current.id, { hasAudio: true })
    } catch (err) {
      console.error('Error guardando audio:', err)
      alert('No se pudo guardar el audio')
    } finally {
      e.target.value = ''
    }
  }

  const clearAudio = async () => {
    if (!current) return
    stopBackingTrack()
    await deleteAudio(current.id)
    await loadBackingTrack(null)
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
              disabled={track.loading}
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

      {current.hasAudio && track.duration > 0 && (
        <div className="audio-progress-row">
          <span className="audio-time">{formatTime(track.currentTime)}</span>
          <AudioProgressBar
            currentTime={track.currentTime}
            duration={track.duration}
            onSeek={seekBackingTrack}
          />
          <span className="audio-time">{formatTime(track.duration)}</span>
        </div>
      )}

      {current.hasAudio && (
        <div className="audio-controls">
          <button
            className="play-btn"
            onClick={togglePlay}
            disabled={!track.loaded || track.loading}
            title={track.isPlaying ? 'Pausar' : 'Reproducir'}
            aria-label={track.isPlaying ? 'Pausar backing track' : 'Reproducir backing track'}
          >
            {track.loading ? '…' : track.isPlaying ? '⏸' : '▶'}
          </button>
          <button
            className="play-btn stop"
            onClick={stopBackingTrack}
            disabled={!track.loaded || track.loading}
            title="Detener y volver al inicio"
            aria-label="Detener y volver al inicio"
          >
            ⏹
          </button>

          <div className="audio-info">
            <span className="status">
              {track.loading
                ? 'Cargando…'
                : track.isPlaying
                  ? 'Reproduciendo backing track'
                  : track.loaded
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

          {track.duration > 0 && (
            <span className="duration">{formatTime(track.duration)}</span>
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
