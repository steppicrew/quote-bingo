import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore, type Locale } from '../store'

// Selectable languages (excluding 'system', which is always pinned first).
const LANGS: Locale[] = ['de', 'en', 'fr', 'es', 'it', 'pt', 'zh', 'ja', 'ko']

export function LanguageToggle(): ReactNode {
  const { t } = useTranslation()
  const locale = useStore((s) => s.locale)
  const setLocale = useStore((s) => s.setLocale)

  // Sort by native label (stable across UI language, since lang.* are native
  // names); keep 'system' first.
  const options = useMemo<Locale[]>(
    () => ['system', ...[...LANGS].sort((a, b) => t(`lang.${a}`).localeCompare(t(`lang.${b}`)))],
    [t],
  )

  return (
    <select
      aria-label={t('lang.label')}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
    >
      {options.map((value) => (
        <option key={value} value={value}>
          {t(`lang.${value}`)}
        </option>
      ))}
    </select>
  )
}
