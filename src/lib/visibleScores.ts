import { useMemo } from 'react'
import type {
  LibrarySetFilter,
  Playlist,
  PreviewNavigation,
  ScoreMeta,
} from '../store'
import { useAppStore } from '../store'

/** Quita acentos y pasa a minúsculas para buscar mejor */
export function normalize(text: string) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

interface LibraryFilters {
  searchQuery: string
  selectedRepertoire: string | null
  selectedTag: string | null
}

interface VisibleScoresParams extends LibraryFilters {
  scores: ScoreMeta[]
  playlists: Playlist[]
  librarySetFilter: LibrarySetFilter
}

interface PresentationScoresParams extends LibraryFilters {
  scores: ScoreMeta[]
  playlists: Playlist[]
  previewNavigation: PreviewNavigation
}

/** Biblioteca general: todas las partituras que cumplen sus propios filtros. */
export function getVisibleScores({
  scores,
  playlists,
  librarySetFilter,
  searchQuery,
  selectedRepertoire,
  selectedTag,
}: VisibleScoresParams): ScoreMeta[] {
  const q = normalize(searchQuery)
  const usedIds =
    librarySetFilter.kind === 'no-set'
      ? new Set(playlists.flatMap((p) => p.scoreIds))
      : null
  const filterIds =
    librarySetFilter.kind === 'set'
      ? new Set(
          playlists.find((p) => p.id === librarySetFilter.id)?.scoreIds ?? []
        )
      : null

  return scores.filter((s) => {
    const matchSearch =
      !q ||
      normalize(s.title).includes(q) ||
      normalize(s.repertoire).includes(q) ||
      s.tags.some((t) => normalize(t).includes(q))

    const matchRepertoire =
      !selectedRepertoire || s.repertoire === selectedRepertoire

    const matchTag = !selectedTag || s.tags.includes(selectedTag)

    const matchSet = usedIds
      ? !usedIds.has(s.id)
      : filterIds
        ? filterIds.has(s.id)
        : true

    return matchSearch && matchRepertoire && matchTag && matchSet
  })
}

/** Partituras de un set en su orden guardado, resolviendo las referencias. */
export function getPlaylistScores(
  scores: ScoreMeta[],
  playlists: Playlist[],
  playlistId: string | null
): ScoreMeta[] {
  if (!playlistId) return []
  const playlist = playlists.find((p) => p.id === playlistId)
  if (!playlist) return []
  return playlist.scoreIds
    .map((id) => scores.find((s) => s.id === id))
    .filter((s): s is ScoreMeta => Boolean(s))
}

/** Lista para el modo presentación según el origen desde el que se abrió la partitura. */
export function getPresentationScores({
  scores,
  playlists,
  previewNavigation,
  searchQuery,
  selectedRepertoire,
  selectedTag,
}: PresentationScoresParams): ScoreMeta[] {
  if (previewNavigation.origin === 'set' && previewNavigation.playlistId) {
    const playlist = playlists.find((p) => p.id === previewNavigation.playlistId)
    if (playlist && playlist.scoreIds.length > 0) {
      return getPlaylistScores(scores, playlists, playlist.id)
    }
  }

  return getVisibleScores({
    scores,
    playlists,
    librarySetFilter: { kind: 'all' },
    searchQuery,
    selectedRepertoire,
    selectedTag,
  })
}

/** Lista que recorre el preview según el origen desde el que se abrió la partitura. */
export function getPreviewNavigationScores({
  scores,
  playlists,
  previewNavigation,
}: {
  scores: ScoreMeta[]
  playlists: Playlist[]
  previewNavigation: PreviewNavigation
}): ScoreMeta[] {
  if (previewNavigation.origin === 'set' && previewNavigation.playlistId) {
    const playlist = playlists.find((p) => p.id === previewNavigation.playlistId)
    if (!playlist) return []
    return getPlaylistScores(scores, playlists, playlist.id)
  }

  return scores
}

export function useVisibleScores(): ScoreMeta[] {
  const scores = useAppStore((s) => s.scores)
  const playlists = useAppStore((s) => s.playlists)
  const librarySetFilter = useAppStore((s) => s.librarySetFilter)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const selectedRepertoire = useAppStore((s) => s.selectedRepertoire)
  const selectedTag = useAppStore((s) => s.selectedTag)

  return useMemo(
    () =>
      getVisibleScores({
        scores,
        playlists,
        librarySetFilter,
        searchQuery,
        selectedRepertoire,
        selectedTag,
      }),
    [
      scores,
      playlists,
      librarySetFilter,
      searchQuery,
      selectedRepertoire,
      selectedTag,
    ]
  )
}
