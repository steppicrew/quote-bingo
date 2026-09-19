import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import clsx from 'clsx'
import { type Person } from '../types'
import { accentSwatch } from '../lib/accents'
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
          // Each chip carries its person's own colour, so an inactive chip can
          // show a faded version of it — otherwise you only learn someone's
          // colour by selecting them.
          style={{ '--chip': accentSwatch(p.accent ?? 'default') } as CSSProperties}
          onClick={() => onSelect(p.id)}
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}
