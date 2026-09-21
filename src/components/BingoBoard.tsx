import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { type Card, centerIndex } from '../types'
import { winningCells } from '../lib/card'
import { useCellMagnifier, type MagnifierTarget } from '../lib/useCellMagnifier'
import { Cell } from './Cell'
import { CellMagnifier } from './CellMagnifier'
import './BingoBoard.scss'

interface Props {
  card: Card
  quoteText: Map<string, string>
  onToggle: (index: number) => void
  /** Bumping this number replays the celebratory board shake. */
  shakeKey?: number
  /** Cells to pulse during the current celebration (lines the last tap made). */
  pulseCells?: ReadonlySet<number>
  /**
   * Direction of the person swipe that produced this board: 1 = swiped left
   * (next person, slides in from the right), -1 = swiped right. `null` for a
   * plain render, which gets no slide animation.
   */
  slideFrom?: -1 | 1 | null
  /**
   * Called whenever the magnifier opens or closes. The swipe handler lives a
   * level up and must not switch person while a cell is being read — sliding
   * across the board to read on is a long horizontal drag, which is exactly
   * the shape of a person swipe.
   */
  onMagnifyChange?: (open: boolean) => void
}

export function BingoBoard({
  card,
  quoteText,
  onToggle,
  shakeKey = 0,
  pulseCells,
  slideFrom = null,
  onMagnifyChange,
}: Props): ReactNode {
  const { t } = useTranslation()
  const winners = useMemo(() => winningCells(card.size, card.checked), [card.size, card.checked])
  const center = centerIndex(card.size, card.joker)

  // Resolved once so the grid and the magnifier bubble cannot disagree about
  // what a cell says.
  const texts = useMemo(
    () =>
      card.cells.map((quoteId, i) =>
        i === center ? t('board.free') : (quoteId && quoteText.get(quoteId)) || t('board.deletedQuote'),
      ),
    [card.cells, center, quoteText, t],
  )

  // On each new win (shakeKey bump) replay the board shake and pulse the cells
  // of the line(s) the last tap completed (`.pulse`, set via pulseCells).
  // Driven directly on the DOM node via a board-level `celebrate` class so the
  // pulse restarts each win even for cells that were already pulsing.
  const boardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (shakeKey === 0) return
    const el = boardRef.current
    if (!el) return
    el.classList.remove('shake', 'celebrate')
    void el.offsetWidth // reflow so the animations can restart
    el.classList.add('shake', 'celebrate')
    const id = window.setTimeout(() => el.classList.remove('shake', 'celebrate'), 1900)
    return () => window.clearTimeout(id)
  }, [shakeKey])

  // Force the board to a square by setting its height to its own width. CSS
  // `aspect-ratio` proved unreliable here: the grid's tall wrapped-text content
  // won out and the board grew far past square (cells ended up ~62×164). An
  // explicit pixel height gives the `minmax(0,1fr)` rows a definite box to
  // divide, so every cell is a real square and the text auto-fit works.
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const apply = (): void => {
      const w = el.clientWidth
      const target = `${w}px`
      if (w > 0 && el.style.height !== target) el.style.height = target
    }
    apply()
    // Observe the parent's width so our own height changes don't re-trigger us.
    const ro = new ResizeObserver(apply)
    if (el.parentElement) ro.observe(el.parentElement)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Viewport point -> cell, for the magnifier. Walks the real DOM rather than
  // computing from the grid template: the board is the authority on where its
  // cells ended up, and this stays correct through the slide animation, the
  // safe-area insets and any future gap change.
  const cellAt = useCallback((x: number, y: number): MagnifierTarget | null => {
    const board = boardRef.current
    if (!board) return null
    const cells = board.children
    for (let i = 0; i < cells.length; i++) {
      const el = cells[i]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return { index: i, rect }
      }
    }
    return null
  }, [])

  const magnifier = useCellMagnifier(cellAt, boardRef)

  // Report open/close upward so the swipe handler can stand down. Also report
  // closed on unmount: the board is remounted on every person switch and
  // reshuffle, and a flag left set would disable swiping for good.
  useEffect(() => {
    onMagnifyChange?.(magnifier.open)
  }, [magnifier.open, onMagnifyChange])
  useEffect(() => () => onMagnifyChange?.(false), [onMagnifyChange])

  const magnified = magnifier.target

  return (
    <div
      ref={boardRef}
      className={clsx(
        'board',
        slideFrom === 1 && 'slide-next',
        slideFrom === -1 && 'slide-prev',
        magnifier.open && 'magnifying',
      )}
      {...magnifier.handlers}
      // Capture phase, like the swipe guard: swallow the click that ends a
      // long-press before it reaches the cell and toggles it.
      onClickCapture={magnifier.onClickCapture}
      style={{
        // minmax(0, 1fr) — not plain 1fr — so a cell with tall wrapped text
        // can't force its row's min track size to the content height. Plain
        // 1fr resolves to minmax(auto, 1fr), letting tall text stretch rows
        // past the board's square aspect-ratio (cells became tall + narrow).
        gridTemplateColumns: `repeat(${card.size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${card.size}, minmax(0, 1fr))`,
      }}
    >
      {card.cells.map((_quoteId, i) => {
        const isFree = i === center
        const checked = card.checked[i] ?? false
        const text = texts[i] ?? ''
        return (
          <Cell
            // Include the card's creation stamp so every reshuffle remounts the
            // cells; each Cell then re-measures on a fresh, painted node instead
            // of relying on a resize event that never comes (box size unchanged).
            key={`${card.createdAt}-${i}`}
            text={text}
            checked={checked}
            free={isFree}
            win={winners.has(i)}
            pulse={pulseCells?.has(i) ?? false}
            onClick={() => onToggle(i)}
          />
        )
      })}

      {magnified && (
        <CellMagnifier
          text={texts[magnified.index] ?? ''}
          rect={magnified.rect}
          checked={card.checked[magnified.index] ?? false}
        />
      )}
    </div>
  )
}
