#!/usr/bin/env node
/**
 * Applies the Android application id across every place that hardcodes it, so
 * `cap sync` and Gradle cannot disagree.
 *
 *   yarn node scripts/sync-app-id.mjs           # apply
 *   yarn node scripts/sync-app-id.mjs --check    # print, change nothing
 *
 * Source of truth: ANDROID_APP_ID in the environment or .env, else whatever
 * capacitor.config.json already carries.
 *
 * The id is PERMANENT once published — Play will not let it change, and a new
 * id means a new listing with no reviews or installs.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const configPath = resolve(root, 'capacitor.config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

/** ANDROID_APP_ID from the environment, else a minimal .env parse. */
function fromEnv() {
  if (process.env.ANDROID_APP_ID) return process.env.ANDROID_APP_ID.trim();
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return null;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*ANDROID_APP_ID\s*=\s*(.*)$/.exec(line);
    if (m) {
      const value = m[1].trim().replace(/^["']|["']$/g, '');
      if (value) return value;
    }
  }
  return null;
}

const appId = fromEnv() ?? config.appId;

if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(appId)) {
  console.error(`Invalid application id: "${appId}"`);
  console.error('Expected reverse-DNS, lowercase, e.g. de.steppicrew.quotebingo');
  process.exit(1);
}

if (checkOnly) {
  console.log(appId);
  process.exit(0);
}

let changed = false;

/** Rewrite `file` with `fn`, reporting whether anything actually moved. */
function edit(relPath, fn) {
  const full = resolve(root, relPath);
  if (!existsSync(full)) return;
  const before = readFileSync(full, 'utf8');
  const after = fn(before);
  if (after !== before) {
    writeFileSync(full, after);
    console.log(`  updated ${relPath}`);
    changed = true;
  }
}

// 1. capacitor.config.json
if (config.appId !== appId) {
  config.appId = appId;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log('  updated capacitor.config.json');
  changed = true;
}

// 2. Gradle: both the namespace and the applicationId.
edit('android/app/build.gradle', (s) =>
  s
    .replace(/namespace\s+"[^"]+"/, `namespace "${appId}"`)
    .replace(/applicationId\s+"[^"]+"/, `applicationId "${appId}"`),
);

// 3. Capacitor's own string resources.
edit('android/app/src/main/res/values/strings.xml', (s) =>
  s
    .replace(
      /(<string name="package_name">)[^<]*(<\/string>)/,
      `$1${appId}$2`,
    )
    .replace(
      /(<string name="custom_url_scheme">)[^<]*(<\/string>)/,
      `$1${appId}$2`,
    ),
);

// 4. MainActivity.java: rewrite the package declaration and move the file into
//    the directory the package name requires, or javac rejects it.
const javaRoot = resolve(root, 'android/app/src/main/java');
const target = join(javaRoot, ...appId.split('.'));
if (existsSync(javaRoot)) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSafe(dir)) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'MainActivity.java') found.push(full);
    }
  };
  walk(javaRoot);

  for (const file of found) {
    const original = readFileSync(file, 'utf8');
    const src = original.replace(/^package\s+[\w.]+;/m, `package ${appId};`);
    const dest = join(target, 'MainActivity.java');
    if (file !== dest) {
      mkdirSync(target, { recursive: true });
      writeFileSync(dest, src);
      unlinkSync(file);
      pruneEmpty(dirname(file), javaRoot);
      console.log(`  moved MainActivity.java → ${appId.replace(/\./g, '/')}/`);
      changed = true;
    } else if (src !== original) {
      writeFileSync(file, src);
      console.log('  updated MainActivity.java');
      changed = true;
    }
  }
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Remove directories left empty after moving the source file out. */
function pruneEmpty(dir, stopAt) {
  let current = dir;
  while (current.startsWith(stopAt) && current !== stopAt) {
    try {
      rmdirSync(current);
    } catch {
      return;
    }
    current = dirname(current);
  }
}

console.log(changed ? `Application id: ${appId}` : `Application id already ${appId}`);
