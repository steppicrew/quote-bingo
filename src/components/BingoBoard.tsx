import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const winners = useMemo(() => winningCells(card.size, card.checked), [card.size, card.checked])
  const center = centerIndex(card.size, card.joker)

  return (
    <div
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
            onClick={() => onToggle(i)}
          />
        )
      })}
    </div>
  )
}
