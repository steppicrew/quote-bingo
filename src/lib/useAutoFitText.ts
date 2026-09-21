import { useLayoutEffect, type RefObject } from 'react'

const MIN_PX = 6
// Cap so short quotes on big (3×3) tiles don't get comically large.
const MAX_PX = 30
// Below this, keeping a word intact costs more than it is worth: the type gets
// too small to read at arm's length, and a hyphenated break is the better deal.
// "Steinofenpizza" fits whole only at 8.3px in a phone-sized cell, against 15px
// when it may break — so the floor is what stops the no-split pass from
// producing unreadable cells.
const WHOLE_WORD_FLOOR_PX = 12

/**
 * Binary-searches the largest font size (px) at which `text` still fits inside
 * `boxRef` without overflowing, and applies it to `textRef`. Re-runs whenever the
 * box resizes or `text` changes.
 *
 * Runs the search twice. The first pass forbids splitting words at all, because
 * maximising the font size alone produced a worse result than a smaller one:
 * "Knecht" in a 65px cell took 22.5px and wrapped to "Knec/ht", where 17.6px
 * shows it whole. Only when no-split lands below WHOLE_WORD_FLOOR_PX does the
 * second, permissive pass run and let hyphenation and word-break do their job.
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
      const prev = {
        maxHeight: s.maxHeight,
        overflow: s.overflow,
        hyphens: s.hyphens,
        wordBreak: s.wordBreak,
        overflowWrap: s.overflowWrap,
      }
      s.maxHeight = 'none'
      s.overflow = 'visible'

      // A descender on the LAST line (the g of "gemacht") can paint below the
      // line box, and `.cell-text` clamps to the cell with its own
      // `overflow: hidden` — so the ink was sliced even when the fit was
      // arithmetically correct. The line box is not the ink box.
      //
      // The stylesheet now uses a line-height with room for the descender, but
      // read it rather than assuming: measure how far the font's ink drops
      // past the line box at each candidate size and require that to fit too.
      const csText = getComputedStyle(el)
      const probe = document.createElement('canvas').getContext('2d')
      const lineRatio = parseFloat(csText.lineHeight) / parseFloat(csText.fontSize) || 1.25

      const inkOverhang = (px: number): number => {
        if (!probe) return 1
        probe.font = `${csText.fontWeight} ${px}px ${csText.fontFamily}`
        const m = probe.measureText(text)
        const lineBox = px * lineRatio
        const halfLeading = (lineBox - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2
        const overhang =
          halfLeading + m.fontBoundingBoxAscent + m.actualBoundingBoxDescent - lineBox
        // Never negative, and always leave a hairline so rounding cannot bite.
        return Math.max(0, overhang) + 1
      }

      /**
       * Largest size in [MIN_PX, MAX_PX] that fits, or null if even MIN_PX
       * overflows. Leaves `fontSize` set to whatever it tried last.
       */
      const search = (): number | null => {
        let lo = MIN_PX
        let hi = MAX_PX
        let found = false
        while (hi - lo > 0.5) {
          const mid = (lo + hi) / 2
          s.fontSize = `${mid}px`
          const fits =
            el.scrollWidth <= availW + 0.5 && el.scrollHeight + inkOverhang(mid) <= availH
          if (fits) {
            lo = mid
            found = true
          } else {
            hi = mid
          }
        }
        return found ? lo : null
      }

      // Pass 1: nothing may be split. `hyphens: none` also suppresses the
      // dictionary, so this is the same answer on every platform — it depends
      // only on whether the whole word fits, not on which hyphenation data the
      // browser happens to ship.
      s.hyphens = 'none'
      s.wordBreak = 'normal'
      s.overflowWrap = 'normal'
      const whole = search()

      if (whole === null || whole < WHOLE_WORD_FLOOR_PX) {
        // Pass 2: too small (or impossible) to keep words intact, so allow
        // hyphenation and, failing that, breaking. Restore the stylesheet's
        // rules first so the measurement matches how it will actually render.
        s.hyphens = prev.hyphens
        s.wordBreak = prev.wordBreak
        s.overflowWrap = prev.overflowWrap
        const split = search()
        // Nothing fits even at MIN_PX (one unbreakable token wider than the
        // cell): keep MIN_PX and let the stylesheet's overflow-wrap chop it.
        s.fontSize = `${split ?? MIN_PX}px`
      } else {
        s.fontSize = `${whole}px`
      }

      // Restore the constraints for normal rendering.
      s.maxHeight = prev.maxHeight
      s.overflow = prev.overflow
      s.hyphens = prev.hyphens
      s.wordBreak = prev.wordBreak
      s.overflowWrap = prev.overflowWrap
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
