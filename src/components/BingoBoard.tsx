import { useMemo, type ReactNode } from 'react'
import { type Card, centerIndex } from '../types'
import { winningCells } from '../lib/card'
import { Cell } from './Cell'
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
          <Cell
            key={i}
            text={text}
            checked={checked}
            free={isFree}
            win={winners.has(i)}
            onClick={() => onToggle(i)}
          />
        )
      })}
    </div>
  )
}
