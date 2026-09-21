import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type TFunction } from 'i18next'
import { useStore } from '../store'
import { navigate } from '../router'
import { SIZES, quotesNeeded, hasFreeCenter } from '../types'
import { completedLineCount, isFullCard, winningCellsThrough } from '../lib/card'
import { accentStyle } from '../lib/accents'
import { confetti } from '../lib/confetti'
import { playFanfare } from '../lib/fanfare'
import { useSwipe } from '../lib/useSwipe'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { BingoBoard } from '../components/BingoBoard'
import { WinBanner } from '../components/WinBanner'

const MIN_POOL = quotesNeeded(SIZES[0]!) // smallest card's requirement (3x3 -> 8)

/**
 * Font size (px) at or below which the magnifier hint is worth showing.
 *
 * Keyed on what the auto-fit actually produced, not on the card size: a 5x5 on
 * a 375px phone fits its longest quotes at 7.5-8.3px, which is past reading
 * size even though the board is not large. Guessing from the size alone missed
 * exactly that case.
 *
 * 11px is about where a cell stops being comfortably readable at arm's length;
 * a board whose worst cell clears that does not need telling about the
 * gesture.
 */
const HINT_BELOW_PX = 11
/** Times to show the hint before assuming it has been read. */
const MAGNIFY_HINT_LIMIT = 3

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
  const magnifyHintsSeen = useStore((s) => s.magnifyHintsSeen)
  const noteMagnifyHintSeen = useStore((s) => s.noteMagnifyHintSeen)

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

  // Swipe left/right on the board to step through the person list. The board
  // slides in from the side it came from, so the direction of travel is
  // visible; `slideKey` restarts the animation on every switch.
  const [slide, setSlide] = useState<{ dir: -1 | 1; key: number } | null>(null)
  const swipePerson = (dir: -1 | 1): void => {
    if (!active || persons.length < 2) return
    const i = persons.findIndex((p) => p.id === active.id)
    if (i < 0) return
    const next = persons[(i + dir + persons.length) % persons.length]
    if (!next || next.id === active.id) return
    setSlide((s) => ({ dir, key: (s?.key ?? 0) + 1 }))
    setActivePerson(next.id)
  }
  // Set while a cell is magnified. A ref, not state: the swipe handler reads
  // it during a touch, and re-rendering the board mid-gesture to carry a flag
  // would remount the cells being read.
  const magnifyingRef = useRef(false)
  const onMagnifyChange = useCallback((open: boolean) => {
    magnifyingRef.current = open
  }, [])
  // Smallest font size the auto-fit produced on the current board, or null
  // until it has reported. Drives the magnifier hint.
  const [smallestPx, setSmallestPx] = useState<number | null>(null)
  const onFitMeasured = useCallback((px: number) => setSmallestPx(px), [])
  const swipe = useSwipe(swipePerson, () => magnifyingRef.current)

  const poolCount = active ? quotes.filter((q) => q.personId === active.id).length : 0
  const ready = poolCount >= MIN_POOL
  const card = active ? cards[active.id] : undefined

  // Drop the previous board's fit measurement as soon as the card changes, so
  // the hint is never decided from the size the last person's cells came out
  // at. Done during render rather than in an effect: the stale value must not
  // survive even one paint of the new board.
  const measuredCard = useRef<string | null>(null)
  const cardKey = card ? `${card.personId}-${card.createdAt}-${card.size}` : null
  if (measuredCard.current !== cardKey) {
    measuredCard.current = cardKey
    if (smallestPx !== null) setSmallestPx(null)
  }

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

  // The magnifier hint: only once the board has actually come out small, only
  // until it has been seen a few times, and not on a device driven by a mouse
  // — the gesture works there but nobody goes looking for it, so it would be
  // noise.
  //
  // `smallestPx` (declared above, with the board callbacks) is null until the
  // board reports its fit, so the hint appears a moment after the cells settle
  // rather than flashing on a guess.
  const coarsePointer =
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
  const showMagnifyHint =
    coarsePointer &&
    !!card &&
    smallestPx !== null &&
    smallestPx <= HINT_BELOW_PX &&
    magnifyHintsSeen < MAGNIFY_HINT_LIMIT

  // Count one showing per board that displays it, not per render. Keyed on the
  // card's identity (person + when it was dealt) so switching person, resizing
  // or reshuffling counts again, while a win, a tap or a re-render of the same
  // board does not.
  const hintedCard = useRef<string | null>(null)
  useEffect(() => {
    if (!showMagnifyHint || !card) return
    const key = `${card.personId}-${card.createdAt}`
    if (hintedCard.current === key) return
    hintedCard.current = key
    noteMagnifyHintSeen()
  }, [showMagnifyHint, card, noteMagnifyHintSeen])

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
    <div className="content">
      {/* Outside the accent scope on purpose: the switcher shows every person,
          so each chip must paint its OWN colour. `default` resolves to
          `var(--primary)` at paint time, which inside the scope would be the
          SELECTED person's override — a default person's chip then took on
          whoever was active. */}
      <PersonSwitcher persons={persons} activeId={active?.id ?? null} onSelect={setActivePerson} />

      <div className="board-accent" style={accentStyle(active?.accent)}>
        {active && !ready && (
          <p className="dim">
            {t('game.poolTooSmall', { name: active.name, count: poolCount, min: MIN_POOL })}{' '}
            <a href={`#/person/${active.id}`}>{t('game.addQuotes')}</a>
          </p>
        )}

        {active && ready && card && (
          <>
            <div
              className="board-swipe"
              onTouchStart={swipe.onTouchStart}
              onTouchMove={swipe.onTouchMove}
              onTouchEnd={swipe.onTouchEnd}
              onClickCapture={swipe.onClickCapture}
            >
              <BingoBoard
                // Remount per person so the slide-in animation replays and the
                // cells re-measure their auto-fit text on fresh nodes.
                key={`${active.id}-${slide?.key ?? 0}`}
                card={card}
                quoteText={quoteText}
                onToggle={(i) => {
                  lastToggledRef.current = i
                  toggleCell(active.id, i)
                }}
                shakeKey={shakeKey}
                pulseCells={pulseCells}
                slideFrom={slide?.dir ?? null}
                onMagnifyChange={onMagnifyChange}
                onFitMeasured={onFitMeasured}
              />
            </div>
            {showMagnifyHint && (
              <p className="board-hint">
                <span className="board-hint-icon" aria-hidden="true">
                  👆
                </span>
                {t('game.magnifyHint')}
              </p>
            )}
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
                  <option
                    key={`${size}:${joker ? 'j' : 'n'}`}
                    value={`${size}:${joker ? 'j' : 'n'}`}
                  >
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
    </div>
  )
}
