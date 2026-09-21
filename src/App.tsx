import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useRoute, navigate, replaceRoute } from './router'
import { useStore } from './store'
import { SUPPORTED_LNGS } from './i18n'
import { Manage } from './screens/Manage'
import { Privacy } from './screens/Privacy'
import { PersonEditor } from './screens/PersonEditor'
import { Game } from './screens/Game'
import { ToastProvider } from './components/Toast'
import { SoundToggle } from './components/SoundToggle'
import { Settings } from './components/Settings'
import { applySystemBars } from './lib/systemBars'
import { BackIcon, CogIcon, GameIcon, UsersIcon } from './components/icons'
import './components/modal.scss'

export function App(): ReactNode {
  const route = useRoute()
  const { t, i18n } = useTranslation()
  const hydrated = useStore((s) => s.hydrated)
  const hasPersons = useStore((s) => s.persons.length > 0)
  const theme = useStore((s) => s.theme)
  const locale = useStore((s) => s.locale)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Apply the selected theme to <html> (CSS custom properties switch on it),
  // and keep Android's system bars legible against it. On 'system' the OS can
  // flip underneath us, so follow prefers-color-scheme for as long as that is
  // the selection.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    void applySystemBars(theme)

    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = (): void => void applySystemBars(theme)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  // Apply the selected UI language. 'system' defers to the browser's language
  // (i18next's detector picked it at init); an explicit code overrides it.
  useEffect(() => {
    const resolved =
      locale === 'system'
        ? SUPPORTED_LNGS.find((l) => (navigator.language || 'en').startsWith(l)) ?? 'en'
        : locale
    void i18n.changeLanguage(resolved)
    document.documentElement.lang = resolved
  }, [locale, i18n])

  // Keep the document title localized. Depends on i18n.language so it updates
  // after changeLanguage resolves, not just on the locale setting.
  useEffect(() => {
    document.title = t('app.title')
  }, [t, i18n.language])

  // First start (no data yet): send the user to Verwalten to set things up.
  // A replace, not a push: the user did not ask to go anywhere, so leaving #/
  // behind the Back button would only bounce them straight back here.
  useEffect(() => {
    if (hydrated && !hasPersons && route.name === 'game') {
      replaceRoute({ name: 'manage' })
    }
  }, [hydrated, hasPersons, route.name])

  const onGame = route.name === 'game'

  return (
    <ToastProvider>
      <div className="app">
        <header className="topbar">
          <h1>{t('app.title')}</h1>
          {route.name === 'person' ? (
            <button
              className="icon-btn"
              aria-label={t('app.nav.back')}
              title={t('app.nav.back')}
              // Going up a level, so replace: pushing would leave the person
              // screen in front of Back, and Back would walk forward into it.
              onClick={() => replaceRoute({ name: 'manage' })}
            >
              <BackIcon />
            </button>
          ) : onGame ? (
            <button
              className="icon-btn"
              aria-label={t('app.nav.manage')}
              title={t('app.nav.manage')}
              onClick={() => navigate({ name: 'manage' })}
            >
              <UsersIcon />
            </button>
          ) : (
            <button
              className="icon-btn"
              aria-label={t('app.nav.play')}
              title={t('app.nav.play')}
              onClick={() => navigate({ name: 'game' })}
            >
              <GameIcon />
            </button>
          )}
          {onGame && <SoundToggle />}
          <button
            className="icon-btn"
            aria-label={t('app.nav.settings')}
            title={t('app.nav.settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <CogIcon />
          </button>
        </header>

        {!hydrated ? (
          <div className="content">
            <p className="dim">{t('app.loading')}</p>
          </div>
        ) : route.name === 'person' ? (
          <PersonEditor id={route.id} />
        ) : route.name === 'privacy' ? (
          <Privacy />
        ) : route.name === 'game' ? (
          <Game />
        ) : (
          <Manage />
        )}

        {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      </div>
    </ToastProvider>
  )
}
