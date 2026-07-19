export type Id = string

/** Named accent presets a person's board can use (else the default theme). */
export type AccentName = 'default' | 'indigo' | 'rose' | 'emerald' | 'amber' | 'sky' | 'violet'

export interface Person {
  id: Id
  name: string
  /** Optional per-person accent; absent/`'default'` uses the app theme. */
  accent?: AccentName
  createdAt: number
}

export interface Quote {
  id: Id
  personId: Id
  text: string
  createdAt: number
}

/** A generated, persistent NxN card for one person. */
export interface Card {
  personId: Id
  /** Grid dimension N (3..7). */
  size: number
  /** Free centre space enabled. Only takes effect on odd sizes. */
  joker: boolean
  /** length size*size; null = free center (odd size + joker only) */
  cells: (Id | null)[]
  /** length size*size; free center pre-checked true */
  checked: boolean[]
  createdAt: number
}

/** One quote as it travels in a share payload: a stable id plus its text. */
export interface ExportQuote {
  id: Id
  text: string
}

/**
 * Shareable unit = one person + their quotes. v2 carries per-quote ids so
 * edits propagate on re-import; v1 (text-only) payloads are still accepted and
 * normalised to `ExportQuote[]` with fresh ids on import.
 */
export interface QuoteListExport {
  version: 2
  person: { name: string }
  quotes: ExportQuote[]
}

export type Theme = 'dark' | 'light' | 'system'
export type Locale = 'de' | 'en' | 'fr' | 'es' | 'zh' | 'ja' | 'ko' | 'pt' | 'it' | 'system'
export type SoundMode = 'on' | 'vibrate' | 'off'
export type SoundKind = 'tadaa' | 'arpeggio'

/** The full persisted app state carried by an "export all data" backup. */
export interface BackupData {
  persons: Person[]
  quotes: Quote[]
  cards: Record<Id, Card>
  activePersonId: Id | null
  theme: Theme
  locale: Locale
  soundMode: SoundMode
  soundKind: SoundKind
}

/** A complete-configuration backup file (all persons, boards, settings). */
export interface BackupFile {
  app: 'quote-bingo-backup'
  version: 1
  state: BackupData
}

export const MIN_SIZE = 3
export const MAX_SIZE = 7
export const DEFAULT_SIZE = 5
export const SIZES: readonly number[] = [3, 4, 5, 6, 7]

/** True when the grid geometry allows a centre cell (odd sizes only). */
export function hasFreeCenter(size: number): boolean {
  return size % 2 === 1
}

/** Whether a card of this size + joker setting actually has a free centre. */
export function freeCenterActive(size: number, joker: boolean): boolean {
  return joker && hasFreeCenter(size)
}

/** Cell index of the free centre, or -1 when there is none. */
export function centerIndex(size: number, joker = true): number {
  return freeCenterActive(size, joker) ? Math.floor((size * size) / 2) : -1
}

/** How many quotes are needed to fill a card of the given size + joker setting. */
export function quotesNeeded(size: number, joker = true): number {
  return size * size - (freeCenterActive(size, joker) ? 1 : 0)
}
