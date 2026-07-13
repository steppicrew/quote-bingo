import { useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { useAutoFitText } from '../lib/useAutoFitText'

interface Props {
  text: string
  checked: boolean
  free: boolean
  win: boolean
  onClick: () => void
}

export function Cell({ text, checked, free, win, onClick }: Props): ReactNode {
  const btnRef = useRef<HTMLButtonElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  useAutoFitText(btnRef, textRef, text)

  return (
    <button
      ref={btnRef}
      className={clsx('cell', { checked, free, win })}
      onClick={() => !free && onClick()}
      disabled={free}
    >
      <span ref={textRef} className="cell-text">
        {text}
      </span>
    </button>
  )
}
