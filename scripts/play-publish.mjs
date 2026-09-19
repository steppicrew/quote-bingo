#!/usr/bin/env node
/**
 * Publishes to Google Play: the .aab, every store listing, the icon, feature
 * graphics, screenshots and release notes — all the things otherwise typed by
 * hand into Play Console, nine times.
 *
 *   yarn play:publish --dry-run                 # show what would change
 *   yarn play:publish --track internal          # upload + roll out
 *   yarn play:publish --track production
 *   yarn play:publish --track production --draft  # REQUIRED for a first release
 *   yarn play:publish --listings-only           # metadata/images, no binary
 *   yarn play:publish --track production --rollout 0.1
 *   yarn play:publish --force                   # re-upload even if unchanged
 *
 * Everything happens inside ONE edit, committed at the very end, so a failure
 * part-way leaves the listing untouched rather than half updated.
 *
 * Auth: a Google Cloud service account with the "Release manager" role in Play
 * Console. Point PLAY_SERVICE_ACCOUNT_JSON at its key file (see .env.sample).
 *
 * NOTE: while this runs, do not save anything in Play Console. An edit is
 * optimistic-locked, so a concurrent change — including a draft the listing
 * editor autosaves as you type — rejects the commit.
 */
import { readFileSync, existsSync, createReadStream, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

// --- options ---------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const value = (n, fallback) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? fallback : argv[i + 1];
};

const dryRun = flag('dry-run');
const force = flag('force');
const listingsOnly = flag('listings-only');
const track = value('track', 'internal');
const rollout = Number(value('rollout', '0'));

// --- inputs ----------------------------------------------------------------
if (!existsSync(resolve(root, '.env'))) {
  console.error('No .env — copy .env.sample and fill in PLAY_SERVICE_ACCOUNT_JSON.');
  process.exit(1);
}
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
  const m = /^\s*([A-Z_]+)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const keyFile = process.env.PLAY_SERVICE_ACCOUNT_JSON;
if (!keyFile || !existsSync(keyFile)) {
  console.error(`PLAY_SERVICE_ACCOUNT_JSON is not set or missing: ${keyFile ?? '(unset)'}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const { listings } = JSON.parse(
  readFileSync(resolve(root, 'store-listing/LISTINGS.json'), 'utf8'),
);
const packageName = JSON.parse(
  readFileSync(resolve(root, 'capacitor.config.json'), 'utf8'),
).appId;

const aabPath = resolve(root, `build-output/quote-bingo-${pkg.version}.aab`);
if (!listingsOnly && !existsSync(aabPath)) {
  console.error(`Missing ${basename(aabPath)} — run \`yarn android:build\` first.`);
  process.exit(1);
}

/** Play's own naming for the image slots managed here. */
const IMAGE_TYPES = {
  icon: () => [resolve(root, 'assets/play/icon-512.png')],
  featureGraphic: (tag) => [resolve(root, `assets/play/${tag}/feature-graphic.png`)],
  phoneScreenshots: (tag) => shots(tag, (f) => !f.includes('-tablet')),
  sevenInchScreenshots: (tag) => shots(tag, (f) => f.includes('-tablet7')),
};

function shots(tag, filter) {
  const dir = resolve(root, 'assets/screenshots', tag);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.png') && filter(f))
    .sort()
    .map((f) => resolve(dir, f));
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

// --- retry -----------------------------------------------------------------
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(label, fn, attempts = 4) {
  let delay = 1000;
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (e) {
      const code = e?.code ?? e?.response?.status;
      if (!RETRYABLE.has(Number(code)) || i >= attempts) throw e;
      console.warn(`    ${label}: ${code}, retrying in ${delay}ms (${i}/${attempts - 1})`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

// --- auth ------------------------------------------------------------------
const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const play = google.androidpublisher({ version: 'v3', auth });

console.log(`Package:  ${packageName}`);
console.log(`Version:  ${pkg.version} (versionCode ${pkg.androidVersionCode})`);
console.log(`Track:    ${listingsOnly ? '(listings only)' : track}${rollout ? ` @ ${rollout * 100}%` : ''}`);
console.log(`Mode:     ${dryRun ? 'DRY RUN — nothing is sent' : 'LIVE'}`);
console.log();

// --- edit ------------------------------------------------------------------
let editId;
let changes = 0;

async function main() {
  const { data: edit } = await withRetry('insert', () =>
    play.edits.insert({ packageName }),
  );
  editId = edit.id;

  // 1. The bundle.
  if (!listingsOnly) {
    if (dryRun) {
      console.log(`Would upload ${basename(aabPath)} (${(statSync(aabPath).size / 1e6).toFixed(1)} MB)`);
      changes += 1;
    } else {
      console.log(`Uploading ${basename(aabPath)}…`);
      await withRetry('bundle', () =>
        play.edits.bundles.upload({
          packageName,
          editId,
          media: { mimeType: 'application/octet-stream', body: createReadStream(aabPath) },
        }),
      );
      changes += 1;
      console.log('  uploaded');
    }
  }

  // 2. Listings + images, per language.
  for (const locale of LOCALES) {
    const tag = locale.playStore;
    const entry = listings[locale.code];
    if (!entry) continue;

    const wanted = {
      title: entry.title,
      shortDescription: entry.short,
      fullDescription: entry.full,
    };

    let current = null;
    try {
      const { data } = await withRetry(`get ${tag}`, () =>
        play.edits.listings.get({ packageName, editId, language: tag }),
      );
      current = data;
    } catch {
      /* no listing yet */
    }

    const listingDiffers =
      force ||
      !current ||
      current.title !== wanted.title ||
      current.shortDescription !== wanted.shortDescription ||
      current.fullDescription !== wanted.fullDescription;

    if (listingDiffers) {
      if (!dryRun) {
        await withRetry(`listing ${tag}`, () =>
          play.edits.listings.update({
            packageName,
            editId,
            language: tag,
            requestBody: wanted,
          }),
        );
      }
      changes += 1;
      console.log(`${tag}  listing ${dryRun ? 'would be updated' : 'updated'}`);
    } else {
      console.log(`${tag}  listing unchanged`);
    }

    // Images: compare the whole ordered set by sha256, since order matters.
    for (const [type, filesFor] of Object.entries(IMAGE_TYPES)) {
      const files = filesFor(tag).filter(existsSync);
      if (!files.length) continue;

      let remote = [];
      try {
        const { data } = await withRetry(`images ${tag}/${type}`, () =>
          play.edits.images.list({ packageName, editId, language: tag, imageType: type }),
        );
        remote = data.images ?? [];
      } catch {
        /* none yet */
      }

      const localHashes = files.map(sha256);
      const remoteHashes = remote.map((i) => i.sha256);
      const same =
        !force &&
        localHashes.length === remoteHashes.length &&
        localHashes.every((h, i) => h === remoteHashes[i]);

      if (same) {
        console.log(`${tag}  ${type} unchanged (${files.length})`);
        continue;
      }

      if (dryRun) {
        console.log(`${tag}  ${type} would upload ${files.length}`);
        changes += 1;
        continue;
      }

      await withRetry(`deleteall ${tag}/${type}`, () =>
        play.edits.images.deleteall({ packageName, editId, language: tag, imageType: type }),
      );
      for (const file of files) {
        await withRetry(`upload ${basename(file)}`, () =>
          play.edits.images.upload({
            packageName,
            editId,
            language: tag,
            imageType: type,
            media: { mimeType: 'image/png', body: createReadStream(file) },
          }),
        );
        // Pace the uploads; Play throttles bursts as a generic 500.
        await sleep(250);
      }
      changes += 1;
      console.log(`${tag}  ${type} uploaded ${files.length}`);
    }
  }

  // 3. The release.
  if (!listingsOnly) {
    const releaseNotes = LOCALES.map((l) => ({
      language: l.playStore,
      text: listings[l.code]?.short ?? '',
    }));

    // An app that has never been published is a "draft app", and Play accepts
    // only draft releases on one — a `completed` release is rejected outright
    // with "Only releases with status draft may be created on draft app".
    // The first release therefore has to be created as a draft and rolled out
    // by hand from Play Console; every release after that can be completed.
    const status = flag('draft')
      ? 'draft'
      : rollout > 0 && rollout < 1
        ? 'inProgress'
        : 'completed';

    const release = {
      versionCodes: [String(pkg.androidVersionCode)],
      status,
      releaseNotes,
      ...(status === 'inProgress' ? { userFraction: rollout } : {}),
    };

    if (dryRun) {
      console.log(`\nWould set track "${track}" to versionCode ${pkg.androidVersionCode} (${release.status})`);
    } else {
      await withRetry('track', () =>
        play.edits.tracks.update({
          packageName,
          editId,
          track,
          requestBody: { track, releases: [release] },
        }),
      );
      console.log(`\nTrack "${track}" set to versionCode ${pkg.androidVersionCode}`);
    }
    changes += 1;
  }

  // 4. Commit — or abandon a no-op, since committing bumps the listing's
  //    modification date in Play Console for nothing.
  if (dryRun) {
    await play.edits.delete({ packageName, editId }).catch(() => {});
    console.log(`\nDry run — ${changes} change(s) would be made. Nothing was sent.`);
    return;
  }

  if (changes === 0) {
    await play.edits.delete({ packageName, editId }).catch(() => {});
    console.log('\nNothing changed — edit abandoned.');
    return;
  }

  await withRetry('commit', () => play.edits.commit({ packageName, editId }));
  console.log(`\nCommitted ${changes} change(s) to Play.`);
}

try {
  await main();
} catch (e) {
  const detail = e?.response?.data?.error?.message ?? e?.message ?? String(e);
  console.error(`\nFailed: ${detail}`);
  if (editId && !dryRun) {
    await play.edits.delete({ packageName, editId }).catch(() => {});
    console.error('Edit abandoned — the Play listing is unchanged.');
  }
  process.exit(1);
}
