import { useRef, type TouchEvent as ReactTouchEvent } from 'react'

/** Minimum horizontal travel (px) before a touch counts as a swipe. */
const THRESHOLD = 60
/** How much more horizontal than vertical the travel must be to count. */
const DOMINANCE = 1.4

export interface SwipeHandlers {
  onTouchStart: (e: ReactTouchEvent) => void
  onTouchMove: (e: ReactTouchEvent) => void
  onTouchEnd: (e: ReactTouchEvent) => void
  /** Capture-phase click guard: swallows the tap that ended a swipe. */
  onClickCapture: (e: { stopPropagation: () => void; preventDefault: () => void }) => void
}

/**
 * Horizontal swipe detection for touch devices.
 *
 * `onSwipe(-1 | 1)` fires on release: -1 for a swipe right (previous), 1 for a
 * swipe left (next). Vertical drags are ignored so page scrolling still works.
 *
 * The gesture lives on a container whose children are buttons (the bingo
 * cells), so a swipe that starts on a cell would otherwise also fire that
 * cell's click. Once the travel passes the threshold the gesture is latched as
 * a swipe and the following click is cancelled in the capture phase, before it
 * reaches the cell.
 */
export function useSwipe(onSwipe: (dir: -1 | 1) => void): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null)
  // Set once the current gesture is unambiguously a horizontal swipe; read by
  // the click guard and cleared on the next touch start.
  const swiped = useRef(false)

  const onTouchStart = (e: ReactTouchEvent): void => {
    const t = e.touches[0]
    start.current = t ? { x: t.clientX, y: t.clientY } : null
    swiped.current = false
  }

  const onTouchMove = (e: ReactTouchEvent): void => {
    const s = start.current
    const t = e.touches[0]
    if (!s || !t) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) >= THRESHOLD && Math.abs(dx) > Math.abs(dy) * DOMINANCE) swiped.current = true
  }

  const onTouchEnd = (e: ReactTouchEvent): void => {
    const s = start.current
    start.current = null
    const t = e.changedTouches[0]
    if (!s || !t) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) < THRESHOLD || Math.abs(dx) <= Math.abs(dy) * DOMINANCE) return
    swiped.current = true
    onSwipe(dx < 0 ? 1 : -1)
  }

  const onClickCapture = (e: { stopPropagation: () => void; preventDefault: () => void }): void => {
    if (!swiped.current) return
    swiped.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onClickCapture }
}
