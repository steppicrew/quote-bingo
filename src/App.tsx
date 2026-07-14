import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useRoute, navigate } from './router'
import { useStore } from './store'
import { SUPPORTED_LNGS } from './i18n'
import { Manage } from './screens/Manage'
import { PersonEditor } from './screens/PersonEditor'
import { Game } from './screens/Game'
import { ToastProvider } from './components/Toast'
import { Settings } from './components/Settings'
import {
  BackIcon,
  CogIcon,
  GameIcon,
  SoundOffIcon,
  SoundOnIcon,
  SoundVibrateIcon,
  UsersIcon,
} from './components/icons'
import './components/modal.scss'

const soundModeLabelKey = {
  on: 'settings.soundOn',
  vibrate: 'settings.soundVibrate',
  off: 'settings.soundOff',
} as const

export function App(): ReactNode {
  const route = useRoute()
  const { t, i18n } = useTranslation()
  const hydrated = useStore((s) => s.hydrated)
  const hasPersons = useStore((s) => s.persons.length > 0)
  const theme = useStore((s) => s.theme)
  const locale = useStore((s) => s.locale)
  const soundMode = useStore((s) => s.soundMode)
  const cycleSoundMode = useStore((s) => s.cycleSoundMode)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Apply the selected theme to <html> (CSS custom properties switch on it).
  useEffect(() => {
    document.documentElement.dataset.theme = theme
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

  // First start (no data yet): send the user to Verwalten to set things up.
  useEffect(() => {
    if (hydrated && !hasPersons && route.name === 'game') {
      navigate({ name: 'manage' })
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
              onClick={() => navigate({ name: 'manage' })}
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
          <button
            className="icon-btn"
            aria-label={t('app.nav.sound', { state: t(soundModeLabelKey[soundMode]) })}
            title={t('app.nav.sound', { state: t(soundModeLabelKey[soundMode]) })}
            onClick={cycleSoundMode}
          >
            {soundMode === 'on' ? (
              <SoundOnIcon />
            ) : soundMode === 'vibrate' ? (
              <SoundVibrateIcon />
            ) : (
              <SoundOffIcon />
            )}
          </button>
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
