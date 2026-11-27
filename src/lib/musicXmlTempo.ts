/**
 * Extrae el tempo efectivo de cada compás del primer pentagrama/parte.
 * MusicXML expresa el tempo como negra por minuto normalizada aquí,
 * independientemente de la unidad indicada en <beat-unit>.
 */
export function getMusicXmlMeasureTempos(
  musicxml: string,
  fallbackBpm = 120
): number[] {
  const fallback = Number.isFinite(fallbackBpm)
    ? Math.max(20, Math.min(300, fallbackBpm))
    : 120
  if (!musicxml) return []

  const doc = new DOMParser().parseFromString(musicxml, 'application/xml')
  if (doc.querySelector('parsererror')) return []
  const part = doc.getElementsByTagName('part')[0]
  if (!part) return []

  const beatUnits: Record<string, number> = {
    maxima: 32,
    long: 16,
    breve: 8,
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    '16th': 0.25,
    '32nd': 0.125,
    '64th': 0.0625,
    '128th': 0.03125,
    '256th': 0.015625,
  }

  let bpm = fallback
  const result: number[] = []

  for (const measure of Array.from(part.children).filter(
    (node) => node.tagName === 'measure'
  )) {
    for (const direction of Array.from(measure.children).filter(
      (node) => node.tagName === 'direction' || node.tagName === 'sound'
    )) {
      const soundNodes = direction.tagName === 'sound'
        ? [direction]
        : Array.from(direction.getElementsByTagName('sound'))
      const soundTempo = soundNodes
        .map((node) => Number(node.getAttribute('tempo')))
        .find((value) => Number.isFinite(value) && value > 0)

      if (soundTempo) {
        bpm = soundTempo
        continue
      }

      const metronomes = direction.getElementsByTagName('metronome')
      const metronome = metronomes[0]
      if (!metronome) continue

      const beatUnit = metronome.getElementsByTagName('beat-unit')[0]?.textContent?.trim()
      const perMinute = Number(
        metronome.getElementsByTagName('per-minute')[0]?.textContent
      )
      const quarterValue = beatUnits[beatUnit || '']
      if (!quarterValue || !Number.isFinite(perMinute) || perMinute <= 0) continue

      const dots = metronome.getElementsByTagName('beat-unit-dot').length
      const dotMultiplier = dots === 0 ? 1 : 2 - Math.pow(0.5, dots)
      bpm = perMinute * quarterValue * dotMultiplier
    }
    result.push(Math.max(20, Math.min(300, bpm)))
  }

  return result
}
