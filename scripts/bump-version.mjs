#!/usr/bin/env node
/**
 * Moves `androidVersionCode` — the monotonic integer Play Console requires.
 *
 *   yarn version:bump            # versionCode + 1
 *   yarn version:bump --print    # read-only
 *   yarn version:bump --set 12   # force a specific code
 *
 * The semver `version` is NOT touched here: .githooks/pre-commit already bumps
 * the patch on every commit, and Gradle reads it as the Android versionName.
 * Adding a second writer would double-bump it.
 *
 * `androidVersionCode` deliberately does not derive from the semver — it only
 * ever moves forward. A rollback would make a derived code go backwards, and
 * Play rejects any code not strictly greater than the last one uploaded.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const args = process.argv.slice(2);

if (args.includes('--print')) {
  console.log(`${pkg.version} (versionCode ${pkg.androidVersionCode})`);
  process.exit(0);
}

const current = pkg.androidVersionCode ?? 0;
let next;

const setIndex = args.indexOf('--set');
if (setIndex !== -1) {
  next = Number(args[setIndex + 1]);
  if (!Number.isInteger(next) || next < 1) {
    console.error('--set needs a positive integer, e.g. --set 12');
    process.exit(1);
  }
  if (next <= current) {
    console.error(
      `Refusing to set versionCode ${next}: it must be greater than ${current}.\n` +
        'Play rejects a code that is not strictly increasing.',
    );
    process.exit(1);
  }
} else {
  next = current + 1;
}

pkg.androidVersionCode = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`versionCode ${current} → ${next}  (version ${pkg.version} unchanged)`);
