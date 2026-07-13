import { useLayoutEffect, type RefObject } from 'react'

const MIN_PX = 6
const MAX_PX = 64

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

    const fit = (): void => {
      const cs = getComputedStyle(box)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const availW = box.clientWidth - padX
      const availH = box.clientHeight - padY
      if (availW <= 0 || availH <= 0) return

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
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [boxRef, textRef, text])
}
