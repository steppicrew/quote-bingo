import { useMemo, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { useAutoFitText } from '../lib/useAutoFitText'
import { withBreakOpportunities } from '../lib/breakOpportunities'

interface Props {
  text: string
  checked: boolean
  free: boolean
  win: boolean
  pulse: boolean
  onClick: () => void
}

export function Cell({ text, checked, free, win, pulse, onClick }: Props): ReactNode {
  const btnRef = useRef<HTMLButtonElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  // Measured and rendered as the same string: the auto-fit re-runs on `text`
  // changes and wraps at the break opportunities, so feeding it the raw text
  // would size the cell for a wrap that never happens.
  const wrappable = useMemo(() => withBreakOpportunities(text), [text])
  useAutoFitText(btnRef, textRef, wrappable)

  return (
    <button
      ref={btnRef}
      className={clsx('cell', { checked, free, win, pulse })}
      onClick={() => !free && onClick()}
      disabled={free}
    >
      <span ref={textRef} className="cell-text">
        {wrappable}
      </span>
    </button>
  )
}
