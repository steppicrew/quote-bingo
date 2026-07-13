import { type ReactNode } from 'react'
import clsx from 'clsx'
import { useStore, type Theme } from '../store'
import './ThemeToggle.scss'

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'system', label: 'System' },
]

export function ThemeToggle(): ReactNode {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)

  return (
    <div className="theme-toggle" role="group" aria-label="Design">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          className={clsx('seg', { active: theme === o.value })}
          aria-pressed={theme === o.value}
          onClick={() => setTheme(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
