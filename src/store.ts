import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { deleteAudio } from './lib/audioStorage'

export interface ScoreMeta {
  id: string
  title: string
  tags: string[]
  repertoire: string
  abc: string
  /** true si hay audio guardado en IndexedDB para este id */
  hasAudio?: boolean
  originalKey?: string
}

export interface Playlist {
  id: string
  name: string
  scoreIds: string[]
  createdAt: number
}

interface AppState {
  scores: ScoreMeta[]
  playlists: Playlist[]
  currentScoreId: string | null
  currentPlaylistId: string | null
  transposeSemitones: number
  searchQuery: string
  selectedRepertoire: string | null
  selectedTag: string | null

  setScores: (scores: ScoreMeta[]) => void
  addScore: (score: ScoreMeta) => void
  updateScore: (id: string, patch: Partial<ScoreMeta>) => void
  removeScore: (id: string) => void
  setCurrentScore: (id: string | null) => void

  setTranspose: (semitones: number) => void
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
      transposeSemitones: 0,
      searchQuery: '',
      selectedRepertoire: null,
      selectedTag: null,

      setScores: (scores) => set({ scores }),
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
      setCurrentScore: (id) => set({ currentScoreId: id, transposeSemitones: 0 }),

      setTranspose: (semitones) => set({ transposeSemitones: semitones }),
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
      }),
    }
  )
)
