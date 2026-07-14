import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type Card, centerIndex } from '../types'
import { winningCells } from '../lib/card'
import { Cell } from './Cell'
import './BingoBoard.scss'

interface Props {
  card: Card
  quoteText: Map<string, string>
  onToggle: (index: number) => void
  /** Bumping this number replays the celebratory board shake. */
  shakeKey?: number
  /** Cells to pulse during the current celebration (lines the last tap made). */
  pulseCells?: ReadonlySet<number>
}

export function BingoBoard({
  card,
  quoteText,
  onToggle,
  shakeKey = 0,
  pulseCells,
}: Props): ReactNode {
  const { t } = useTranslation()
  const winners = useMemo(() => winningCells(card.size, card.checked), [card.size, card.checked])
  const center = centerIndex(card.size, card.joker)

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

  return (
    <div
      ref={boardRef}
      className="board"
      style={{
        gridTemplateColumns: `repeat(${card.size}, 1fr)`,
        gridTemplateRows: `repeat(${card.size}, 1fr)`,
      }}
    >
      {card.cells.map((quoteId, i) => {
        const isFree = i === center
        const checked = card.checked[i] ?? false
        const text = isFree
          ? t('board.free')
          : (quoteId && quoteText.get(quoteId)) || t('board.deletedQuote')
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
    </div>
  )
}
