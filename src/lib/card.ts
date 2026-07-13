import {
  type Card,
  type Id,
  centerIndex,
  hasFreeCenter,
  quotesNeeded,
} from '../types'

/** In-place Fisher–Yates shuffle returning a new array. */
function shuffle<T>(input: readonly T[]): T[] {
  const arr = input.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = arr[i]!
    const b = arr[j]!
    arr[i] = b
    arr[j] = a
  }
  return arr
}

/**
 * Build a fresh NxN card from a person's quote pool.
 * Odd sizes get a free space at the centre; even sizes fill every cell.
 * Throws if the pool is too small for the chosen size.
 */
export function generateCard(personId: Id, quoteIds: readonly Id[], size: number): Card {
  const need = quotesNeeded(size)
  if (quoteIds.length < need) {
    throw new Error(`Need at least ${need} quotes for ${size}x${size}, have ${quoteIds.length}`)
  }
  const total = size * size
  const center = centerIndex(size)
  const picked = shuffle(quoteIds).slice(0, need)
  const cells: (Id | null)[] = []
  const checked: boolean[] = []
  let p = 0
  for (let i = 0; i < total; i++) {
    if (i === center) {
      cells.push(null)
      checked.push(true) // free space is always checked
    } else {
      cells.push(picked[p++]!)
      checked.push(false)
    }
  }
  return { personId, size, cells, checked, createdAt: Date.now() }
}

/** The winning lines (rows, cols, both diagonals) as cell-index arrays. */
export function linesFor(size: number): number[][] {
  const lines: number[][] = []
  for (let r = 0; r < size; r++) {
    lines.push(Array.from({ length: size }, (_, c) => r * size + c))
  }
  for (let c = 0; c < size; c++) {
    lines.push(Array.from({ length: size }, (_, r) => r * size + c))
  }
  lines.push(Array.from({ length: size }, (_, i) => i * size + i))
  lines.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)))
  return lines
}

/** Set of cell indices that belong to any completed line (for highlighting). */
export function winningCells(size: number, checked: readonly boolean[]): Set<number> {
  const cells = new Set<number>()
  for (const line of linesFor(size)) {
    if (line.every((cell) => checked[cell])) {
      for (const cell of line) cells.add(cell)
    }
  }
  return cells
}

/** Count of fully-checked winning lines. */
export function completedLineCount(size: number, checked: readonly boolean[]): number {
  let n = 0
  for (const line of linesFor(size)) {
    if (line.every((cell) => checked[cell])) n++
  }
  return n
}

/** True when every non-free cell is checked. */
export function isFullCard(checked: readonly boolean[]): boolean {
  return checked.every(Boolean)
}

export { hasFreeCenter }
