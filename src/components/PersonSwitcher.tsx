import { useEffect, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { type Person } from '../types'
import './PersonSwitcher.scss'

interface Props {
  persons: Person[]
  activeId: string | null
  onSelect: (id: string) => void
}

export function PersonSwitcher({ persons, activeId, onSelect }: Props): ReactNode {
  // The chip row scrolls horizontally, so a person selected elsewhere (a swipe
  // on the board) can sit off-screen. Keep the active chip in view.
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeId])

  return (
    <div className="switcher">
      {persons.map((p) => (
        <button
          key={p.id}
          ref={p.id === activeId ? activeRef : undefined}
          className={clsx('chip', { active: p.id === activeId })}
          onClick={() => onSelect(p.id)}
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}
