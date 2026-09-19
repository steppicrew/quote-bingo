#!/usr/bin/env node
/**
 * Captures Play Console screenshots for every supported language.
 *
 * Play wants 2–8 phone screenshots per language, each side 320–3840 px. We
 * render 1080x1920 (9:16) for phone and 1200x1920 for the 7-inch tablet slot.
 *
 *   yarn screenshots                 # all languages
 *   yarn screenshots --lang de,en    # a subset
 *   yarn screenshots --keep          # leave the preview server up
 *
 * People and quotes come from store-listing/SAMPLE-DATA.json, which is
 * committed so these images can be reproduced exactly.
 *
 * Output: assets/screenshots/<play-tag>/01-board.png …
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));
const SAMPLE = JSON.parse(
  readFileSync(resolve(root, 'store-listing/SAMPLE-DATA.json'), 'utf8'),
);

const PORT = 4319;
const BASE = `http://127.0.0.1:${PORT}/`;

const DEVICE_PROFILES = [
  { name: 'phone', width: 1080, height: 1920, scale: 3 },
  { name: 'tablet7', width: 1200, height: 1920, scale: 2 },
];

const argLang = process.argv.indexOf('--lang');
const only =
  argLang !== -1 ? new Set(process.argv[argLang + 1].split(',').map((s) => s.trim())) : null;
const targets = only ? LOCALES.filter((l) => only.has(l.code)) : LOCALES;

// --- state building --------------------------------------------------------
// Ids are derived from position rather than random, so a rerun produces the
// same board and the same screenshots.
const personId = (i) => `p${i + 1}`;
const quoteId = (p, q) => `p${p + 1}q${q + 1}`;

/**
 * Board size per person, so the set of screenshots shows the range the app
 * supports rather than three identical 5x5 grids. Index matches SAMPLE-DATA's
 * `people` order, and each size needs a pool to fill it: 24 / 16 / 8.
 */
const CARD_SIZES = [5, 4, 3];

/** The persisted slice, exactly as src/store.ts partializes it. */
function buildState(code, { checkedCells, activeIndex = 0, theme }) {
  const entry = SAMPLE.locales[code];
  const now = 1_700_000_000_000;

  const persons = entry.people.map((p, i) => ({
    id: personId(i),
    name: p.name,
    accent: p.accent,
    createdAt: now + i,
  }));

  const quotes = entry.people.flatMap((p, i) =>
    p.quotes.map((text, q) => ({
      id: quoteId(i, q),
      personId: personId(i),
      text,
      createdAt: now + q,
    })),
  );

  const cards = {};
  entry.people.forEach((p, i) => {
    const size = CARD_SIZES[i] ?? 5;
    // Only odd sizes can hold the free centre; 4x4 fills every cell.
    const joker = size % 2 === 1;
    const centre = joker ? Math.floor((size * size) / 2) : -1;

    const cells = [];
    for (let c = 0, q = 0; c < size * size; c += 1) {
      if (c === centre) cells.push(null);
      else cells.push(quoteId(i, q++));
    }
    const checked = cells.map((_, c) => c === centre);
    if (i === activeIndex) for (const c of checkedCells) checked[c] = true;

    cards[personId(i)] = {
      personId: personId(i),
      size,
      joker,
      cells,
      checked,
      createdAt: now,
    };
  });

  return {
    persons,
    quotes,
    cards,
    activePersonId: personId(activeIndex),
    theme,
    locale: code,
    soundMode: 'off',
    soundKind: 'tadaa',
  };
}

/**
 * Scenes.
 *
 * The win shot cannot be seeded: Game.tsx baselines its completed-line count
 * per card on entry, so a board that already has a full line renders gold
 * cells but fires no banner and no confetti. It has to be one tap short and
 * then actually tapped.
 */
const SCENES = [
  {
    file: '01-board',
    theme: 'dark',
    // A believable mid-game: a scatter, no completed line.
    state: (code) => buildState(code, { checkedCells: [0, 3, 6, 9, 13, 16, 21], theme: 'dark' }),
  },
  {
    file: '02-bingo',
    theme: 'dark',
    // Middle row (10..14) minus the last cell; 12 is the free centre.
    state: (code) => buildState(code, { checkedCells: [10, 11, 13, 2, 8, 20], theme: 'dark' }),
    async after(page) {
      // Tapping cell 14 completes the row and fires the celebration.
      await page.locator('.board .cell').nth(14).click();
      // Long enough for confetti to spread and the banner to be up, well
      // inside the 1800 ms the banner lives.
      await page.waitForTimeout(450);
    },
  },
  {
    // Person 2 on a 4x4 in their own colour: shows both the even board (no
    // free centre) and that each person's board recolours.
    file: '03-card-4x4',
    theme: 'dark',
    state: (code) =>
      buildState(code, { checkedCells: [0, 2, 5, 9, 10, 15], activeIndex: 1, theme: 'dark' }),
  },
  {
    // Person 3 on a 3x3, light theme, a third accent.
    file: '04-card-3x3',
    theme: 'light',
    state: (code) =>
      buildState(code, { checkedCells: [0, 2, 6], activeIndex: 2, theme: 'light' }),
  },
  {
    file: '05-people',
    theme: 'light',
    state: (code) => buildState(code, { checkedCells: [1, 5, 12, 18], theme: 'light' }),
    async after(page) {
      await page.goto(`${BASE}#/manage`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.content');
      await page.waitForTimeout(300);
    },
  },
  {
    file: '06-quotes',
    theme: 'light',
    state: (code) => buildState(code, { checkedCells: [0, 7, 11], theme: 'light' }),
    async after(page) {
      await page.goto(`${BASE}#/person/p1`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.content');
      await page.waitForTimeout(300);
    },
  },
];

// --- preview server --------------------------------------------------------
console.log('Starting preview server…');
const server = spawn(
  'yarn',
  ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { cwd: root, stdio: 'ignore' },
);

const shutdown = () => server.kill('SIGTERM');
process.on('exit', shutdown);
process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});

const deadline = Date.now() + 30_000;
for (;;) {
  try {
    const res = await fetch(BASE);
    if (res.ok) break;
  } catch {
    /* not up yet */
  }
  if (Date.now() > deadline) {
    console.error('Preview server did not start. Run `yarn build` first.');
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 300));
}

// --- capture ---------------------------------------------------------------
const browser = await chromium.launch();
let count = 0;

for (const locale of targets) {
  const outDir = resolve(root, 'assets/screenshots', locale.playStore);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const profile of DEVICE_PROFILES) {
    const context = await browser.newContext({
      ...devices['Pixel 7'],
      viewport: { width: profile.width / profile.scale, height: profile.height / profile.scale },
      deviceScaleFactor: profile.scale,
      locale: locale.code,
      isMobile: true,
      hasTouch: true,
      // The app reads its theme from the seeded store, but a matching OS
      // preference keeps 'system' consistent if a scene ever uses it.
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
    });

    for (const scene of SCENES) {
      const page = await context.newPage();

      // Seed IndexedDB before the app's first paint. The store persists to
      // db 'quote-bingo' / store 'keyval' / key 'quote-bingo-state' as one
      // JSON string; version 3 matches the current persist version, so the
      // migrations are skipped. Raw indexedDB here — the page has its own
      // copy of idb, but an init script cannot import it.
      await page.addInitScript(
        ({ state }) =>
          new Promise((done, failed) => {
            const open = indexedDB.open('quote-bingo', 1);
            open.onupgradeneeded = () => open.result.createObjectStore('keyval');
            open.onsuccess = () => {
              const tx = open.result.transaction('keyval', 'readwrite');
              tx.objectStore('keyval').put(
                JSON.stringify({ state, version: 3 }),
                'quote-bingo-state',
              );
              // Resolve on the TRANSACTION, not the request: the write is only
              // durable once the transaction commits, and the app's own
              // hydration races this otherwise.
              tx.oncomplete = () => done();
              tx.onerror = () => failed(tx.error);
            };
            open.onerror = () => failed(open.error);
          }),
        { state: scene.state(locale.code) },
      );

      await page.goto(BASE, { waitUntil: 'networkidle' });
      // The content area shows only a loading line until rehydration, so wait
      // for the board rather than for load.
      await page.waitForSelector('.board .cell', { timeout: 15_000 });
      // Cell text is auto-fitted by a binary search that measures at the final
      // wrap width; capturing mid-search catches half-sized type.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);

      if (scene.after) await scene.after(page);

      const suffix = profile.name === 'phone' ? '' : `-${profile.name}`;
      const file = resolve(outDir, `${scene.file}${suffix}.png`);
      await page.screenshot({ path: file });
      count += 1;
      await page.close();
    }

    await context.close();
  }

  console.log(`  ${locale.playStore}  ${SCENES.length * DEVICE_PROFILES.length} shots`);
}

await browser.close();
if (!process.argv.includes('--keep')) server.kill('SIGTERM');

console.log(`\n${count} screenshots in assets/screenshots/<lang>/.`);
