import { useEffect, useState, type ReactNode } from 'react'
import './FitDebug.scss'

interface CellReport {
  text: string
  /** Font size the auto-fit settled on. */
  px: number
  /** Integer overflow, as the fit itself measures it. */
  intOverflow: number
  /** Sub-pixel overflow, which the integer measure rounds away. */
  subOverflow: number
  lines: number
}

interface Report {
  dpr: number
  viewport: string
  cell: string
  content: string
  lineHeight: string
  fontFamily: string
  metrics: string
  clipped: number
  total: number
  worst: CellReport[]
}

/**
 * On-screen read-out of what the text auto-fit actually did, for diagnosing a
 * device the developer cannot open a console on.
 *
 * Reached with `?debug=fit` and rendered nowhere else, so it costs normal users
 * nothing but a dead branch. It exists because cells clip on a phone and not on
 * any desktop viewport, and the numbers that would explain the difference —
 * device pixel ratio, the real sub-pixel overflow, what canvas reports for font
 * metrics — are only observable on the device itself.
 */
export function FitDebug(): ReactNode {
  const [report, setReport] = useState<Report | null>(null)

  useEffect(() => {
    // After the fit has run and settled (it retries across frames on a cold
    // start), sample the board.
    const id = window.setTimeout(() => {
      const texts = [...document.querySelectorAll<HTMLElement>('.cell-text')]
      const firstCell = document.querySelector<HTMLElement>('.cell')
      if (!texts.length || !firstCell) return

      const cellBox = firstCell.getBoundingClientRect()
      const firstText = texts[0]
      const cs = firstText ? getComputedStyle(firstText) : null

      // What canvas reports here, since that is what inkOverhang trusts.
      let metrics = 'n/a'
      try {
        const probe = document.createElement('canvas').getContext('2d')
        if (probe && cs) {
          probe.font = `${cs.fontWeight} 16px ${cs.fontFamily}`
          const m = probe.measureText('Fackelzug')
          metrics = `a${m.fontBoundingBoxAscent} d${m.fontBoundingBoxDescent} i${m.actualBoundingBoxDescent.toFixed(1)}`
        }
      } catch {
        metrics = 'blocked'
      }

      const rows: CellReport[] = texts.map((el) => {
        const px = parseFloat(getComputedStyle(el).fontSize)
        // The fit compares integer scrollHeight against the box. A fraction of
        // a pixel of ink can overflow without ever showing up there, so also
        // measure the sub-pixel height the element really occupies.
        const intOverflow = el.scrollHeight - el.clientHeight
        const rect = el.getBoundingClientRect()
        const subOverflow = el.scrollHeight - rect.height
        const lh = parseFloat(getComputedStyle(el).lineHeight) || px * 1.25
        return {
          text: (el.textContent ?? '').trim().slice(0, 18),
          px: Math.round(px * 10) / 10,
          intOverflow: Math.round(intOverflow * 100) / 100,
          subOverflow: Math.round(subOverflow * 100) / 100,
          lines: Math.round(el.scrollHeight / lh),
        }
      })

      const clipped = rows.filter((r) => r.intOverflow > 0.5 || r.subOverflow > 0.5)
      const contentBox = firstText?.getBoundingClientRect()

      setReport({
        dpr: window.devicePixelRatio,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        cell: `${Math.round(cellBox.width)}x${Math.round(cellBox.height)}`,
        content: contentBox ? `${Math.round(contentBox.width)}x${Math.round(contentBox.height)}` : '?',
        lineHeight: cs?.lineHeight ?? '?',
        fontFamily: (cs?.fontFamily ?? '?').split(',')[0] ?? '?',
        metrics,
        clipped: clipped.length,
        total: rows.length,
        // The cells closest to overflowing say most about where the fit is
        // losing the ink.
        worst: [...rows]
          .sort((a, b) => b.subOverflow - a.subOverflow || b.intOverflow - a.intOverflow)
          .slice(0, 5),
      })
    }, 1500)
    return () => window.clearTimeout(id)
  }, [])

  if (!report) return null

  return (
    <div className="fit-debug">
      <div>
        <b>dpr</b> {report.dpr} · <b>vw</b> {report.viewport}
      </div>
      <div>
        <b>cell</b> {report.cell} · <b>text</b> {report.content}
      </div>
      <div>
        <b>lh</b> {report.lineHeight} · <b>font</b> {report.fontFamily}
      </div>
      <div>
        <b>canvas</b> {report.metrics}
      </div>
      <div>
        <b>clipped</b> {report.clipped}/{report.total}
      </div>
      <table>
        <tbody>
          {report.worst.map((r, i) => (
            <tr key={i}>
              <td>{r.text}</td>
              <td>{r.px}px</td>
              <td>{r.lines}L</td>
              <td>{r.intOverflow}</td>
              <td>{r.subOverflow}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fit-debug-legend">text · size · lines · int-overflow · sub-overflow</div>
    </div>
  )
}
