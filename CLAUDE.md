# Quote Bingo (Zitat-Bingo)

Fully offline PWA. Build bingo cards from quotes people will "probably say sooner or
later", then check cells in game mode as they get said. No backend — all state lives in
the browser (IndexedDB). Share/merge quote lists via QR code or JSON file. UI is German.

## Stack

- Vite 7 + React 19 (functional components only) + TypeScript strict.
- **Zustand** (`src/store.ts`) for all global state, persisted to **IndexedDB** via the
  `persist` middleware with an idb-backed storage adapter (`src/lib/db.ts`).
- **vite-plugin-pwa** (Workbox) for service worker, manifest, offline caching, install.
- **qrcode** (generate) + **html5-qrcode** (scan). Share payload = JSON → gzip
  (`CompressionStream`) → base64url.
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
  persistent, holds `size` + `cells` + `checked`). Helpers `quotesNeeded(size)`,
  `centerIndex(size)`, `hasFreeCenter(size)`.
- **Card logic** (`src/lib/card.ts`): `generateCard` (Fisher–Yates, free centre on odd
  sizes only), `linesFor`/`winningCells`/`completedLineCount`, `isFullCard`.
- **Share** (`src/lib/share.ts`): `encodeList`/`decodeList` (gzip+base64url for QR),
  `exportToFile`/`importFromFile` (JSON), `mergeQuotes` (dedupe by trimmed, lowercased
  text). Import merges into a person matched by name (case-insensitive), else creates one.
- **Install** (`src/lib/install.ts`): captures `beforeinstallprompt` at module load,
  `useInstall()` exposes `canInstall` + `promptInstall`. Hidden when already standalone.
- **Routing** (`src/router.ts`): hash-based. Default route `#/` = **Spielen** (game).
  `#/manage` = Verwalten, `#/person/:id` = quote editor. First start with no persons
  redirects to Verwalten (`src/App.tsx`).
- **Screens**: `Game`, `Manage`, `PersonEditor`. **Components**: `BingoBoard`, `Cell`,
  `PersonSwitcher`, `QrShow`, `QrScan` (both lazy-loaded), `Toast`.

## Card sizes

Configurable **per person**, 3–7 (default 5). Odd sizes keep a free centre; even sizes
fill every cell. Quotes needed: 3×3=8, 4×4=16, 5×5=24, 6×6=36, 7×7=48. Size selector in
Game offers only sizes the pool can fill.

## Conventions

- `yarn lint` + `yarn build` both clean before any commit — no warnings.
- `noUncheckedIndexedAccess` is on: array/record access is `T | undefined`. Handle it.
- All user-facing strings are German.
- Zustand persist has a `migrate` (version 1) that drops legacy cards lacking `size`.
- Win celebration (toast + `confetti` from `src/lib/confetti.ts`) fires from a
  `useEffect` in `Game`. Track the previous completed-line count **per card id** in a
  ref — resetting to 0 replays past wins on game entry / person switch.
