#!/usr/bin/env node
/**
 * Validates and exports the Play Console store listing.
 *
 * Writes one directory per language holding the three files Play Console asks
 * for, so each can be pasted (or picked up by scripts/play-publish.mjs):
 *
 *   store-listing/de-DE/title.txt
 *   store-listing/de-DE/short-description.txt
 *   store-listing/de-DE/full-description.txt
 *
 *   yarn store-listing           # validate + write files
 *   yarn store-listing --check   # validate only, non-zero exit on error
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

const LIMITS = { title: 30, short: 80, full: 4000 };

const { listings } = JSON.parse(
  readFileSync(resolve(root, 'store-listing/LISTINGS.json'), 'utf8'),
);

const checkOnly = process.argv.includes('--check');
let failed = false;

for (const locale of LOCALES) {
  const entry = listings[locale.code];
  if (!entry) {
    console.error(`✗ ${locale.playStore}: missing from LISTINGS.json`);
    failed = true;
    continue;
  }

  for (const field of ['title', 'short', 'full']) {
    if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
      console.error(`✗ ${locale.playStore}: ${field} is empty`);
      failed = true;
    }
  }
  if (failed) continue;

  // Count code points, not UTF-16 units: Play counts characters, so CJK and
  // emoji must count once rather than twice.
  const lengths = {
    title: [...entry.title].length,
    short: [...entry.short].length,
    full: [...entry.full].length,
  };

  const problems = Object.entries(LIMITS)
    .filter(([field, limit]) => lengths[field] > limit)
    .map(([field, limit]) => `${field} ${lengths[field]}/${limit}`);

  if (problems.length > 0) {
    console.error(`✗ ${locale.playStore}: ${problems.join(', ')}`);
    failed = true;
    continue;
  }

  console.log(
    `✓ ${locale.playStore.padEnd(6)} title ${String(lengths.title).padStart(2)}/30  ` +
      `short ${String(lengths.short).padStart(2)}/80  full ${String(lengths.full).padStart(4)}/4000`,
  );

  if (!checkOnly) {
    const dir = resolve(root, 'store-listing', locale.playStore);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'title.txt'), `${entry.title}\n`);
    writeFileSync(resolve(dir, 'short-description.txt'), `${entry.short}\n`);
    writeFileSync(resolve(dir, 'full-description.txt'), `${entry.full}\n`);
  }
}

if (failed) {
  console.error('\nFix the entries above in store-listing/LISTINGS.json.');
  process.exit(1);
}

console.log(
  checkOnly
    ? '\nAll listings within Play Console limits.'
    : `\nWrote ${LOCALES.length} listings to store-listing/<lang>/.`,
);
