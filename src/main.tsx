import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './i18n'
import './styles/global.scss'

// In the Android build everything is already packaged into the APK, so the
// service worker has nothing to fetch or cache — updates ship through Play
// instead, and letting a SW swap assets under a running game is pure risk.
// `scripts/build-android.sh` sets VITE_NATIVE=1, which drops vite-plugin-pwa
// from the config entirely — so `virtual:pwa-register` does not exist there
// and this import has to be dynamic, resolved only on the web build.
if (!import.meta.env.VITE_NATIVE) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}

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
