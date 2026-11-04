/**
 * Formato .scorepack — JSON con partitura + audio opcional en base64.
 * Permite exportar/importar el "combo" partitura + backing track.
 */

import type { ScoreMeta } from '../store'
import { blobToBase64, base64ToBlob, saveAudio, loadAudio } from './audioStorage'

export interface ScorePack {
  version: 1
  type: 'score-player-pack'
  exportedAt: string
  score: {
    id: string
    title: string
    tags: string[]
    repertoire: string
    abc: string
    originalKey?: string
  }
  audio?: {
    mime: string
    data: string // base64
    filename?: string
  }
}

export async function buildScorePack(score: ScoreMeta): Promise<ScorePack> {
  const pack: ScorePack = {
    version: 1,
    type: 'score-player-pack',
    exportedAt: new Date().toISOString(),
    score: {
      id: score.id,
      title: score.title,
      tags: score.tags,
      repertoire: score.repertoire,
      abc: score.abc,
      originalKey: score.originalKey,
    },
  }

  const blob = await loadAudio(score.id)
  if (blob) {
    pack.audio = {
      mime: blob.type || 'audio/mpeg',
      data: await blobToBase64(blob),
      filename: `${slugify(score.title)}.mp3`,
    }
  }

  return pack
}

export async function importScorePack(
  pack: ScorePack,
  options?: { newId?: boolean }
): Promise<ScoreMeta> {
  if (pack.type !== 'score-player-pack' || pack.version !== 1) {
    throw new Error('Archivo .scorepack no válido')
  }

  const id = options?.newId ? `score-${Date.now()}` : pack.score.id

  const score: ScoreMeta = {
    id,
    title: pack.score.title,
    tags: pack.score.tags ?? [],
    repertoire: pack.score.repertoire || 'general',
    abc: pack.score.abc,
    originalKey: pack.score.originalKey,
    hasAudio: !!pack.audio,
  }

  if (pack.audio?.data) {
    const blob = base64ToBlob(pack.audio.data, pack.audio.mime || 'audio/mpeg')
    await saveAudio(id, blob)
  }

  return score
}

export function downloadScorePack(pack: ScorePack, filename?: string) {
  const json = JSON.stringify(pack)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${slugify(pack.score.title)}.scorepack`
  a.click()
  URL.revokeObjectURL(url)
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'partitura'
}
