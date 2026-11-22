import * as Tone from 'tone'

export interface MelodyEvent {
  time: number
  frequency: number
  duration: number
}

export interface MidiCallbacks {
  onEnd?: () => void
  onProgress?: (current: number, total: number) => void
}

const STEP_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

let piano: Tone.PolySynth<Tone.Synth> | null = null
let harmonic: Tone.PolySynth<Tone.Synth> | null = null
let eventIds: number[] = []
let endTimer: ReturnType<typeof setTimeout> | null = null
let progressTimer: ReturnType<typeof setInterval> | null = null
let startedAt = 0
let totalDuration = 0
let playing = false
const stopListeners = new Set<() => void>()

/** Piano construido con Tone.js: dos capas suaves, filtro cálido y reverberación breve. */
function getPiano() {
  if (piano) return

  const reverb = new Tone.Reverb({ decay: 1.1, wet: 0.12 })
  const compressor = new Tone.Compressor(-20, 3).connect(reverb)
  const filter = new Tone.Filter(2400, 'lowpass').connect(compressor)
  filter.toDestination()

  piano = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.006, decay: 0.6, sustain: 0.18, release: 1.1 },
  }).connect(filter)
  piano.volume.value = -7

  harmonic = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.008, decay: 0.3, sustain: 0.04, release: 0.5 },
  }).connect(filter)
  harmonic.volume.value = -21
}

function durationOf(element: Element): number {
  const node = element.getElementsByTagName('duration')[0]
  return node ? Number(node.textContent) || 0 : 0
}

export function parseMelody(musicxml: string): MelodyEvent[] {
  if (!musicxml) return []

  const doc = new DOMParser().parseFromString(musicxml, 'application/xml')
  const part = doc.getElementsByTagName('part')[0]
  if (!part) return []

  let divisions = 1
  let tempo = 120
  let secondsPerDivision = 0.5
  let time = 0
  const events: MelodyEvent[] = []

  const updateTiming = () => {
    secondsPerDivision = 60 / tempo / divisions
  }

  for (const measure of Array.from(part.getElementsByTagName('measure'))) {
    for (const node of Array.from(measure.children)) {
      switch (node.tagName) {
        case 'attributes': {
          const div = node.getElementsByTagName('divisions')[0]
          if (div) divisions = Number(div.textContent) || 1
          updateTiming()
          break
        }
        case 'direction':
        case 'sound': {
          const sound = node.tagName === 'sound'
            ? node
            : Array.from(node.getElementsByTagName('sound')).find((s) => s.hasAttribute('tempo'))
          if (sound?.hasAttribute('tempo')) {
            tempo = Number(sound.getAttribute('tempo')) || 120
            updateTiming()
          }
          break
        }
        case 'backup': {
          time = Math.max(0, time - durationOf(node) * secondsPerDivision)
          break
        }
        case 'forward': {
          time += durationOf(node) * secondsPerDivision
          break
        }
        case 'note': {
          const duration = durationOf(node) * secondsPerDivision
          const isRest = node.getElementsByTagName('rest').length > 0
          const isChord = node.getElementsByTagName('chord').length > 0
          const pitch = node.getElementsByTagName('pitch')[0]

          if (!isRest && pitch && duration > 0) {
            const step = pitch.getElementsByTagName('step')[0]?.textContent || 'C'
            const octave = Number(pitch.getElementsByTagName('octave')[0]?.textContent || 4)
            const alter = Number(pitch.getElementsByTagName('alter')[0]?.textContent || 0)
            const midi = 60 + (octave - 4) * 12 + (STEP_SEMITONES[step] ?? 0) + alter
            events.push({
              time: isChord ? Math.max(0, time - duration) : time,
              frequency: Tone.Frequency(midi, 'midi').toFrequency(),
              duration,
            })
          }

          if (!isChord) time += duration
          break
        }
      }
    }
  }

  return events
}

export function isMidiPlaying() {
  return playing
}

export function onMidiStop(listener: () => void) {
  stopListeners.add(listener)
  return () => {
    stopListeners.delete(listener)
  }
}

function clearTimers() {
  eventIds.forEach((id) => Tone.Transport.clear(id))
  eventIds = []
  if (endTimer !== null) {
    clearTimeout(endTimer)
    endTimer = null
  }
  if (progressTimer !== null) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

export function stopMidi() {
  clearTimers()
  Tone.Transport.stop()
  Tone.Transport.seconds = 0
  playing = false
  totalDuration = 0
  stopListeners.forEach((listener) => listener())
}

export async function playMidi(events: MelodyEvent[], callbacks: MidiCallbacks = {}) {
  stopMidi()
  if (events.length === 0) return

  // Empieza en la primera nota real; los silencios internos se conservan.
  const firstNote = Math.min(...events.map((event) => event.time))
  const shifted = events.map((event) => ({
    ...event,
    time: Math.max(0, event.time - firstNote),
  }))
  totalDuration = Math.max(...shifted.map((e) => e.time + e.duration), 0)

  await Tone.start()
  getPiano()

  eventIds = shifted.map((event) =>
    Tone.Transport.schedule((time) => {
      piano?.triggerAttackRelease(event.frequency, event.duration, time)
      harmonic?.triggerAttackRelease(event.frequency * 2, Math.min(event.duration, 0.4), time)
    }, event.time)
  )

  Tone.Transport.seconds = 0
  Tone.Transport.start()
  playing = true
  startedAt = Date.now()

  progressTimer = setInterval(() => {
    callbacks.onProgress?.(
      Math.min(totalDuration, (Date.now() - startedAt) / 1000),
      totalDuration
    )
  }, 200)

  endTimer = setTimeout(() => {
    stopMidi()
    callbacks.onEnd?.()
  }, totalDuration * 1000 + 250)
}
