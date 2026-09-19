/**
 * Shared staging for the Play screenshots: device profiles, the seeded state
 * and the scene list.
 *
 * Lives apart from scripts/screenshots.mjs so `yarn check-screenshots` can
 * replay exactly the same states it captures — a clipping check against
 * different data would prove nothing about the published images.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = JSON.parse(
  readFileSync(resolve(root, 'store-listing/SAMPLE-DATA.json'), 'utf8'),
);

export const BASE_PORT = 4319;

export const DEVICE_PROFILES = [
  { name: 'phone', width: 1080, height: 1920, scale: 3 },
  { name: 'tablet7', width: 1200, height: 1920, scale: 2 },
];

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
export function buildState(code, { checkedCells, activeIndex = 0, theme }) {
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
export const SCENES = [
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
    async after(page, base) {
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
    async after(page, base) {
      await page.goto(`${base}#/manage`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.content');
      await page.waitForTimeout(300);
    },
  },
  {
    file: '06-quotes',
    theme: 'light',
    state: (code) => buildState(code, { checkedCells: [0, 7, 11], theme: 'light' }),
    async after(page, base) {
      await page.goto(`${base}#/person/p1`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.content');
      await page.waitForTimeout(300);
    },
  },
];


/**
 * Runs in the page before first paint: writes the persisted slice straight
 * into IndexedDB (db `quote-bingo`, store `keyval`, key `quote-bingo-state`),
 * so nothing flashes empty and no click choreography is needed.
 *
 * Resolves on the TRANSACTION rather than the request — the write is only
 * durable once the transaction commits, and the app's hydration races it
 * otherwise. Raw indexedDB because an init script cannot import the app's idb.
 */
export const seedScript = ({ state }) =>
  new Promise((done, failed) => {
    const open = indexedDB.open('quote-bingo', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('keyval');
    open.onsuccess = () => {
      const tx = open.result.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put(
        JSON.stringify({ state, version: 3 }),
        'quote-bingo-state',
      );
      tx.oncomplete = () => done();
      tx.onerror = () => failed(tx.error);
    };
    open.onerror = () => failed(open.error);
  });
