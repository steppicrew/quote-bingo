import { useEffect, type ReactNode } from 'react'
import clsx from 'clsx'
import { useRoute, navigate } from './router'
import { useStore } from './store'
import { Manage } from './screens/Manage'
import { PersonEditor } from './screens/PersonEditor'
import { Game } from './screens/Game'
import { ToastProvider } from './components/Toast'
import './components/modal.scss'

export function App(): ReactNode {
  const route = useRoute()
  const hydrated = useStore((s) => s.hydrated)
  const hasPersons = useStore((s) => s.persons.length > 0)

  // First start (no data yet): send the user to Verwalten to set things up.
  useEffect(() => {
    if (hydrated && !hasPersons && route.name === 'game') {
      navigate({ name: 'manage' })
    }
  }, [hydrated, hasPersons, route.name])

  const tab: 'manage' | 'game' = route.name === 'game' ? 'game' : 'manage'

  return (
    <ToastProvider>
      <div className="app">
        <header className="topbar">
          <h1>Zitat-Bingo</h1>
          <div className="tabs">
            <button
              className={clsx({ active: tab === 'manage' })}
              onClick={() => navigate({ name: 'manage' })}
            >
              Verwalten
            </button>
            <button
              className={clsx({ active: tab === 'game' })}
              onClick={() => navigate({ name: 'game' })}
            >
              Spielen
            </button>
          </div>
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
      </div>
    </ToastProvider>
  )
}
