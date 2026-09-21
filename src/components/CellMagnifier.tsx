import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './CellMagnifier.scss'

interface Props {
  text: string
  /** Viewport rect of the cell being magnified. */
  rect: DOMRect
  checked: boolean
}

/** Gap between the cell and the bubble. */
const OFFSET = 12
/** Keep the bubble this far from the viewport edges. */
const MARGIN = 8

/**
 * The floating read-out shown while a cell is long-pressed.
 *
 * Rendered in a portal on `body` rather than inside the cell: the board clips
 * its overflow (for the person-switch slide) and the cells are a grid, so a
 * bubble parented to a cell would be cut off at the board edge — exactly at
 * the edges where it most needs to escape.
 *
 * It sits above the cell when there is room and below otherwise, so the
 * finger — which is on the cell — never covers the text it just asked to read.
 */
export function CellMagnifier({ text, rect, checked }: Props): ReactNode {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Measure the bubble, then place it. Layout effect so the first paint is
  // already in the right spot instead of jumping.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const above = rect.top - OFFSET - height
    const below = rect.bottom + OFFSET
    const top = above >= MARGIN ? above : Math.min(below, window.innerHeight - height - MARGIN)
    const centred = rect.left + rect.width / 2 - width / 2
    const left = Math.max(MARGIN, Math.min(centred, window.innerWidth - width - MARGIN))
    setPos({ left, top })
  }, [rect, text])

  return createPortal(
    <div
      ref={ref}
      className="cell-magnifier"
      role="tooltip"
      style={{
        // Rendered offscreen for the first frame so its size can be measured
        // without the unpositioned bubble flashing at the top-left corner.
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {checked && <span className="cell-magnifier-check" aria-hidden="true" />}
      <span className="cell-magnifier-text">{text}</span>
    </div>,
    document.body,
  )
}
