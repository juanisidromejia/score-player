import { useMemo } from 'react'
import type { Playlist, ScoreMeta } from '../store'
import { useAppStore } from '../store'

/** Quita acentos y pasa a minúsculas para buscar mejor */
export function normalize(text: string) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

interface VisibleScoresParams {
  scores: ScoreMeta[]
  playlists: Playlist[]
  currentPlaylistId: string | null
  searchQuery: string
  selectedRepertoire: string | null
  selectedTag: string | null
}

/** Lista que ve el usuario en la barra lateral. */
export function getVisibleScores({
  scores,
  playlists,
  currentPlaylistId,
  searchQuery,
  selectedRepertoire,
  selectedTag,
}: VisibleScoresParams): ScoreMeta[] {
  let list = scores

  if (currentPlaylistId) {
    const playlist = playlists.find((p) => p.id === currentPlaylistId)
    if (playlist) {
      list = list.filter((s) => playlist.scoreIds.includes(s.id))
    }
  }

  const q = normalize(searchQuery)

  return list.filter((s) => {
    const matchSearch =
      !q ||
      normalize(s.title).includes(q) ||
      normalize(s.repertoire).includes(q) ||
      s.tags.some((t) => normalize(t).includes(q))

    const matchRepertoire =
      !selectedRepertoire || s.repertoire === selectedRepertoire

    const matchTag = !selectedTag || s.tags.includes(selectedTag)

    return matchSearch && matchRepertoire && matchTag
  })
}

/** Lista para el modo presentación. Un set siempre se reproduce completo y en su orden. */
export function getPresentationScores({
  scores,
  playlists,
  currentPlaylistId,
  searchQuery,
  selectedRepertoire,
  selectedTag,
}: VisibleScoresParams): ScoreMeta[] {
  if (currentPlaylistId) {
    const playlist = playlists.find((p) => p.id === currentPlaylistId)
    if (playlist && playlist.scoreIds.length > 0) {
      return playlist.scoreIds
        .map((id) => scores.find((s) => s.id === id))
        .filter((s): s is ScoreMeta => Boolean(s))
    }
  }

  return getVisibleScores({
    scores,
    playlists,
    currentPlaylistId,
    searchQuery,
    selectedRepertoire,
    selectedTag,
  })
}

export function useVisibleScores(): ScoreMeta[] {
  const scores = useAppStore((s) => s.scores)
  const playlists = useAppStore((s) => s.playlists)
  const currentPlaylistId = useAppStore((s) => s.currentPlaylistId)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const selectedRepertoire = useAppStore((s) => s.selectedRepertoire)
  const selectedTag = useAppStore((s) => s.selectedTag)

  return useMemo(
    () =>
      getVisibleScores({
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
}
