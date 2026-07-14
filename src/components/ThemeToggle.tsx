import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useStore, type Theme } from '../store'
import './ThemeToggle.scss'

const OPTIONS: Theme[] = ['light', 'dark', 'system']

export function ThemeToggle(): ReactNode {
  const { t } = useTranslation()
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)

  return (
    <div className="theme-toggle" role="group" aria-label={t('theme.label')}>
      {OPTIONS.map((value) => (
        <button
          key={value}
          className={clsx('seg', { active: theme === value })}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
        >
          {t(`theme.${value}`)}
        </button>
      ))}
    </div>
  )
}
