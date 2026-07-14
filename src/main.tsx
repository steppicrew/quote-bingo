import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './i18n'
import './styles/global.scss'

registerSW({ immediate: true })

// Set a sane default theme before first paint; the store overrides it with the
// persisted value once IndexedDB hydration completes.
document.documentElement.dataset.theme ??= 'system'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
