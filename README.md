# Zitat-Bingo 🎲

A fully offline **Progressive Web App** for playing bingo with quotes people will
"probably say sooner or later". Build a pool of quotes per person, generate a bingo card,
and check off cells as the quotes actually get said.

No backend, no accounts — everything lives in your browser and works offline. Share and
merge quote lists with friends via **QR code** or **JSON file**.

## Features

- 📴 **Fully offline** — installable PWA, data stored in IndexedDB.
- 👥 **Per-person quote pools** — one bingo card per person, persistent across sessions.
- 🎯 **Configurable card size** — 3×3 up to 7×7 (odd sizes get a free centre).
- 🔀 **Reshuffle** cards on demand; checked cells and progress are saved.
- 🏆 Winning lines highlight with a celebration toast; play on for a full card.
- 📤 **Share & merge** — export/import quote lists as file or QR, with automatic
  de-duplication when merging.

## Development

Requires Node 20+ and Yarn 4 (via Corepack).

```sh
yarn install
yarn dev        # dev server
yarn build      # typecheck + production build -> dist/
yarn lint       # ESLint
yarn preview    # serve the production build (test PWA/offline)
```

## Tech

Vite · React 19 · TypeScript · Zustand · IndexedDB · vite-plugin-pwa · SCSS

See [CLAUDE.md](./CLAUDE.md) for architecture details.

## License

MIT
