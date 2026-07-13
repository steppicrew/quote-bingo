import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'],
      manifest: {
        name: 'Zitat-Bingo',
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
      },
      devOptions: {
        // Serve a real manifest + SW in `yarn dev` so the browser stops
        // parsing index.html as the manifest (Line 1 syntax error).
        enabled: true,
        // Dev-only SW precaches nothing (no built assets in dev-dist yet);
        // silence the "glob doesn't match any files" warning.
        suppressWarnings: true,
      },
    }),
  ],
})
