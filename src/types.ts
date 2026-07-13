export type Id = string

export interface Person {
  id: Id
  name: string
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
  /** length size*size; null = free center (odd sizes only) */
  cells: (Id | null)[]
  /** length size*size; free center pre-checked true */
  checked: boolean[]
  createdAt: number
}

/** Shareable unit = one person + their quotes (text only). */
export interface QuoteListExport {
  version: 1
  person: { name: string }
  quotes: string[]
}

export const MIN_SIZE = 3
export const MAX_SIZE = 7
export const DEFAULT_SIZE = 5
export const SIZES: readonly number[] = [3, 4, 5, 6, 7]

/** True when the grid has a single centre cell that is a free space. */
export function hasFreeCenter(size: number): boolean {
  return size % 2 === 1
}

/** Cell index of the free centre, or -1 for even sizes. */
export function centerIndex(size: number): number {
  return hasFreeCenter(size) ? Math.floor((size * size) / 2) : -1
}

/** How many quotes are needed to fill a card of the given size. */
export function quotesNeeded(size: number): number {
  return size * size - (hasFreeCenter(size) ? 1 : 0)
}
