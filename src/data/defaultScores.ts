import { saveAudio } from '../lib/audioStorage'
import type { ScoreMeta } from '../store'
import { defaultSampleScores } from './sampleScores'

interface DefaultPack {
  id: string
  title: string
  tags: string[]
  repertoire: string
  originalKey: string
  musicxml: string
  audio: string
}

function assetUrl(name: string) {
  return `${import.meta.env.BASE_URL}defaults/${name}`
}

export async function loadDefaultScores(): Promise<ScoreMeta[]> {
  const manifestResponse = await fetch(assetUrl('manifest.json'))
  if (!manifestResponse.ok) {
    throw new Error('No se pudo cargar el manifiesto de partituras')
  }
  const manifest = (await manifestResponse.json()) as { scores: DefaultPack[] }

  const packs = await Promise.all(
    manifest.scores.map(async (pack) => {
      const [xmlResponse, audioResponse] = await Promise.all([
        fetch(assetUrl(pack.musicxml)),
        fetch(assetUrl(pack.audio)),
      ])
      if (!xmlResponse.ok || !audioResponse.ok) {
        throw new Error(`No se pudieron cargar los recursos de ${pack.title}`)
      }

      const [musicxml, audio] = await Promise.all([
        xmlResponse.text(),
        audioResponse.blob(),
      ])
      await saveAudio(pack.id, audio)

      return {
        id: pack.id,
        title: pack.title,
        tags: pack.tags,
        repertoire: pack.repertoire,
        originalKey: pack.originalKey,
        hasAudio: true,
        musicxml,
      } satisfies ScoreMeta
    })
  )

  return [...packs, ...defaultSampleScores]
}
