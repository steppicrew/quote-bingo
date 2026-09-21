import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

/**
 * The Android build packages the whole app into the APK, so there is nothing
 * for a service worker to cache and no update to fetch — Play ships new
 * versions instead. Emitting one anyway would leave `sw.js` + `workbox-*.js`
 * dead inside the APK, and a registration left over from a previous install
 * could still find and run them. `scripts/build-android.sh` sets VITE_NATIVE=1
 * so the plugin is dropped entirely for that build; the web PWA is unchanged.
 */
const native = process.env.VITE_NATIVE === '1'

const pwa = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'],
  manifest: {
    name: 'Zitate-Bingo',
    short_name: 'Bingo',
    description: 'Offline-Bingo mit Zitaten, die andere sicher bald sagen werden.',
    lang: 'de',
    id: '/',
    scope: '/',
    theme_color: '#1e1b4b',
    background_color: '#0f0e1a',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    // /privacy/ is static HTML, not part of the SPA. Without this the
    // navigation fallback answers any request under it that misses the
    // precache — a query string is enough to miss — with the app shell, so
    // the policy URL Play points at would render the game instead.
    navigateFallbackDenylist: [/^\/privacy\//],
  },
  devOptions: {
    // Serve a real manifest + SW in `yarn dev` so the browser stops
    // parsing index.html as the manifest (Line 1 syntax error).
    enabled: true,
    // Dev-only SW precaches nothing (no built assets in dev-dist yet);
    // silence the "glob doesn't match any files" warning.
    suppressWarnings: true,
  },
})

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs so the same build works from the web root and from
  // Capacitor's WebView, which serves the bundle from https://localhost/.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), ...(native ? [] : [pwa])],
})
