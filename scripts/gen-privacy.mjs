#!/usr/bin/env node
/**
 * Renders the static privacy pages from privacy/POLICY.json.
 *
 *   yarn privacy
 *
 * Play Console needs a policy URL that is readable WITHOUT JavaScript: the
 * reviewer (and Google's crawler) may fetch it with scripting off, and a hash
 * route in a client-rendered app returns an empty page to them.
 *
 * So each language is a complete, self-contained HTML page:
 *
 *   /privacy/            English — the URL given to Play, and the fallback
 *   /privacy/<code>/     one per other language
 *
 * The entry page carries a small inline script that sends a visitor whose
 * browser asks for another language on to that language's page. It is a
 * redirect, not the content itself: with scripting off the reviewer still gets
 * the full English policy rather than an empty shell, which is the whole point
 * of shipping these statically. `DEFAULT_LOCALE` never redirects to itself,
 * and `?lang=` on any page pins the choice so a shared link stays put.
 *
 * Output: public/privacy/index.html + public/privacy/<code>/index.html
 * (copied into dist/ by the build).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES, DEFAULT_LOCALE } = await import(resolve(root, 'scripts/locales.mjs'));
const policy = JSON.parse(readFileSync(resolve(root, 'privacy/POLICY.json'), 'utf8'));

const esc = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const STYLE = `
  :root { color-scheme: dark light; }
  body {
    margin: 0 auto; padding: 24px 16px 64px; max-width: 46rem;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6; background: #0f0e1a; color: #ece9ff;
  }
  @media (prefers-color-scheme: light) { body { background: #f4f2fb; color: #1c1830; } }
  h1 { font-size: 1.6rem; }
  h2 { margin-top: 2rem; font-size: 1.25rem; }
  h3 { margin-bottom: .2rem; font-size: 1rem; }
  p { margin-top: .2rem; }
  .intro { font-weight: 600; }
  nav { margin-top: 2.5rem; opacity: .8; font-size: .9rem; line-height: 2; }
  nav b { font-weight: 600; opacity: .9; }
  a { color: #7c6cff; }
  footer { margin-top: 2rem; opacity: .7; font-size: .9rem; }
`.trim();

/**
 * Sends a visitor on to their own language's page.
 *
 * Only ever runs on the default-locale entry page, and only when the browser
 * actually asks for something else. `?lang=` (set on every cross-language
 * link) pins the choice, so following a link to the English page from, say,
 * the German one does not bounce straight back. `location.replace` keeps the
 * redirect out of the history, so Back leaves the site instead of landing on
 * a page that immediately redirects again.
 */
const redirectScript = (codes) => `
(function () {
  try {
    if (location.search.indexOf('lang=') !== -1) return;
    var known = ${JSON.stringify(codes)};
    var langs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) {
      var code = String(langs[i]).toLowerCase().split('-')[0];
      if (code === '${DEFAULT_LOCALE}') return;
      if (known.indexOf(code) !== -1) {
        location.replace('./' + code + '/' + location.hash);
        return;
      }
    }
  } catch (e) {
    /* Any failure just leaves the default-language page rendered. */
  }
})();
`.trim();

/**
 * Paths are written relative to the page doing the linking, so the whole
 * directory works unchanged from the web root, from a subdirectory, and from
 * `file://` — the entry page sits one level above the per-language ones, so
 * the two need different prefixes.
 */
const up = (isEntry) => (isEntry ? './' : '../');

/** The other languages, linked from the bottom of each page. */
const navFor = (current, isEntry) => {
  const base = up(isEntry);
  return LOCALES.map((l) => {
    const href =
      l.code === DEFAULT_LOCALE ? `${base}?lang=1` : `${base}${l.code}/?lang=1`;
    return l.code === current.code
      ? `<b>${esc(l.label)}</b>`
      : `<a href="${href}" lang="${l.code}" hreflang="${l.code}">${esc(l.label)}</a>`;
  }).join(' · ');
};

/** `<link rel="alternate">` for every language, so crawlers find them all. */
const alternatesFor = (isEntry) => {
  const base = up(isEntry);
  return LOCALES.map((l) => {
    const href = l.code === DEFAULT_LOCALE ? base : `${base}${l.code}/`;
    return `<link rel="alternate" hreflang="${l.code}" href="${href}">`;
  })
    .concat(`<link rel="alternate" hreflang="x-default" href="${base}">`)
    .join('\n');
};

const page = (locale, entry, { isEntry }) => `<!doctype html>
<html lang="${locale.code}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(entry.title)} — Quote Bingo</title>
<meta name="description" content="${esc(entry.intro)}">
${alternatesFor(isEntry)}
<style>
${STYLE}
</style>
${isEntry ? `<script>\n${redirectScript(LOCALES.map((l) => l.code))}\n</script>` : ''}
</head>
<body>
<h1>${esc(entry.title)}</h1>
<p class="intro">${esc(entry.intro)}</p>
${entry.sections.map((s) => `<h2>${esc(s.heading)}</h2>\n<p>${esc(s.body)}</p>`).join('\n')}
<nav>${navFor(locale, isEntry)}</nav>
<footer>
  <p>${esc(policy.updated)} · <a href="mailto:${esc(policy.contact)}">${esc(policy.contact)}</a></p>
  <p><a href="/">&larr; Quote Bingo</a></p>
</footer>
</body>
</html>
`;

const outRoot = resolve(root, 'public/privacy');
let written = 0;

for (const locale of LOCALES) {
  const entry = policy.locales[locale.code];
  if (!entry) continue;
  const isEntry = locale.code === DEFAULT_LOCALE;
  // The default locale is the URL Play points at, so it sits at /privacy/
  // itself rather than /privacy/en/.
  const dir = isEntry ? outRoot : resolve(outRoot, locale.code);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'index.html'), page(locale, entry, { isEntry }));
  written += 1;
}

console.log(`Wrote public/privacy/ (${written} pages, entry locale '${DEFAULT_LOCALE}')`);
