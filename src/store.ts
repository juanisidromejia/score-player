import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { deleteAudio } from './lib/audioStorage'
import { sampleScores } from './data/sampleScores'

export interface ScoreMeta {
  id: string
  title: string
  tags: string[]
  repertoire: string
  musicxml: string
  /** true si hay audio guardado en IndexedDB para este id */
  hasAudio?: boolean
  originalKey?: string
  /** partitura guardada con la versión antigua de ABC, sin convertir */
  legacyAbc?: string
}

export interface Playlist {
  id: string
  name: string
  scoreIds: string[]
  createdAt: number
}

export interface PreviewNavigation {
  origin: 'library' | 'set'
  playlistId: string | null
}

interface AppState {
  scores: ScoreMeta[]
  playlists: Playlist[]
  currentScoreId: string | null
  currentPlaylistId: string | null
  previewNavigation: PreviewNavigation
  transposeSemitones: number
  respectXmlSystemBreaks: boolean
  searchQuery: string
  selectedRepertoire: string | null
  selectedTag: string | null
  initialized: boolean

  setScores: (scores: ScoreMeta[]) => void
  setInitialized: () => void
  addScore: (score: ScoreMeta) => void
  updateScore: (id: string, patch: Partial<ScoreMeta>) => void
  removeScore: (id: string) => void
  setCurrentScore: (
    id: string | null,
    options?: { keepTranspose?: boolean }
  ) => void
  openScore: (id: string, navigation: PreviewNavigation) => void

  setTranspose: (semitones: number) => void
  setRespectXmlSystemBreaks: (value: boolean) => void
  setSearchQuery: (q: string) => void
  setSelectedRepertoire: (r: string | null) => void
  setSelectedTag: (t: string | null) => void
  addTagToScore: (scoreId: string, tag: string) => void
  removeTagFromScore: (scoreId: string, tag: string) => void

  createPlaylist: (name: string) => string
  renamePlaylist: (id: string, name: string) => void
  deletePlaylist: (id: string) => void
  addScoreToPlaylist: (playlistId: string, scoreId: string) => void
  removeScoreFromPlaylist: (playlistId: string, scoreId: string) => void
  setCurrentPlaylist: (id: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      scores: [],
      playlists: [],
      currentScoreId: null,
      currentPlaylistId: null,
      previewNavigation: { origin: 'library', playlistId: null },
      transposeSemitones: 0,
      respectXmlSystemBreaks: false,
      searchQuery: '',
      selectedRepertoire: null,
      selectedTag: null,
      initialized: false,

      setScores: (scores) => set({ scores }),
      setInitialized: () => set({ initialized: true }),
      addScore: (score) => set((s) => ({ scores: [...s.scores, score] })),
      updateScore: (id, patch) =>
        set((s) => ({
          scores: s.scores.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)),
        })),
      removeScore: (id) => {
        // borrar audio asociado
        deleteAudio(id).catch(() => {})
        set((s) => ({
          scores: s.scores.filter((sc) => sc.id !== id),
          currentScoreId: s.currentScoreId === id ? null : s.currentScoreId,
          playlists: s.playlists.map((p) => ({
            ...p,
            scoreIds: p.scoreIds.filter((sid) => sid !== id),
          })),
        }))
      },
      setCurrentScore: (id, options) =>
        set((s) => ({
          currentScoreId: id,
          transposeSemitones: options?.keepTranspose ? s.transposeSemitones : 0,
        })),
      openScore: (id, navigation) =>
        set({
          currentScoreId: id,
          transposeSemitones: 0,
          previewNavigation: navigation,
        }),

      setTranspose: (semitones) => set({ transposeSemitones: semitones }),
      setRespectXmlSystemBreaks: (value) => set({ respectXmlSystemBreaks: value }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setSelectedRepertoire: (r) => set({ selectedRepertoire: r, selectedTag: null }),
      setSelectedTag: (t) => set({ selectedTag: t, selectedRepertoire: null }),

      addTagToScore: (scoreId, tag) => {
        const clean = tag.trim().toLowerCase()
        if (!clean) return
        set((s) => ({
          scores: s.scores.map((sc) =>
            sc.id === scoreId && !sc.tags.includes(clean)
              ? { ...sc, tags: [...sc.tags, clean] }
              : sc
          ),
        }))
      },
      removeTagFromScore: (scoreId, tag) =>
        set((s) => ({
          scores: s.scores.map((sc) =>
            sc.id === scoreId
              ? { ...sc, tags: sc.tags.filter((t) => t !== tag) }
              : sc
          ),
        })),

      createPlaylist: (name) => {
        const id = `pl-${Date.now()}`
        set((s) => ({
          playlists: [
            ...s.playlists,
            { id, name: name.trim() || 'Nuevo set', scoreIds: [], createdAt: Date.now() },
          ],
        }))
        return id
      },
      renamePlaylist: (id, name) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name } : p
          ),
        })),
      deletePlaylist: (id) =>
        set((s) => ({
          playlists: s.playlists.filter((p) => p.id !== id),
          currentPlaylistId: s.currentPlaylistId === id ? null : s.currentPlaylistId,
        })),
      addScoreToPlaylist: (playlistId, scoreId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId && !p.scoreIds.includes(scoreId)
              ? { ...p, scoreIds: [...p.scoreIds, scoreId] }
              : p
          ),
        })),
      removeScoreFromPlaylist: (playlistId, scoreId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, scoreIds: p.scoreIds.filter((sid) => sid !== scoreId) }
              : p
          ),
        })),
      setCurrentPlaylist: (id) => set({ currentPlaylistId: id }),
    }),
    {
      name: 'score-player-storage',
      partialize: (s) => ({
        scores: s.scores,
        playlists: s.playlists,
        currentScoreId: s.currentScoreId,
        respectXmlSystemBreaks: s.respectXmlSystemBreaks,
        initialized: s.initialized,
      }),
      merge: (persisted, current) => {
        const state = (persisted ?? {}) as Partial<AppState>
        const scores = (state.scores ?? current.scores).map((score) => {
          const legacy = score as ScoreMeta & { abc?: string }
          if (legacy.musicxml) return legacy

          const sample = sampleScores.find((s) => s.id === legacy.id)
          if (sample) return { ...legacy, musicxml: sample.musicxml }

          return { ...legacy, musicxml: '', legacyAbc: legacy.abc }
        })

        return { ...current, ...state, scores }
      },
    }
  )
)
