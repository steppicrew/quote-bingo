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
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));
const PORT = 4319;
const BASE = `http://127.0.0.1:${PORT}/`;

const { SCENES, DEVICE_PROFILES, seedScript } = await import(
  resolve(root, 'scripts/screenshot-scenes.mjs')
);

const argLang = process.argv.indexOf('--lang');
const only =
  argLang !== -1 ? new Set(process.argv[argLang + 1].split(',').map((s) => s.trim())) : null;
const targets = only ? LOCALES.filter((l) => only.has(l.code)) : LOCALES;

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
      await page.addInitScript(seedScript, { state: scene.state(locale.code) });

      await page.goto(BASE, { waitUntil: 'networkidle' });
      // The content area shows only a loading line until rehydration, so wait
      // for the board rather than for load.
      await page.waitForSelector('.board .cell', { timeout: 15_000 });
      // Cell text is auto-fitted by a binary search that measures at the final
      // wrap width; capturing mid-search catches half-sized type.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);

      if (scene.after) await scene.after(page, BASE);

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
