import * as Tone from 'tone'
import { loadAudio } from './audioStorage'
import { stopMidi } from './midiPlayback'

export const TEMPO_STEPS = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]

export interface BackingTrackState {
  scoreId: string | null
  loading: boolean
  loaded: boolean
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  rate: number
}

const INITIAL_STATE: BackingTrackState = {
  scoreId: null,
  loading: false,
  loaded: false,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.85,
  rate: 1,
}

let state: BackingTrackState = { ...INITIAL_STATE }
const listeners = new Set<(state: BackingTrackState) => void>()

let player: Tone.GrainPlayer | null = null
let pitchShift: Tone.PitchShift | null = null
let objectUrl: string | null = null
let loadToken = 0
let tickTimer: ReturnType<typeof setInterval> | null = null
let lastTickAt = 0
let transpose = 0

function emit() {
  const snapshot = { ...state }
  listeners.forEach((listener) => listener(snapshot))
}

export function subscribeBackingTrack(listener: (state: BackingTrackState) => void) {
  listeners.add(listener)
  listener({ ...state })
  return () => {
    listeners.delete(listener)
  }
}

export function getBackingTrackState() {
  return { ...state }
}

function toDb(volume: number) {
  return volume <= 0 ? -Infinity : 20 * Math.log10(volume)
}

function stopTicking() {
  if (tickTimer !== null) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

function startTicking() {
  stopTicking()
  lastTickAt = Date.now()
  tickTimer = setInterval(() => {
    const now = Date.now()
    state.currentTime = Math.min(
      state.duration,
      state.currentTime + ((now - lastTickAt) / 1000) * state.rate
    )
    lastTickAt = now
    emit()
    if (state.currentTime >= state.duration - 0.01) finish()
  }, 200)
}

function finish() {
  if (player) {
    try { player.stop() } catch { /* */ }
  }
  stopTicking()
  state.isPlaying = false
  state.currentTime = 0
  emit()
}

function disposeAudio() {
  stopTicking()
  if (player) {
    try { player.stop() } catch { /* */ }
    player.dispose()
    player = null
  }
  if (pitchShift) {
    pitchShift.dispose()
    pitchShift = null
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
}

export async function loadBackingTrack(
  scoreId: string | null,
  options?: { force?: boolean }
) {
  if (
    !options?.force &&
    state.scoreId === scoreId &&
    (state.loaded || state.loading)
  ) {
    return
  }
  const token = ++loadToken

  disposeAudio()
  state = {
    ...INITIAL_STATE,
    scoreId,
    loading: Boolean(scoreId),
    volume: state.volume,
  }
  emit()

  if (!scoreId) return

  try {
    const blob = await loadAudio(scoreId)
    if (token !== loadToken) return
    if (!blob) {
      state.loading = false
      emit()
      return
    }

    objectUrl = URL.createObjectURL(blob)
    pitchShift = new Tone.PitchShift({
      pitch: transpose,
      windowSize: 0.1,
    }).toDestination()

    const grain = new Tone.GrainPlayer({
      url: objectUrl,
      grainSize: 0.12,
      overlap: 0.04,
      playbackRate: state.rate,
      onload: () => {
        if (token !== loadToken) return
        state.loading = false
        state.loaded = true
        state.duration = grain.buffer.duration
        emit()
      },
    })
    grain.volume.value = toDb(state.volume)
    grain.connect(pitchShift)
    player = grain
  } catch (err) {
    if (token !== loadToken) return
    console.error('Error cargando audio:', err)
    state.loading = false
    emit()
  }
}

export async function playBackingTrack() {
  if (!player || !state.loaded) return
  await Tone.start()
  stopMidi()

  if (state.currentTime >= state.duration - 0.01) state.currentTime = 0
  player.start(Tone.now(), state.currentTime)
  state.isPlaying = true
  emit()
  startTicking()
}

export function pauseBackingTrack() {
  if (!player || !state.isPlaying) return
  try { player.stop() } catch { /* */ }
  stopTicking()
  state.isPlaying = false
  emit()
}

export function stopBackingTrack() {
  if (player && state.isPlaying) {
    try { player.stop() } catch { /* */ }
  }
  stopTicking()
  state.isPlaying = false
  state.currentTime = 0
  emit()
}

export function seekBackingTrack(seconds: number) {
  if (!player || !state.loaded) return
  const wasPlaying = state.isPlaying
  const offset = Math.max(0, Math.min(seconds, state.duration))
  try { player.stop() } catch { /* */ }
  stopTicking()
  state.currentTime = offset
  if (wasPlaying) {
    player.start(Tone.now(), offset)
    startTicking()
  }
  emit()
}

export function setBackingVolume(volume: number) {
  state.volume = Math.max(0, Math.min(1, volume))
  if (player) player.volume.value = toDb(state.volume)
  emit()
}

export function setBackingRate(rate: number) {
  const next = TEMPO_STEPS.reduce((best, step) =>
    Math.abs(step - rate) < Math.abs(best - rate) ? step : best
  , TEMPO_STEPS[3])
  state.rate = next
  if (player) player.playbackRate = next
  if (state.isPlaying) lastTickAt = Date.now()
  emit()
}

export function setBackingTranspose(semitones: number) {
  transpose = semitones
  if (pitchShift) pitchShift.pitch = semitones
}

export function resetBackingRate() {
  setBackingRate(1)
}

export function releaseBackingTrack() {
  stopBackingTrack()
}
