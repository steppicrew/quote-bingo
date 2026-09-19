#!/usr/bin/env node
/**
 * Renders the static privacy pages from privacy/POLICY.json.
 *
 *   yarn privacy
 *
 * Play Console needs a policy URL that is readable WITHOUT JavaScript: the
 * reviewer (and Google's crawler) may fetch it with scripting off, and a hash
 * route in a client-rendered app returns an empty page to them. So the policy
 * also ships as plain HTML at /privacy/, with every language on the one page
 * so a single URL serves all nine.
 *
 * Output: public/privacy/index.html (copied into dist/ by the build).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));
const policy = JSON.parse(readFileSync(resolve(root, 'privacy/POLICY.json'), 'utf8'));

const esc = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const sections = LOCALES.map((locale) => {
  const entry = policy.locales[locale.code];
  if (!entry) return '';
  return `
<section lang="${locale.code}" id="${locale.code}">
  <h2>${esc(entry.title)} <span class="lang">${esc(locale.label)}</span></h2>
  <p class="intro">${esc(entry.intro)}</p>
  ${entry.sections
    .map((s) => `<h3>${esc(s.heading)}</h3>\n  <p>${esc(s.body)}</p>`)
    .join('\n  ')}
</section>`;
}).join('\n');

const nav = LOCALES.map(
  (l) => `<a href="#${l.code}">${esc(l.label)}</a>`,
).join(' · ');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quote Bingo — Privacy / Datenschutz</title>
<meta name="description" content="Quote Bingo collects no data. No accounts, no ads, no tracking, no analytics.">
<style>
  :root { color-scheme: dark light; }
  body {
    margin: 0 auto; padding: 24px 16px 64px; max-width: 46rem;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6; background: #0f0e1a; color: #ece9ff;
  }
  @media (prefers-color-scheme: light) { body { background: #f4f2fb; color: #1c1830; } }
  h1 { font-size: 1.6rem; }
  h2 { margin-top: 2.5rem; font-size: 1.25rem; }
  h3 { margin-bottom: .2rem; font-size: 1rem; }
  p { margin-top: .2rem; }
  .lang { font-weight: 400; opacity: .6; font-size: .9rem; }
  .intro { font-weight: 600; }
  nav { opacity: .8; font-size: .9rem; line-height: 2; }
  a { color: #7c6cff; }
  footer { margin-top: 3rem; opacity: .7; font-size: .9rem; }
</style>
</head>
<body>
<h1>Quote Bingo · Zitate-Bingo</h1>
<nav>${nav}</nav>
${sections}
<footer>
  <p>Last updated: ${esc(policy.updated)} · <a href="mailto:${esc(policy.contact)}">${esc(policy.contact)}</a></p>
  <p><a href="/">&larr; Quote Bingo</a></p>
</footer>
</body>
</html>
`;

const outDir = resolve(root, 'public/privacy');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'index.html'), html);

console.log(`Wrote public/privacy/index.html (${LOCALES.length} languages, ${html.length} bytes)`);
