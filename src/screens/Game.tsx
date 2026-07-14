import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useStore } from '../store'
import { navigate } from '../router'
import { SIZES, quotesNeeded, hasFreeCenter } from '../types'
import { completedLineCount, isFullCard } from '../lib/card'
import { confetti } from '../lib/confetti'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { BingoBoard } from '../components/BingoBoard'
import { useToast } from '../components/toast-context'

const MIN_POOL = quotesNeeded(SIZES[0]!) // smallest card's requirement (3x3 -> 8)

export function Game(): ReactNode {
  const persons = useStore((s) => s.persons)
  const quotes = useStore((s) => s.quotes)
  const cards = useStore((s) => s.cards)
  const activePersonId = useStore((s) => s.activePersonId)
  const setActivePerson = useStore((s) => s.setActivePerson)
  const ensureCard = useStore((s) => s.ensureCard)
  const regenerateCard = useStore((s) => s.regenerateCard)
  const toggleCell = useStore((s) => s.toggleCell)
  const toast = useToast()

  // Default to first person if none active.
  const active = persons.find((p) => p.id === activePersonId) ?? persons[0] ?? null

  useEffect(() => {
    if (active && active.id !== activePersonId) setActivePerson(active.id)
  }, [active, activePersonId, setActivePerson])

  const poolCount = active ? quotes.filter((q) => q.personId === active.id).length : 0
  const ready = poolCount >= MIN_POOL
  const card = active ? cards[active.id] : undefined

  // Sizes whose quota the current pool can satisfy.
  const availableSizes = useMemo(
    () => SIZES.filter((s) => poolCount >= quotesNeeded(s)),
    [poolCount],
  )

  // Create the card lazily once the pool is large enough.
  useEffect(() => {
    if (active && ready && !card) ensureCard(active.id)
  }, [active, ready, card, ensureCard])

  const quoteText = useMemo(() => {
    const m = new Map<string, string>()
    for (const q of quotes) m.set(q.id, q.text)
    return m
  }, [quotes])

  // Celebrate only on newly completed lines. Track the previous count
  // per card id so entering the game or switching person establishes a
  // baseline silently instead of replaying past wins.
  const prevLines = useRef<{ cardId: string | null; lines: number }>({
    cardId: null,
    lines: 0,
  })
  useEffect(() => {
    if (!card) {
      prevLines.current = { cardId: null, lines: 0 }
      return
    }
    const lines = completedLineCount(card.size, card.checked)
    const isSameCard = prevLines.current.cardId === card.personId
    if (isSameCard && lines > prevLines.current.lines) {
      if (isFullCard(card.checked)) {
        toast('VOLLE KARTE! 🎉', 'win')
        confetti(2)
      } else {
        toast('BINGO! 🎉', 'win')
        confetti(1)
      }
    }
    prevLines.current = { cardId: card.personId, lines }
  }, [card, toast])

  const reshuffle = (): void => {
    if (active && confirm('Karte neu mischen? Angekreuzte Felder werden zurückgesetzt.')) {
      regenerateCard(active.id)
      prevLines.current = { cardId: null, lines: 0 }
    }
  }

  const changeSize = (size: number): void => {
    if (!active) return
    if (card && !confirm(`Auf ${size}×${size} umstellen? Die Karte wird neu erstellt.`)) return
    // Dropping the joker needs one more quote; if the pool can't cover it at the
    // new size, fall back to a free centre.
    const keepJoker = card ? card.joker : true
    const joker = keepJoker || poolCount < quotesNeeded(size, false)
    regenerateCard(active.id, size, joker)
    prevLines.current = { cardId: null, lines: 0 }
  }

  const changeJoker = (joker: boolean): void => {
    if (!active || !card) return
    if (!confirm('Joker-Feld ändern? Die Karte wird neu erstellt.')) return
    regenerateCard(active.id, card.size, joker)
    prevLines.current = { cardId: null, lines: 0 }
  }

  if (persons.length === 0) {
    return (
      <div className="content">
        <p className="dim">Noch keine Personen.</p>
        <button className="primary" onClick={() => navigate({ name: 'manage' })}>
          Zur Verwaltung
        </button>
      </div>
    )
  }

  return (
    <div className="content">
      <PersonSwitcher persons={persons} activeId={active?.id ?? null} onSelect={setActivePerson} />

      {active && !ready && (
        <p className="dim">
          „{active.name}“ hat {poolCount} Zitate – für die kleinste Karte (3×3) werden{' '}
          {MIN_POOL} benötigt.{' '}
          <a href={`#/person/${active.id}`}>Zitate hinzufügen</a>
        </p>
      )}

      {active && ready && card && (
        <>
          <BingoBoard
            card={card}
            quoteText={quoteText}
            onToggle={(i) => toggleCell(active.id, i)}
          />
          <div className="row">
            <label className="dim" htmlFor="size">
              Größe
            </label>
            <select
              id="size"
              value={card.size}
              onChange={(e) => changeSize(Number(e.target.value))}
            >
              {availableSizes.map((s) => (
                <option key={s} value={s}>
                  {s}×{s}
                </option>
              ))}
            </select>
            {hasFreeCenter(card.size) && (
              <label
                className="dim joker-toggle"
                title={
                  poolCount < quotesNeeded(card.size, false)
                    ? 'Zu wenige Zitate für ein Feld ohne Joker.'
                    : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={card.joker}
                  disabled={!card.joker && poolCount < quotesNeeded(card.size, false)}
                  onChange={(e) => changeJoker(e.target.checked)}
                />
                Joker
              </label>
            )}
            <div className="spacer" />
            <button className="ghost" onClick={reshuffle}>
              Neu mischen
            </button>
          </div>
        </>
      )}
    </div>
  )
}
