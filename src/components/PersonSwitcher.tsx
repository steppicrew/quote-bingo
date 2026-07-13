import { type ReactNode } from 'react'
import clsx from 'clsx'
import { type Person } from '../types'
import './PersonSwitcher.scss'

interface Props {
  persons: Person[]
  activeId: string | null
  onSelect: (id: string) => void
}

export function PersonSwitcher({ persons, activeId, onSelect }: Props): ReactNode {
  return (
    <div className="switcher">
      {persons.map((p) => (
        <button
          key={p.id}
          className={clsx('chip', { active: p.id === activeId })}
          onClick={() => onSelect(p.id)}
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}
