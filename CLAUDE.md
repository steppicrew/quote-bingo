# Quote Bingo (Zitate-Bingo)

Fully offline PWA. Build bingo cards from quotes people will "probably say sooner or
later", then check cells in game mode as they get said. No backend — all state lives in
the browser (IndexedDB). Share/merge quote lists via QR code or JSON file. UI is
localized (de/en/fr/es) via react-i18next; the German build name is "Zitate-Bingo".

## Stack

- Vite 7 + React 19 (functional components only) + TypeScript strict.
- **Zustand** (`src/store.ts`) for all global state, persisted to **IndexedDB** via the
  `persist` middleware with an idb-backed storage adapter (`src/lib/db.ts`).
- **vite-plugin-pwa** (Workbox) for service worker, manifest, offline caching, install.
- **qrcode** (generate) + **html5-qrcode** (scan). Share payload = JSON → gzip
  (`CompressionStream`) → base64url.
- **react-i18next** (`src/i18n/`) for UI strings; locale JSON bundled statically so
  Workbox precaches all languages (offline-safe).
- Plain JSX + SCSS (no component library). `clsx` for conditional classNames.
- Yarn 4, node-modules linker (`.yarnrc.yml`).

## Commands

- `yarn dev` — dev server (PWA enabled in dev via `devOptions`).
- `yarn build` — `tsc -b` typecheck + `vite build` → `dist/`.
- `yarn lint` — ESLint (flat config, type-checked rules). Must be clean before commit.
- `yarn preview` — serve the production build locally (test PWA/offline here).
- `./deploy.sh` — build + rsync `dist/` to the web host. **Not committed** (gitignored).

## Architecture

- **Data model** (`src/types.ts`): `Person`, `Quote` (text only), `Card` (per-person,
  persistent, holds `size` + `joker` + `cells` + `checked`). Helpers take joker into
  account: `quotesNeeded(size, joker)`, `centerIndex(size, joker)`,
  `freeCenterActive(size, joker)`; `hasFreeCenter(size)` is the pure odd-size check.
- **Card logic** (`src/lib/card.ts`): `generateCard(personId, ids, size, joker)`
  (Fisher–Yates; free centre only when `joker && odd size`),
  `linesFor`/`winningCells`/`completedLineCount`, `isFullCard`.
- **i18n** (`src/i18n/index.ts` + `{de,en,fr,es}.json`): `de` is the source of truth.
  Store `locale` ('system'|de|en|fr|es) drives `i18n.changeLanguage` from `App`;
  'system' follows `navigator.language`, **falling back to English** (`fallbackLng: 'en'`).
- **Modal dismissal** (`src/lib/useModalDismiss.ts`): phone Back button + Escape close
  modals via a pushed history entry. Note the module-level `suppressNextPop` guard — the
  cleanup's async `history.back()` popstate must not be read as a user Back under
  StrictMode. Used by `Settings`, `QrShow`, `QrScan`.
- **Share** (`src/lib/share.ts`): `encodeList`/`decodeList` (gzip+base64url for QR),
  `exportToFile`/`importFromFile` (JSON), `mergeQuotes` (dedupe by trimmed, lowercased
  text). Import merges into a person matched by name (case-insensitive), else creates one.
- **Install** (`src/lib/install.ts`): captures `beforeinstallprompt` at module load,
  `useInstall()` exposes `canInstall` + `promptInstall`. Hidden when already standalone.
- **Routing** (`src/router.ts`): hash-based. Default route `#/` = **Spielen** (game).
  `#/manage` = Verwalten, `#/person/:id` = quote editor. First start with no persons
  redirects to Verwalten (`src/App.tsx`).
- **Screens**: `Game`, `Manage`, `PersonEditor`. **Components**: `BingoBoard`, `Cell`,
  `PersonSwitcher`, `QrShow`, `QrScan` (both lazy-loaded), `Toast`, `ThemeToggle`,
  `LanguageToggle`, `Settings`.

## Card sizes

Configurable **per person**, 3–7 (default 5). Odd sizes can keep a free centre (the
**joker**, toggleable per card in Game); even sizes always fill every cell. With the
joker on, quotes needed: 3×3=8, 4×4=16, 5×5=24, 6×6=36, 7×7=48 — turning the joker off
adds one (the centre becomes a real cell). Size selector offers only sizes the pool can
fill (joker-on threshold); the joker checkbox is disabled when the pool can't cover the
joker-off requirement.

## Conventions

- `yarn lint` + `yarn build` both clean before any commit — no warnings.
- `noUncheckedIndexedAccess` is on: array/record access is `T | undefined`. Handle it.
- **All user-facing strings go through `t()`** (react-i18next). Add new keys to every
  locale in `src/i18n/*.json`; `de` is authored first. Use count/interpolation keys for
  plurals and variables — no manual ternaries or template concatenation.
- Zustand persist is at **version 2**: `migrate` drops legacy cards lacking `size` (v0→v1)
  and defaults `joker: true` on cards lacking the flag (v1→v2). Persisted slice also
  carries `theme` + `locale`.
- A committed `pre-commit` hook (`.githooks/pre-commit`) bumps the patch version in
  `package.json` on every commit. Enable per clone: `git config core.hooksPath .githooks`.
- Win celebration (toast + `confetti` from `src/lib/confetti.ts`) fires from a
  `useEffect` in `Game`. Track the previous completed-line count **per card id** in a
  ref — resetting to 0 replays past wins on game entry / person switch.
