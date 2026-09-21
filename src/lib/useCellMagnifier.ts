import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/** Hold this long before the magnifier opens. */
const HOLD_MS = 450
/**
 * Travel (px) that cancels the pending long-press. Generous enough to survive
 * the wobble of a finger held still, tight enough that a swipe — which needs
 * 60px to register — never opens the magnifier on its way past.
 */
const MOVE_TOLERANCE = 10

export interface MagnifierTarget {
  /** Index of the cell under the pointer. */
  index: number
  /** Viewport rect of that cell, for positioning the bubble. */
  rect: DOMRect
}

export interface MagnifierHandlers {
  onPointerDown: (e: ReactPointerEvent) => void
  onPointerMove: (e: ReactPointerEvent) => void
  onPointerUp: (e: ReactPointerEvent) => void
  onPointerCancel: (e: ReactPointerEvent) => void
}

export interface Magnifier {
  /** The cell currently magnified, or null when the bubble is closed. */
  target: MagnifierTarget | null
  /** True while the bubble is up; the board uses it to hold the gesture. */
  open: boolean
  handlers: MagnifierHandlers
  /**
   * Capture-phase click guard. The press that opened the magnifier ends in a
   * click on whichever cell the finger happens to be over, which must not
   * toggle it. Stays armed for one click after release.
   */
  onClickCapture: (e: { stopPropagation: () => void; preventDefault: () => void }) => void
}

/**
 * Long-press a cell to magnify it, then slide to read the neighbours.
 *
 * On a phone a 7x7 board leaves the auto-fit no room: the median cell renders
 * near 9px and most of the board sits under 10px, which is past reading size.
 * Holding a cell opens a bubble with the same text at a readable size, and
 * because the bubble tracks the pointer rather than the originally pressed
 * cell, one hold reads a whole row without lifting off.
 *
 * Pointer Events (not touch) so a mouse works the same, and the pointer is
 * captured on the board: the drag keeps delivering to the board even once the
 * finger leaves the cell it started on, which is the normal case here.
 *
 * `cellAt` maps viewport coordinates to a cell index; the board owns the grid
 * geometry, so it supplies the lookup.
 */
export function useCellMagnifier(
  cellAt: (x: number, y: number) => MagnifierTarget | null,
  /** The board element, needed for a non-passive touchmove listener. */
  hostRef: { current: HTMLElement | null },
  enabled = true,
): Magnifier {
  const [target, setTarget] = useState<MagnifierTarget | null>(null)
  const timer = useRef<number>(0)
  const origin = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  // Read by the board's click guard: a press that became a magnifier must not
  // also toggle the cell when the finger lifts.
  const opened = useRef(false)

  const clearTimer = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = 0
    }
  }, [])

  const close = useCallback(() => {
    clearTimer()
    origin.current = null
    setTarget(null)
  }, [clearTimer])

  // A pending timer must not outlive the component (or a person switch, which
  // remounts the board mid-press).
  useEffect(() => clearTimer, [clearTimer])

  // Hold the gesture that is already in flight.
  //
  // `touch-action` is read when a gesture BEGINS, so flipping it once the hold
  // fires (450ms in) is too late — the browser has already decided this touch
  // scrolls the page. The only way to take it back mid-gesture is to
  // preventDefault the touchmove, and React's onTouchMove is registered
  // passively, where preventDefault is ignored. Hence a native listener with
  // `{ passive: false }`, attached only while the bubble is open.
  const open = target !== null
  useEffect(() => {
    const el = hostRef.current
    if (!open || !el) return
    const block = (e: TouchEvent): void => {
      if (e.cancelable) e.preventDefault()
    }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [open, hostRef])

  // Suppress the platform's own long-press.
  //
  // Android Chrome runs a ~500ms press of its own that selects the text under
  // the finger and raises the copy/cut/select-all bar. That bar covers the
  // bubble, and the selection cancels the pointer stream driving it, so the
  // magnifier flashed up and died. `user-select: none` on the cells stops the
  // selection but not the contextmenu event, which fires on long-press on
  // Android and on right-click elsewhere, so it is cancelled here.
  //
  // Bound for the whole life of the board rather than only while the bubble is
  // open: the platform gesture and ours run on near-identical timers, and
  // arming this at 450ms would be a race against an event that may already
  // have fired.
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const block = (e: Event): void => e.preventDefault()
    el.addEventListener('contextmenu', block)
    return () => el.removeEventListener('contextmenu', block)
  }, [hostRef])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent): void => {
      if (!enabled || !e.isPrimary) return
      opened.current = false
      origin.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
      const { clientX, clientY, currentTarget, pointerId } = e
      clearTimer()
      timer.current = window.setTimeout(() => {
        const hit = cellAt(clientX, clientY)
        if (!hit) return
        opened.current = true
        // Keep receiving moves once the finger leaves the starting cell — the
        // whole point is to slide across the board.
        try {
          currentTarget.setPointerCapture(pointerId)
        } catch {
          // Capture is a nicety; without it the bubble still opens and the
          // board's own move handler keeps firing while the finger is over it.
        }
        setTarget(hit)
      }, HOLD_MS)
    },
    [cellAt, clearTimer, enabled],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent): void => {
      const start = origin.current
      if (!start || e.pointerId !== start.pointerId) return

      if (!opened.current) {
        // Still waiting on the hold: any real travel means this is a tap or a
        // swipe, not a press.
        const dx = e.clientX - start.x
        const dy = e.clientY - start.y
        if (Math.hypot(dx, dy) > MOVE_TOLERANCE) clearTimer()
        return
      }

      // Open: follow the finger onto whichever cell is under it now.
      const hit = cellAt(e.clientX, e.clientY)
      // Off the grid (past the board edge) keeps the last cell rather than
      // flickering the bubble away mid-drag.
      if (hit) setTarget((prev) => (prev && prev.index === hit.index ? prev : hit))
    },
    [cellAt, clearTimer],
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent): void => {
      const start = origin.current
      if (!start || e.pointerId !== start.pointerId) return
      close()
      // `opened` stays set so the click this release generates is swallowed by
      // the guard. But a click is not guaranteed — a touch that ended outside
      // the cell it started on produces none — and a guard left armed would
      // eat the NEXT genuine tap.
      //
      // A timer, not requestAnimationFrame: a backgrounded or throttled tab
      // may paint no frame for a long time, and the guard has to disarm on
      // wall-clock time whether or not anything renders. The click that
      // follows a release is dispatched in the same task sequence, so it has
      // always arrived well before this fires.
      if (opened.current) {
        window.setTimeout(() => {
          opened.current = false
        }, 50)
      }
    },
    [close],
  )

  const onClickCapture = useCallback(
    (e: { stopPropagation: () => void; preventDefault: () => void }): void => {
      if (!opened.current) return
      opened.current = false
      e.stopPropagation()
      e.preventDefault()
    },
    [],
  )

  return {
    target,
    open,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    onClickCapture,
  }
}
