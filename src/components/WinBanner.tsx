import { useEffect, type ReactNode } from 'react'
import './WinBanner.scss'

interface Props {
  text: string
  big: boolean
  onDone: () => void
}

/**
 * Full-screen celebratory flash shown on a win. Auto-dismisses after a beat
 * (longer for a full card) and can be tapped away early.
 */
export function WinBanner({ text, big, onDone }: Props): ReactNode {
  useEffect(() => {
    const ms = big ? 2600 : 1800
    const id = window.setTimeout(onDone, ms)
    return () => window.clearTimeout(id)
  }, [big, onDone])

  return (
    <div className="win-banner" onClick={onDone} role="presentation">
      <div className={`win-banner__text${big ? ' big' : ''}`}>{text}</div>
    </div>
  )
}
