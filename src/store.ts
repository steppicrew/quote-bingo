import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  type Card,
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
import { mergeQuotes, type MergeResult } from './lib/share'

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

interface State {
  persons: Person[]
  quotes: Quote[]
  cards: Record<Id, Card>
  activePersonId: Id | null
  theme: Theme
  hydrated: boolean
}

interface Actions {
  addPerson: (name: string) => Id
  renamePerson: (id: Id, name: string) => void
  deletePerson: (id: Id) => void
  setActivePerson: (id: Id | null) => void

  addQuote: (personId: Id, text: string) => void
  addQuotes: (personId: Id, texts: string[]) => void
  editQuote: (id: Id, text: string) => void
  deleteQuote: (id: Id) => void

  /** (Re)generate a card, optionally at a specific size (keeps current size if omitted). */
  regenerateCard: (personId: Id, size?: number) => void
  ensureCard: (personId: Id) => void
  toggleCell: (personId: Id, index: number) => void

  /** Merge an imported list into a person (matched by name, else created). */
  importList: (name: string, quotes: string[]) => { personId: Id } & MergeResult

  setTheme: (theme: Theme) => void
}

const quotesFor = (quotes: Quote[], personId: Id): string[] =>
  quotes.filter((q) => q.personId === personId).map((q) => q.text)

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      persons: [],
      quotes: [],
      cards: {},
      activePersonId: null,
      theme: 'system',
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
          quotes: s.quotes.map((q) => (q.id === id ? { ...q, text: text.trim() } : q)),
        })),

      deleteQuote: (id) =>
        set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) })),

      regenerateCard: (personId, size) =>
        set((s) => {
          const ids = s.quotes.filter((q) => q.personId === personId).map((q) => q.id)
          const target = size ?? s.cards[personId]?.size ?? bestSize(ids.length)
          const card = generateCard(personId, ids, target)
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
          const center = centerIndex(card.size)
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
        const existing = quotesFor(get().quotes, personId)
        const merged = mergeQuotes(existing, quotes)
        // Replace this person's quotes with the merged (deduped) set.
        const now = Date.now()
        const others = get().quotes.filter((q) => q.personId !== personId)
        const rebuilt: Quote[] = merged.quotes.map((text, i) => ({
          id: uid(),
          personId,
          text,
          createdAt: now + i,
        }))
        set({ quotes: [...others, ...rebuilt] })
        return { personId, ...merged }
      },

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'quote-bingo-state',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        persons: s.persons,
        quotes: s.quotes,
        cards: s.cards,
        activePersonId: s.activePersonId,
        theme: s.theme,
      }),
      // v0 cards had a fixed 5x5 shape without `size`; drop them so they
      // regenerate lazily with the new size-aware format.
      migrate: (persisted, version) => {
        const p = persisted as Partial<State> | undefined
        if (p && version < 1 && p.cards) {
          const cards: Record<Id, Card> = {}
          for (const [pid, card] of Object.entries(p.cards)) {
            if (typeof card.size === 'number') cards[pid] = card
          }
          p.cards = cards
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
