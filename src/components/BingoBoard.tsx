import { useMemo, type ReactNode } from 'react'
import clsx from 'clsx'
import { type Card, centerIndex } from '../types'
import { winningCells } from '../lib/card'
import './BingoBoard.scss'

interface Props {
  card: Card
  quoteText: Map<string, string>
  onToggle: (index: number) => void
}

export function BingoBoard({ card, quoteText, onToggle }: Props): ReactNode {
  const winners = useMemo(() => winningCells(card.size, card.checked), [card.size, card.checked])
  const center = centerIndex(card.size)

  return (
    <div className="board" style={{ gridTemplateColumns: `repeat(${card.size}, 1fr)` }}>
      {card.cells.map((quoteId, i) => {
        const isFree = i === center
        const checked = card.checked[i] ?? false
        const text = isFree
          ? 'FREI'
          : (quoteId && quoteText.get(quoteId)) || '(gelöschtes Zitat)'
        return (
          <button
            key={i}
            className={clsx('cell', {
              checked,
              free: isFree,
              win: winners.has(i),
            })}
            onClick={() => !isFree && onToggle(i)}
            disabled={isFree}
          >
            <span className="cell-text">{text}</span>
          </button>
        )
      })}
    </div>
  )
}
