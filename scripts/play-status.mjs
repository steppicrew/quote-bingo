#!/usr/bin/env node
/**
 * Read-only look at what Google Play holds: every track with its releases and
 * versionCodes, so a build can be numbered before it is uploaded — Play rejects
 * a versionCode that is not strictly greater, and says so only at upload.
 *
 *   yarn play:status
 *
 * Opens an edit, lists the tracks and DELETES the edit without committing, so
 * nothing changes. It cannot show review state: a release under review still
 * reads `completed` here (that is the intended rollout, not Play's verdict) —
 * review state lives only in Play Console.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const keyFile = process.env.PLAY_SERVICE_ACCOUNT_JSON;
if (!keyFile || !existsSync(keyFile)) {
  console.error(`PLAY_SERVICE_ACCOUNT_JSON is not set or missing: ${keyFile ?? '(unset)'}`);
  process.exit(1);
}
const packageName = JSON.parse(
  readFileSync(resolve(root, 'capacitor.config.json'), 'utf8'),
).appId;
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const play = google.androidpublisher({ version: 'v3', auth });

const { data: edit } = await play.edits.insert({ packageName });
try {
  const { data } = await play.edits.tracks.list({ packageName, editId: edit.id });
  let highest = 0;
  console.log(`Package: ${packageName}`);
  for (const t of data.tracks ?? []) {
    for (const r of t.releases ?? []) {
      const codes = (r.versionCodes ?? []).map(Number);
      highest = Math.max(highest, ...codes);
      console.log(`  ${t.track.padEnd(12)} ${String(r.status).padEnd(11)} ${r.name ?? ''}  codes ${codes.join(',') || '-'}`);
    }
  }
  // Every bundle ever uploaded holds its versionCode, on a track or not — an
  // aborted publish can burn a code this way.
  const { data: bundles } = await play.edits.bundles.list({ packageName, editId: edit.id });
  const uploaded = (bundles.bundles ?? []).map((b) => b.versionCode).sort((a, b) => a - b);
  console.log(`  uploaded bundles: ${uploaded.join(',') || '-'}`);
  highest = Math.max(highest, ...uploaded);
  console.log(`Highest versionCode used: ${highest}`);
  console.log(`package.json androidVersionCode: ${pkg.androidVersionCode}` +
    (pkg.androidVersionCode > highest ? '  (ok, greater)' : '  -> run yarn version:bump'));
} finally {
  await play.edits.delete({ packageName, editId: edit.id });
}
