#!/usr/bin/env node
/**
 * Fails when the locale lists drift apart.
 *
 * The app's list lives in TypeScript (src/i18n/index.ts) and the scripts' list
 * in plain JS (scripts/locales.mjs) — duplicated on purpose, since the build
 * scripts cannot import TS. This checks they still agree, and that every
 * locale has a message catalogue and a store listing.
 *
 *   yarn check-locales
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

let failed = false;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failed = true;
};

// --- 1. scripts/locales.mjs vs src/i18n/index.ts ---------------------------
const i18nSrc = readFileSync(resolve(root, 'src/i18n/index.ts'), 'utf8');
const listMatch = /SUPPORTED_LNGS\s*=\s*\[([^\]]*)\]/.exec(i18nSrc);
if (!listMatch) {
  fail('could not find SUPPORTED_LNGS in src/i18n/index.ts');
} else {
  const appCodes = [...listMatch[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  const scriptCodes = LOCALES.map((l) => l.code);

  const missingInScripts = appCodes.filter((c) => !scriptCodes.includes(c));
  const missingInApp = scriptCodes.filter((c) => !appCodes.includes(c));

  if (missingInScripts.length) {
    fail(`in src/i18n/index.ts but not scripts/locales.mjs: ${missingInScripts.join(', ')}`);
  }
  if (missingInApp.length) {
    fail(`in scripts/locales.mjs but not src/i18n/index.ts: ${missingInApp.join(', ')}`);
  }
  if (!missingInScripts.length && !missingInApp.length) {
    console.log(`✓ locale lists agree (${scriptCodes.join(', ')})`);
  }
}

// --- 2. a message catalogue per locale, with matching keys -----------------
/** Every leaf key path, so a missing nested string is caught too. */
function keyPaths(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...keyPaths(v, path));
    else out.push(path);
  }
  return out;
}

// German is the source of truth for the UI strings.
const dePath = resolve(root, 'src/i18n/de.json');
const deKeys = new Set(keyPaths(JSON.parse(readFileSync(dePath, 'utf8'))));

for (const locale of LOCALES) {
  const file = resolve(root, `src/i18n/${locale.code}.json`);
  if (!existsSync(file)) {
    fail(`${locale.code}: src/i18n/${locale.code}.json is missing`);
    continue;
  }
  if (locale.code === 'de') continue;

  const keys = new Set(keyPaths(JSON.parse(readFileSync(file, 'utf8'))));
  // Plural suffixes legitimately differ: zh/ja/ko have no plural forms, so
  // they carry only `_other` where German has `_one` and `_other`.
  const base = (k) => k.replace(/_(one|other|zero|two|few|many)$/, '');
  const theirs = new Set([...keys].map(base));
  const missing = [...new Set([...deKeys].map(base))].filter((k) => !theirs.has(k));

  if (missing.length) {
    fail(`${locale.code}: missing ${missing.length} key(s): ${missing.slice(0, 5).join(', ')}`);
  }
}
if (!failed) console.log('✓ every locale has a complete message catalogue');

// --- 3. a store listing per locale ----------------------------------------
const { listings } = JSON.parse(
  readFileSync(resolve(root, 'store-listing/LISTINGS.json'), 'utf8'),
);
const missingListings = LOCALES.filter((l) => !listings[l.code]).map((l) => l.code);
if (missingListings.length) {
  fail(`no store listing for: ${missingListings.join(', ')}`);
} else {
  console.log('✓ every locale has a store listing');
}

if (failed) {
  console.error('\nAdding a language means touching src/i18n/index.ts, a');
  console.error('src/i18n/<code>.json catalogue, scripts/locales.mjs and');
  console.error('store-listing/LISTINGS.json.');
  process.exit(1);
}

console.log(`\n${LOCALES.length} locales, all consistent.`);
