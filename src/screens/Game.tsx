import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type TFunction } from 'i18next'
import { useStore } from '../store'
import { navigate } from '../router'
import { SIZES, quotesNeeded, hasFreeCenter } from '../types'
import { completedLineCount, isFullCard, winningCellsThrough } from '../lib/card'
import { accentStyle } from '../lib/accents'
import { confetti } from '../lib/confetti'
import { playFanfare } from '../lib/fanfare'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { BingoBoard } from '../components/BingoBoard'
import { WinBanner } from '../components/WinBanner'

const MIN_POOL = quotesNeeded(SIZES[0]!) // smallest card's requirement (3x3 -> 8)

/** Banner text for a win of `combo` lines completed by one tap. */
function winLabel(t: TFunction, combo: number): string {
  if (combo === 2) return t('game.doubleBingo')
  if (combo === 3) return t('game.tripleBingo')
  if (combo >= 4) return t('game.quadBingo')
  return t('game.bingo')
}

export function Game(): ReactNode {
  const { t } = useTranslation()
  const persons = useStore((s) => s.persons)
  const quotes = useStore((s) => s.quotes)
  const cards = useStore((s) => s.cards)
  const activePersonId = useStore((s) => s.activePersonId)
  const setActivePerson = useStore((s) => s.setActivePerson)
  const ensureCard = useStore((s) => s.ensureCard)
  const regenerateCard = useStore((s) => s.regenerateCard)
  const toggleCell = useStore((s) => s.toggleCell)
  const soundMode = useStore((s) => s.soundMode)
  const soundKind = useStore((s) => s.soundKind)

  // Win presentation: banner text + a bump key that retriggers the board shake.
  const [winBanner, setWinBanner] = useState<{ text: string; big: boolean } | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  // Cells to pulse on the current win — only the line(s) the last tap completed.
  const [pulseCells, setPulseCells] = useState<ReadonlySet<number>>(new Set())
  // Index of the most recently tapped cell, read by the win effect below.
  const lastToggledRef = useRef<number>(-1)

  // Default to first person if none active.
  const active = persons.find((p) => p.id === activePersonId) ?? persons[0] ?? null

  useEffect(() => {
    if (active && active.id !== activePersonId) setActivePerson(active.id)
  }, [active, activePersonId, setActivePerson])

  const poolCount = active ? quotes.filter((q) => q.personId === active.id).length : 0
  const ready = poolCount >= MIN_POOL
  const card = active ? cards[active.id] : undefined

  // Selectable size+joker combinations the current pool can fill. Odd sizes
  // offer a "with joker" entry and, if the pool is big enough, a "no joker"
  // entry (which needs one extra quote); even sizes never have a free centre.
  const cardOptions = useMemo(
    () =>
      SIZES.flatMap((s) => {
        const opts: { size: number; joker: boolean }[] = []
        if (hasFreeCenter(s)) {
          if (poolCount >= quotesNeeded(s, true)) opts.push({ size: s, joker: true })
          if (poolCount >= quotesNeeded(s, false)) opts.push({ size: s, joker: false })
        } else if (poolCount >= quotesNeeded(s, false)) {
          opts.push({ size: s, joker: false })
        }
        return opts
      }),
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
      const big = isFullCard(card.checked)
      // Lines this single tap completed at once (1 = Bingo, 2 = Double, …).
      const combo = lines - prevLines.current.lines
      const text = big ? t('game.fullCard') : winLabel(t, combo)
      // A full card or a multi-line combo earns the bigger, golden burst.
      const grand = big || combo >= 2
      confetti(grand ? { intensity: big ? 2 : 1.5, gold: true } : { intensity: 1 })
      setWinBanner({ text, big: grand })
      // Pulse only the line(s) the last-tapped cell just completed.
      setPulseCells(winningCellsThrough(card.size, card.checked, lastToggledRef.current))
      setShakeKey((k) => k + 1)
      // Sound the fanfare once per line completed (double bingo = twice, …);
      // a full card is a single grand flourish.
      playFanfare(soundMode, soundKind, big || combo >= 2, big ? 1 : combo)
    }
    prevLines.current = { cardId: card.personId, lines }
  }, [card, t, soundMode, soundKind])

  const reshuffle = (): void => {
    if (active && confirm(t('game.reshuffleConfirm'))) {
      regenerateCard(active.id)
      prevLines.current = { cardId: null, lines: 0 }
    }
  }

  const changeCard = (size: number, joker: boolean): void => {
    if (!active) return
    if (card && !confirm(t('game.resizeConfirm', { size }))) return
    regenerateCard(active.id, size, joker)
    prevLines.current = { cardId: null, lines: 0 }
  }

  if (persons.length === 0) {
    return (
      <div className="content">
        <p className="dim">{t('game.noPersons')}</p>
        <button className="primary" onClick={() => navigate({ name: 'manage' })}>
          {t('game.toManage')}
        </button>
      </div>
    )
  }

  return (
    <div className="content" style={accentStyle(active?.accent)}>
      <PersonSwitcher persons={persons} activeId={active?.id ?? null} onSelect={setActivePerson} />

      {active && !ready && (
        <p className="dim">
          {t('game.poolTooSmall', { name: active.name, count: poolCount, min: MIN_POOL })}{' '}
          <a href={`#/person/${active.id}`}>{t('game.addQuotes')}</a>
        </p>
      )}

      {active && ready && card && (
        <>
          <BingoBoard
            card={card}
            quoteText={quoteText}
            onToggle={(i) => {
              lastToggledRef.current = i
              toggleCell(active.id, i)
            }}
            shakeKey={shakeKey}
            pulseCells={pulseCells}
          />
          <div className="row">
            <label className="dim" htmlFor="size">
              {t('game.size')}
            </label>
            <select
              id="size"
              value={`${card.size}:${card.joker ? 'j' : 'n'}`}
              onChange={(e) => {
                const [s, j] = e.target.value.split(':')
                changeCard(Number(s), j === 'j')
              }}
            >
              {cardOptions.map(({ size, joker }) => (
                <option key={`${size}:${joker ? 'j' : 'n'}`} value={`${size}:${joker ? 'j' : 'n'}`}>
                  {size}×{size}
                  {joker ? ` (${t('game.jokerLabel')})` : ''}
                </option>
              ))}
            </select>
            <div className="spacer" />
            <button className="ghost" onClick={reshuffle}>
              {t('game.reshuffle')}
            </button>
          </div>
        </>
      )}

      {winBanner && (
        <WinBanner
          text={winBanner.text}
          big={winBanner.big}
          onDone={() => setWinBanner(null)}
        />
      )}
    </div>
  )
}
