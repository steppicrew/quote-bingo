import { useEffect, useState, type ReactNode } from 'react'
import { useRoute, navigate } from './router'
import { useStore } from './store'
import { Manage } from './screens/Manage'
import { PersonEditor } from './screens/PersonEditor'
import { Game } from './screens/Game'
import { ToastProvider } from './components/Toast'
import { Settings } from './components/Settings'
import { CogIcon, GameIcon, UsersIcon } from './components/icons'
import './components/modal.scss'

export function App(): ReactNode {
  const route = useRoute()
  const hydrated = useStore((s) => s.hydrated)
  const hasPersons = useStore((s) => s.persons.length > 0)
  const theme = useStore((s) => s.theme)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Apply the selected theme to <html> (CSS custom properties switch on it).
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

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
          <h1>Zitat-Bingo</h1>
          {onGame ? (
            <button
              className="icon-btn"
              aria-label="Verwalten"
              title="Verwalten"
              onClick={() => navigate({ name: 'manage' })}
            >
              <UsersIcon />
            </button>
          ) : (
            <button
              className="icon-btn"
              aria-label="Spielen"
              title="Spielen"
              onClick={() => navigate({ name: 'game' })}
            >
              <GameIcon />
            </button>
          )}
          <button
            className="icon-btn"
            aria-label="Einstellungen"
            title="Einstellungen"
            onClick={() => setSettingsOpen(true)}
          >
            <CogIcon />
          </button>
        </header>

        {!hydrated ? (
          <div className="content">
            <p className="dim">Wird geladen…</p>
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
