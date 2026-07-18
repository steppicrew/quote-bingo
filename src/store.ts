import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  type AccentName,
  type Card,
  type ExportQuote,
  type Id,
  type Person,
  type Quote,
  DEFAULT_SIZE,
  SIZES,
  quotesNeeded,
  centerIndex,
} from './types'
import { idbStorage } from './lib/db'
import { generateCard } from './lib/card'
import { mergeQuotes } from './lib/share'
import { type SoundKind, type SoundMode } from './lib/fanfare'

/** Largest offered size whose quota fits the pool, preferring DEFAULT_SIZE. */
function bestSize(poolCount: number): number {
  if (poolCount >= quotesNeeded(DEFAULT_SIZE)) return DEFAULT_SIZE
  const fits = SIZES.filter((s) => poolCount >= quotesNeeded(s))
  return fits.length ? Math.max(...fits) : SIZES[0]!
}

const uid = (): Id =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export type Theme = 'dark' | 'light' | 'system'
export type Locale = 'de' | 'en' | 'fr' | 'es' | 'zh' | 'ja' | 'ko' | 'pt' | 'it' | 'system'

interface State {
  persons: Person[]
  quotes: Quote[]
  cards: Record<Id, Card>
  activePersonId: Id | null
  theme: Theme
  locale: Locale
  soundMode: SoundMode
  soundKind: SoundKind
  hydrated: boolean
}

interface Actions {
  addPerson: (name: string) => Id
  renamePerson: (id: Id, name: string) => void
  setAccent: (id: Id, accent: AccentName) => void
  deletePerson: (id: Id) => void
  setActivePerson: (id: Id | null) => void

  addQuote: (personId: Id, text: string) => void
  addQuotes: (personId: Id, texts: string[]) => void
  editQuote: (id: Id, text: string) => void
  deleteQuote: (id: Id) => void

  /**
   * (Re)generate a card. Omitted `size`/`joker` keep the current card's values
   * (defaulting to bestSize / free-centre-on for a brand-new card).
   */
  regenerateCard: (personId: Id, size?: number, joker?: boolean) => void
  ensureCard: (personId: Id) => void
  toggleCell: (personId: Id, index: number) => void

  /** Merge an imported list into a person (matched by name, else created). */
  importList: (
    name: string,
    quotes: readonly ExportQuote[],
  ) => { personId: Id; added: number; updated: number; skipped: number }

  setTheme: (theme: Theme) => void
  setLocale: (locale: Locale) => void
  setSoundMode: (soundMode: SoundMode) => void
  setSoundKind: (soundKind: SoundKind) => void
  /** Cycle the nav-bar sound toggle: on → vibrate → off → on. */
  cycleSoundMode: () => void
}


export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      persons: [],
      quotes: [],
      cards: {},
      activePersonId: null,
      theme: 'system',
      locale: 'system',
      soundMode: 'on',
      soundKind: 'tadaa',
      hydrated: false,

      addPerson: (name) => {
        const id = uid()
        set((s) => ({
          persons: [...s.persons, { id, name: name.trim(), createdAt: Date.now() }],
        }))
        return id
      },

      renamePerson: (id, name) =>
        set((s) => ({
          persons: s.persons.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)),
        })),

      setAccent: (id, accent) =>
        set((s) => ({
          persons: s.persons.map((p) => (p.id === id ? { ...p, accent } : p)),
        })),

      deletePerson: (id) =>
        set((s) => {
          const cards = { ...s.cards }
          delete cards[id]
          return {
            persons: s.persons.filter((p) => p.id !== id),
            quotes: s.quotes.filter((q) => q.personId !== id),
            cards,
            activePersonId: s.activePersonId === id ? null : s.activePersonId,
          }
        }),

      setActivePerson: (id) => set({ activePersonId: id }),

      addQuote: (personId, text) => get().addQuotes(personId, [text]),

      addQuotes: (personId, texts) =>
        set((s) => {
          const now = Date.now()
          const fresh: Quote[] = texts
            .map((t) => t.trim())
            .filter(Boolean)
            .map((text, i) => ({ id: uid(), personId, text, createdAt: now + i }))
          return { quotes: [...s.quotes, ...fresh] }
        }),

      editQuote: (id, text) =>
        set((s) => ({
          quotes: s.quotes.map((q) => (q.id === id ? { ...q, text } : q)),
        })),

      deleteQuote: (id) =>
        set((s) => {
          const doomed = s.quotes.find((q) => q.id === id)
          const quotes = s.quotes.filter((q) => q.id !== id)
          if (!doomed) return { quotes }

          // Replace only the deleted quote's cell(s) on this person's card with
          // an unused quote, so every other (possibly checked) cell is kept as
          // is. Falls back to leaving the cell if the pool has no spare.
          const card = s.cards[doomed.personId]
          if (!card || !card.cells.includes(id)) return { quotes }

          const used = new Set(card.cells)
          const spares = quotes
            .filter((q) => q.personId === doomed.personId && !used.has(q.id))
            .map((q) => q.id)
          let si = 0
          const cells = card.cells.slice()
          const checked = card.checked.slice()
          for (let i = 0; i < cells.length; i++) {
            if (cells[i] === id && si < spares.length) {
              cells[i] = spares[si++]!
              checked[i] = false // fresh quote, not yet "said"
            }
          }
          return {
            quotes,
            cards: { ...s.cards, [doomed.personId]: { ...card, cells, checked } },
          }
        }),

      regenerateCard: (personId, size, joker) =>
        set((s) => {
          const ids = s.quotes.filter((q) => q.personId === personId).map((q) => q.id)
          const prev = s.cards[personId]
          const target = size ?? prev?.size ?? bestSize(ids.length)
          const useJoker = joker ?? prev?.joker ?? true
          const card = generateCard(personId, ids, target, useJoker)
          return { cards: { ...s.cards, [personId]: card } }
        }),

      ensureCard: (personId) => {
        const s = get()
        if (s.cards[personId]) return
        const ids = s.quotes.filter((q) => q.personId === personId).map((q) => q.id)
        set({ cards: { ...s.cards, [personId]: generateCard(personId, ids, bestSize(ids.length)) } })
      },

      toggleCell: (personId, index) =>
        set((s) => {
          const card = s.cards[personId]
          if (!card) return {}
          const center = centerIndex(card.size, card.joker)
          if (index === center) return {}
          const checked = card.checked.slice()
          checked[index] = !checked[index]
          return { cards: { ...s.cards, [personId]: { ...card, checked } } }
        }),

      importList: (name, quotes) => {
        const s = get()
        const target = s.persons.find(
          (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
        )
        const personId = target ? target.id : s.addPerson(name)
        const existing = get().quotes.filter((q) => q.personId === personId)
        const merged = mergeQuotes(existing, quotes)

        // Apply the reconciliation: keep existing quote objects' ids (so card
        // cells stay valid), update the text of any that changed, and append
        // the genuinely new ones. Matching by id-then-text happens in mergeQuotes.
        const existingById = new Map(existing.map((q) => [q.id, q]))
        const now = Date.now()
        const mine: Quote[] = merged.quotes.map((mq, i) => {
          const prev = existingById.get(mq.id)
          if (prev) return prev.text === mq.text ? prev : { ...prev, text: mq.text }
          return { id: mq.id, personId, text: mq.text, createdAt: now + i }
        })
        const others = get().quotes.filter((q) => q.personId !== personId)
        set({ quotes: [...others, ...mine] })
        return {
          personId,
          added: merged.added,
          updated: merged.updated,
          skipped: merged.skipped,
        }
      },

      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setSoundMode: (soundMode) => set({ soundMode }),
      setSoundKind: (soundKind) => set({ soundKind }),
      cycleSoundMode: () =>
        set((s) => {
          const next: Record<SoundMode, SoundMode> = {
            on: 'vibrate',
            vibrate: 'off',
            off: 'on',
          }
          return { soundMode: next[s.soundMode] }
        }),
    }),
    {
      name: 'quote-bingo-state',
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        persons: s.persons,
        quotes: s.quotes,
        cards: s.cards,
        activePersonId: s.activePersonId,
        theme: s.theme,
        locale: s.locale,
        soundMode: s.soundMode,
        soundKind: s.soundKind,
      }),
      migrate: (persisted, version) => {
        const p = persisted as Partial<State> | undefined
        // v0 cards had a fixed 5x5 shape without `size`; drop them so they
        // regenerate lazily with the new size-aware format.
        if (p && version < 1 && p.cards) {
          const cards: Record<Id, Card> = {}
          for (const [pid, card] of Object.entries(p.cards)) {
            if (typeof card.size === 'number') cards[pid] = card
          }
          p.cards = cards
        }
        // v1 cards predate the per-card `joker` flag; they were generated with
        // a free centre on odd sizes, so default joker on to preserve them.
        if (p && version < 2 && p.cards) {
          for (const card of Object.values(p.cards)) {
            if (typeof card.joker !== 'boolean') card.joker = true
          }
        }
        return persisted
      },
      onRehydrateStorage: () => () => {
        // Runs after the persisted slice has been merged in (or on error).
        // Use the store setter so React reliably re-renders past the loader.
        useStore.setState({ hydrated: true })
      },
    },
  ),
)
