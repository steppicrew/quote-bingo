# Zitate-Bingo 🎲

A fully offline **Progressive Web App** for playing bingo with quotes people will
"probably say sooner or later". Build a pool of quotes per person, generate a bingo card,
and check off cells as the quotes actually get said.

No backend, no accounts — everything lives in your browser and works offline. Share and
merge quote lists with friends via **QR code** or **JSON file**.

## Features

- 📴 **Fully offline** — installable PWA, data stored in IndexedDB.
- 👥 **Per-person quote pools** — one bingo card per person, persistent across sessions.
- 🎨 **Per-person accent colour** — pick from a preset palette; the person's board recolours.
- 🎯 **Configurable card size** — 3×3 up to 7×7 (odd sizes can have a free centre).
- 🃏 **Optional joker** — toggle the free centre per card (needs one more quote when off).
- 🔀 **Reshuffle** cards on demand; checked cells and progress are saved.
- 🏆 **Spectacular wins** — confetti, a full-screen banner, board shake, a pulse on the
  freshly-completed line, and a selectable win sound (ta-daa / arpeggio / off, synthesised
  offline) with haptics. A full card gets a bigger, golden celebration.
- 🌍 **Multilingual UI** — German, English, French, Spanish (incl. the document title);
  follows the browser language by default (English fallback), selectable in Settings.
- 🌓 **Light / dark / system theme**.
- 📤 **Share & merge** — export/import quote lists as file or QR, with automatic
  de-duplication when merging.
- 📱 The phone Back button closes open dialogs instead of leaving the app.

## Development

Requires Node 20+ and Yarn 4 (via Corepack).

```sh
yarn install
git config core.hooksPath .githooks  # enable the auto version-bump hook (one-time)
yarn dev        # dev server
yarn build      # typecheck + production build -> dist/
yarn lint       # ESLint
yarn preview    # serve the production build (test PWA/offline)
```

A committed `pre-commit` hook (in `.githooks/`) bumps the patch version in
`package.json` on every commit. Enable it once per clone with the `git config`
line above.

## Tech

Vite · React 19 · TypeScript · Zustand · IndexedDB · vite-plugin-pwa · react-i18next · SCSS

See [CLAUDE.md](./CLAUDE.md) for architecture details.

## License

MIT
