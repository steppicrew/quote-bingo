import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore, type Locale } from '../store'

const OPTIONS: Locale[] = ['system', 'de', 'en', 'fr', 'es', 'zh', 'ja']

export function LanguageToggle(): ReactNode {
  const { t } = useTranslation()
  const locale = useStore((s) => s.locale)
  const setLocale = useStore((s) => s.setLocale)

  return (
    <select
      aria-label={t('lang.label')}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
    >
      {OPTIONS.map((value) => (
        <option key={value} value={value}>
          {t(`lang.${value}`)}
        </option>
      ))}
    </select>
  )
}
