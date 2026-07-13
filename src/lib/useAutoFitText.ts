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

      let lo = MIN_PX
      let hi = MAX_PX
      // Largest size that fits.
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2
        el.style.fontSize = `${mid}px`
        const fits = el.scrollWidth <= availW && el.scrollHeight <= availH
        if (fits) lo = mid
        else hi = mid
      }
      el.style.fontSize = `${lo}px`
      return true
    }

    // Measure once layout is stable. On mobile the first frame(s) after a
    // (re)mount can still report a zero-sized box, so retry across a few frames
    // until it has real dimensions instead of leaving a stale font size behind.
    const schedule = (): void => {
      raf = requestAnimationFrame(() => {
        if (!fit() && attempts++ < 10) schedule()
      })
    }
    schedule()

    // Web-font metrics can settle after first paint; refit when fonts are ready.
    if (document.fonts?.status === 'loading') {
      void document.fonts.ready.then(() => fit())
    }

    // Genuine size changes (orientation, window resize) still refit.
    const ro = new ResizeObserver(() => fit())
    ro.observe(box)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [boxRef, textRef, text])
}
