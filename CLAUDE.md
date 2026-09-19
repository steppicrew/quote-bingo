# Quote Bingo (Zitate-Bingo)

Fully offline PWA. Build bingo cards from quotes people will "probably say sooner or
later", then check cells in game mode as they get said. No backend — all state lives in
the browser (IndexedDB). Share/merge quote lists via QR code or JSON file. UI is
localized (de/en/fr/es/it/pt/zh/ja/ko) via react-i18next; the German build name is
"Zitate-Bingo".

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
- `yarn assets` — icons, splashes and localised launcher labels from one SVG.
- `yarn store-listing` / `yarn check-locales` — validate + export the Play listing.
- `yarn screenshots` / `yarn feature-graphic` / `yarn privacy` — generate store art and the policy page.
- `yarn version:bump` — move `androidVersionCode` (the pre-commit hook does NOT).
- `yarn android:build [apk|debug]` — signed `.aab`/`.apk` into `build-output/`.
- `yarn play:publish --dry-run | --track production` — upload to Play.

## Android / Google Play

Shipped as `de.steppicrew.quotebingo`; Capacitor 7 packages the same `dist/` the
website uses, so there is no second codebase.

- **Toolchain.** API 37 needs **AGP 8.13 + Gradle 8.13**: the SDK installs the
  platform as `android-37.0` (sdk_full naming) and AGP 8.7 — Capacitor's default
  — resolves neither `android-37` nor `"android-37.0"`, failing in a way that
  reads as a missing SDK. `build-android.sh` also pins a JDK 17/21 because the
  system default here is 8.
- **Permissions.** `CAMERA` only, for QR scanning. `INTERNET` is stripped with
  `tools:node="remove"`, so "works offline, no tracking" is enforced by the
  platform rather than promised in the listing.
- **No service worker in the native build.** `VITE_NATIVE=1` drops
  vite-plugin-pwa from the config entirely, so the APK carries no `sw.js`,
  workbox chunk or manifest — updates ship through Play, and a stale
  registration has nothing to find.
- **System bars** (`src/lib/systemBars.ts` + `SystemBarsPlugin.java`). From
  Android 15 edge-to-edge is mandatory and `navigationBarColor` is ignored, so
  bar-icon contrast must be set at runtime from the in-app theme — no resource
  qualifier can see a theme chosen inside the app. `@capacitor/status-bar` has
  no navigation-bar API, hence the local plugin. The layout consumes
  `env(safe-area-inset-*)`; without it the WebView draws under the status bar.
- **Versioning.** `package.json` owns both numbers and Gradle reads them. The
  pre-commit hook bumps the *semver* on every commit; `androidVersionCode` only
  moves via `yarn version:bump`, and Play rejects anything not strictly greater.
  Build last — committing after a build leaves the `.aab` filename stale.
- **Publishing.** One edit, committed at the end, abandoned on failure. Unchanged
  images (sha256) and listings are skipped. A **first** release must be
  `--draft`; Play refuses a `completed` release on a never-published app. Do not
  leave Play Console open on an editing screen while it runs — the edit is
  optimistic-locked.

## Store assets

Generated from committed sources in all nine languages; `yarn check-locales`
fails when they drift.

- `store-listing/LISTINGS.json` — title/short/full per locale.
- `store-listing/SAMPLE-DATA.json` — **committed on purpose**: the people and
  quotes staged in the screenshots. Without it a rerun deals a different board
  and silently changes every image in the listing. Quotes are written per
  locale, not translated — the joke only lands if they are things that culture
  actually says on repeat.
- `privacy/POLICY.json` — one source for the in-app `#/privacy` screen and the
  static `/privacy/` page Play links to, so the two cannot drift.
- All PNGs are written with `-strip -define png:exclude-chunk=time`; without it
  an unchanged master re-renders under a new sha256 and the publisher
  re-uploads everything.
- The win screenshot **cannot be seeded**: `Game.tsx` baselines its
  completed-line count per card on entry, so a pre-completed line renders gold
  cells with no banner. It is seeded one tap short and then tapped.

## Architecture

- **Data model** (`src/types.ts`): `Person` (optional `accent?: AccentName`), `Quote`
  (text only), `Card` (per-person, persistent, holds `size` + `joker` + `cells` +
  `checked`). Helpers take joker into account: `quotesNeeded(size, joker)`,
  `centerIndex(size, joker)`, `freeCenterActive(size, joker)`; `hasFreeCenter(size)` is
  the pure odd-size check.
- **Per-person accent** (`src/lib/accents.ts`): a preset palette (`ACCENTS`,
  indigo/rose/emerald/amber/sky/violet + `default`). `accentStyle(name)` returns the
  `--primary`/`--primary-dim`/`--accent` overrides, applied inline to the Game `.content`
  so the active person's board recolours. Picked via swatches in `PersonEditor`; the gold
  win-tile styling is intentionally accent-independent.
- **Card logic** (`src/lib/card.ts`): `generateCard(personId, ids, size, joker)`
  (Fisher–Yates; free centre only when `joker && odd size`),
  `linesFor`/`winningCells`/`completedLineCount`, `isFullCard`.
- **Board sizing + text auto-fit** (`BingoBoard.tsx`, `useAutoFitText.ts`): the board must
  be a **square** grid. CSS `aspect-ratio:1` is **not** reliable here — the grid's tall
  wrapped-text content overrode it (cells rendered tall+narrow, e.g. 62×164, so words wrapped
  per-character). Fix: a `ResizeObserver` in `BingoBoard` sets the board's `height` equal to
  its width in JS, and tracks are `minmax(0,1fr)` (plain `1fr` = `minmax(auto,1fr)`, whose
  `auto` min uses content height). `.cell-text` renders at `width:100%`; `useAutoFitText`
  binary-searches the largest font that fits, measuring at that same wrap width with
  `max-height`/`overflow` lifted so `scrollHeight` reports true overflow (else it clamps).
  Retries across frames for slow standalone-PWA cold starts; refits on RO + `fonts.ready`.
  **The line box is not the ink box.** `line-height` tighter than the font's own
  line box leaves a last-line descender painting below what `scrollHeight`
  reports, and `.cell-text` clamps with `overflow: hidden` — which sliced the g
  in "gemacht" on every odd-sized card. `line-height: 1.25` gives the ink room;
  the fit reads that value from computed style and asks the font for its real
  ink descent, so changing it in the stylesheet cannot desynchronise the
  measurement. Tuning the search instead of the box is the wrong fix (tried
  twice).
- **i18n** (`src/i18n/index.ts` + `{de,en,fr,es,it,pt,zh,ja,ko}.json`): `de` is the source
  of truth. Store `locale` ('system'|de|en|fr|es|it|pt|zh|ja|ko) drives
  `i18n.changeLanguage` from `App`; 'system' follows `navigator.language`, **falling back to
  English** (`fallbackLng: 'en'`). zh/ja/ko have no plural forms — use `_other` keys only.
  The font stack in `global.scss` includes common CJK system fonts (no bundled webfont) so
  they render without tofu. `LanguageToggle` sorts entries by native label with 'system'
  pinned first.
  `App` also sets `document.title` from `app.title` (keyed on `i18n.language` so it updates
  after the language resolves); `index.html` holds the pre-JS fallback "Zitate-Bingo".
- **Modal dismissal** (`src/lib/useModalDismiss.ts`): phone Back button + Escape close
  modals via a pushed history entry. Note the module-level `suppressNextPop` guard — the
  cleanup's async `history.back()` popstate must not be read as a user Back under
  StrictMode. Used by `Settings`, `QrShow`, `QrScan`.
- **Share** (`src/lib/share.ts`): `encodeList`/`decodeList` (gzip+base64url for QR),
  `exportToFile`/`importFromFile` (JSON). Payload is **v2** — `QuoteListExport` carries a
  stable **id per quote** (`{id,text}[]`); v1 (text-only `string[]`) payloads are still
  accepted and normalised with fresh ids. `mergeQuotes` reconciles **by id then text**: an
  id match updates the text in place (id kept, so card cells stay valid), a new id with an
  existing text is skipped, an edit that collides with another existing text is skipped
  (no duplicate), and genuinely new quotes are appended — returning `{added, updated,
  skipped}`. `store.importList` applies this, preserving existing quote ids; import merges
  into a person matched by name (case-insensitive), else creates one.
- **Quote ids are short** (`src/lib/id.ts`, `uid()` = 8-char base36). Ids only need to be
  unique within a person's small quote pool; full UUIDs bloated the QR payload (36 chars
  each, often > all quote text combined) and defeated gzip (random UUID = max entropy).
  Short ids cut the payload ~40% with zero behaviour change (ids are opaque strings
  everywhere — `mergeQuotes`, card `cells`, `deleteQuote`). Persist v2→v3 remints old UUIDs
  (see version note below).
- **Multi-QR chunking** (`chunkCode`/`parseChunk`/`joinChunks` in `share.ts`): even with
  short ids a list can exceed `QR_MAX_CHARS` (800) — Jens's 31 quotes ≈ 1090 chars = 2
  codes. `chunkCode` returns a single **bare** code when it fits (back-compatible with old
  scanners), else numbered `QB1.<group>.<idx>.<total>.<body>` envelopes (`.` is a safe
  separator — never in base64url; `group` = random 4-char base36 to associate a scan set).
  `QrShow` paginates chunks with auto-advance + manual prev/next + progress dots; `QrScan`
  detects the envelope, collects bodies into an `index→body` map (order-independent, deduped),
  shows `N/total`, and reassembles + `decodeList`s once every index is present. A plain
  (prefix-less) scan still decodes directly. The share payload keeps ids (edit-tracking
  intact) — dropping ids from the wire would fit Jens in one QR but lose cross-device edit
  propagation, so it was rejected.
- **Quote deletion** (`store.deleteQuote`): removes the quote and, on the owner's card,
  swaps only that quote's cell(s) for an unused quote (resetting those cells to unchecked),
  leaving every other cell + its checked state intact; no spare quote → cell left as-is.
- **Full backup** (`exportBackup`/`parseBackup`/`importBackupFile` in `share.ts`,
  `store.backupData`/`store.restoreBackup`): "Export all"/"Import all" in Settings save the
  whole persisted slice (persons+accents, quotes+ids, cards+checked, theme/locale/sound) to
  a `BackupFile` JSON (`app:'quote-bingo-backup'`, version 1). Import **replaces** all state
  after a confirm; settings are re-validated against their unions on restore. The
  `Theme`/`Locale`/`SoundMode`/`SoundKind` unions live in `types.ts` (so `BackupData` is
  typed with literals, no circular import); `store.ts` and `fanfare.ts` re-export them.
  Both export buttons ("Export file" in `PersonEditor`, "Export all" in `Settings`) fire a
  confirmation toast — the browser's own download notification is too subtle and users
  double-tapped.
- **Swipe to switch person** (`src/lib/useSwipe.ts`, used by `Game`): a horizontal
  swipe on the board steps through `persons` (wrapping both ends); the incoming
  `BingoBoard` slides in from the side it came from (`slideFrom` prop → `.slide-next`/
  `.slide-prev`, honouring `prefers-reduced-motion`) and `PersonSwitcher` scrolls the
  active chip into view since selection now changes from outside the chip row. The
  gesture sits on a `.board-swipe` wrapper, **not** `.content`, so the size `<select>`
  and the chip row's own horizontal scroll are untouched. Two details matter: the cells
  are buttons, so once travel passes the threshold the gesture latches as a swipe and
  the trailing click is cancelled in the **capture phase** (`onClickCapture`) before it
  reaches the cell; and `touch-action: pan-y` on the wrapper leaves vertical scrolling
  to the browser. A drag only counts when it is past `THRESHOLD` (60px) **and**
  `DOMINANCE` (1.4×) more horizontal than vertical, so diagonal scroll flicks don't
  switch person. `Game`'s per-card-id `prevLines` baseline already makes a swap silent
  (no replayed win).
- **Install** (`src/lib/install.ts`): captures `beforeinstallprompt` at module load,
  `useInstall()` exposes `canInstall` + `promptInstall`. Hidden when already standalone.
- **Win effects**: `confetti` (`src/lib/confetti.ts`, canvas, `{ intensity, gold }`),
  `playFanfare(mode, kind, big, times)` (`src/lib/fanfare.ts`, dependency-free Web Audio
  synth). Two orthogonal persisted settings: `soundMode` (`'on'|'vibrate'|'off'` — off is
  silent, vibrate is haptics-only, on plays audio + haptics; nav-bar icon cycles it, and
  the web can't read the phone's silent switch so this is the manual opt-out) and
  `soundKind` (`'tadaa'|'arpeggio'`, the fanfare used when on). `times` repeats the
  fanfare per completed line (double/triple bingo). `WinBanner` (full-screen flash) and a
  scoped cell pulse: `winningCellsThrough(size, checked, index)` in `card.ts` returns only
  the lines the last-tapped cell completed, so the pulse animates that line, not every
  winning line. All effects honour
  `prefers-reduced-motion`.
- **Routing** (`src/router.ts`): hash-based. Default route `#/` = **Spielen** (game).
  `#/manage` = Verwalten, `#/person/:id` = quote editor. First start with no persons
  redirects to Verwalten (`src/App.tsx`).
- **Screens**: `Game`, `Manage`, `PersonEditor`. **Components**: `BingoBoard`, `Cell`,
  `PersonSwitcher`, `QrShow`, `QrScan` (both lazy-loaded), `Toast`, `ThemeToggle`,
  `LanguageToggle`, `WinBanner`, `Settings`.

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
- Zustand persist is at **version 3**: `migrate` drops legacy cards lacking `size` (v0→v1),
  defaults `joker: true` on cards lacking the flag (v1→v2), and remints every quote id from
  the old UUID to a short base36 id, rewriting matching card `cells` through the same
  old→new map in place (v2→v3; `checked[]` is index-aligned so untouched, free-centre
  `null`s kept). Persisted slice also carries `theme`, `locale`, `soundMode`, `soundKind`.
- A committed `pre-commit` hook (`.githooks/pre-commit`) bumps the patch version in
  `package.json` on every commit. Enable per clone: `git config core.hooksPath .githooks`.
- Win celebration fires from a `useEffect` in `Game` on a newly completed line. Track the
  previous completed-line count **per card id** in a ref — resetting to 0 replays past
  wins on game entry / person switch. The tapped index is captured in `lastToggledRef` at
  click time so the effect can pulse only the line it completed (`winningCellsThrough`).
