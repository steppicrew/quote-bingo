import { useLayoutEffect, type RefObject } from 'react'

const MIN_PX = 6
// Cap so short quotes on big (3×3) tiles don't get comically large.
const MAX_PX = 30

/**
 * Binary-searches the largest font size (px) at which `text` still fits inside
 * `boxRef` without overflowing, and applies it to `textRef`. Re-runs whenever the
 * box resizes or `text` changes.
 */
export function useAutoFitText(
  boxRef: RefObject<HTMLElement | null>,
  textRef: RefObject<HTMLElement | null>,
  text: string,
): void {
  useLayoutEffect(() => {
    const box = boxRef.current
    const el = textRef.current
    if (!box || !el) return

    let raf = 0
    let attempts = 0

    /** @returns true if the box was ready and a fit was applied. */
    const fit = (): boolean => {
      const cs = getComputedStyle(box)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const availW = box.clientWidth - padX
      const availH = box.clientHeight - padY
      if (availW <= 0 || availH <= 0) return false

      // The `.cell-text` span renders at `width:100%` (fills the cell), so it
      // wraps at exactly `availW` — the same width we measure at here. Lift its
      // `max-height`/`overflow` so `scrollHeight` reports the true (possibly
      // overflowing) content height instead of being clamped to the cell.
      const s = el.style
      const prev = { maxHeight: s.maxHeight, overflow: s.overflow }
      s.maxHeight = 'none'
      s.overflow = 'visible'

      let lo = MIN_PX
      let hi = MAX_PX
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2
        s.fontSize = `${mid}px`
        const fits = el.scrollWidth <= availW + 0.5 && el.scrollHeight <= availH + 0.5
        if (fits) lo = mid
        else hi = mid
      }
      s.fontSize = `${lo}px`

      // Restore the constraints for normal rendering.
      s.maxHeight = prev.maxHeight
      s.overflow = prev.overflow
      return true
    }

    // Measure once layout is stable. On mobile — and especially in an installed
    // (standalone) PWA — the first frames after a (re)mount can report a
    // zero-sized box, so retry across a few frames until it has real dimensions
    // instead of leaving the default font size behind.
    const schedule = (): void => {
      raf = requestAnimationFrame(() => {
        if (!fit() && attempts++ < 60) schedule()
      })
    }
    schedule()

    // Web-font metrics can settle after first paint; refit when fonts are ready.
    if (document.fonts?.status !== 'loaded') {
      void document.fonts?.ready.then(() => fit())
    }

    // Genuine size changes (orientation, window resize, the board's height
    // resolving) refit. This is the durable path once the box is sized.
    const ro = new ResizeObserver(() => fit())
    ro.observe(box)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [boxRef, textRef, text])
}
