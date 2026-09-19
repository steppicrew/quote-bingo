#!/usr/bin/env node
/**
 * Renders the Play Console feature graphic (1024x500, no alpha) per language.
 *
 *   yarn feature-graphic
 *
 * Composition: a tilted bingo card on the left with a completed gold line,
 * a speech bubble carrying that locale's hero quote, and the localised title
 * beneath. The quote is what sells the app, so it gets the most weight.
 *
 * Built as SVG and rasterised in one pass — ImageMagick's `-annotate` places
 * text by baseline and scales with `-density`, which makes multi-line layout
 * at a fixed canvas size far more fiddly than laying it out in SVG.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

const { listings } = JSON.parse(
  readFileSync(resolve(root, 'store-listing/LISTINGS.json'), 'utf8'),
);
const SAMPLE = JSON.parse(
  readFileSync(resolve(root, 'store-listing/SAMPLE-DATA.json'), 'utf8'),
);

const W = 1024;
const H = 500;

// The app's palette.
const BG_FROM = '#2a2560';
const BG_TO = '#0f0e1a';
const PRIMARY = '#7c6cff';
const GOLD = '#ffd166';
const TEXT = '#ece9ff';
const CARD_BG = '#1a1830';

/**
 * DejaVu has no CJK coverage and renders those glyphs blank rather than
 * failing, so name the Noto CJK face per language. Korean needs its own — it
 * is the one beercounter never had to handle.
 */
const FONTS = {
  zh: "'Noto Sans CJK SC'",
  ja: "'Noto Sans CJK JP'",
  ko: "'Noto Sans CJK KR'",
};
const defaultFont = "'DejaVu Sans'";

const esc = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Measured width of a string, in px, at a given size and face.
 *
 * Counting characters is not good enough: "Das haben wir schon" and
 * "immer so gemacht" have similar lengths but very different widths, and a
 * character budget overflowed the bubble and clipped a word off the canvas.
 * `magick label:` reports what the face will actually draw.
 */
const widthCache = new Map();
function textWidth(text, size, font) {
  const key = `${font}|${size}|${text}`;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  // Every string on this graphic is drawn bold, and bold is roughly 13% wider
  // than regular — measuring the regular face let the Italian title run off
  // the canvas. `-weight Bold` does not apply to the Noto CJK faces, so the
  // bold variant has to be named outright.
  const family = font.replace(/'/g, '').replace(/ /g, '-');
  const out = execFileSync('magick', [
    '-font', `${family}-Bold`,
    '-pointsize', String(size),
    `label:${text}`,
    '-format', '%w',
    'info:',
  ]).toString();
  const width = Number(out.trim());
  widthCache.set(key, width);
  return width;
}

/**
 * Wrap to a pixel budget. CJK has no spaces, so it may break between any two
 * characters; everything else breaks on words.
 */
function wrap(text, maxWidth, size, font, cjk) {
  const lines = [];
  let line = '';

  const units = cjk ? [...text] : text.split(' ');
  const join = (a, b) => (a ? (cjk ? a + b : `${a} ${b}`) : b);

  for (const unit of units) {
    const next = join(line, unit);
    if (line && textWidth(next, size, font) > maxWidth) {
      lines.push(line);
      line = unit;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shrink until the longest line fits, so a long quote never clips. */
function fitQuote(text, maxWidth, font, cjk) {
  for (let size = 46; size >= 26; size -= 2) {
    const lines = balance(wrap(text, maxWidth, size, font, cjk), maxWidth, size, font, cjk);
    if (lines.length <= 3 && lines.every((l) => textWidth(l, size, font) <= maxWidth)) {
      return { lines, size };
    }
  }
  return { lines: wrap(text, maxWidth, 26, font, cjk), size: 26 };
}

/**
 * Even out the line lengths.
 *
 * Greedy wrapping fills each line to the brim and leaves the remainder
 * stranded — the Japanese quote broke as 12 characters then a lone "ら". Retry
 * against progressively narrower budgets and keep the result that has the same
 * number of lines but a shorter longest line.
 */
function balance(lines, maxWidth, size, font, cjk) {
  if (lines.length < 2) return lines;
  let best = lines;
  const longest = (ls) => Math.max(...ls.map((l) => textWidth(l, size, font)));
  for (let shrink = 0.95; shrink >= 0.6; shrink -= 0.05) {
    const candidate = wrap(text_(lines, cjk), maxWidth * shrink, size, font, cjk);
    if (candidate.length === lines.length && longest(candidate) < longest(best)) {
      best = candidate;
    }
  }
  return best;
}

/** Rejoin wrapped lines back into the original string. */
const text_ = (lines, cjk) => (cjk ? lines.join('') : lines.join(' '));

/** The 5x5 card, tilted, with the middle row completed in gold. */
function cardSvg() {
  const cells = [];
  const n = 5;
  const size = 46;
  const gapPx = 7;
  const winRow = 2;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const x = c * (size + gapPx);
      const y = r * (size + gapPx);
      const isWin = r === winRow;
      // A few scattered ticks so the card looks played, not pristine.
      const ticked = isWin || (r === 0 && c === 1) || (r === 1 && c === 3) || (r === 4 && c === 0);
      const fill = isWin ? GOLD : ticked ? PRIMARY : CARD_BG;
      cells.push(
        `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="8" fill="${fill}" ` +
          `stroke="${isWin ? GOLD : PRIMARY}" stroke-opacity="${isWin ? 1 : 0.45}" stroke-width="2"/>`,
      );
      if (r === 2 && c === 2) {
        // Free centre: a star on the winning row.
        cells.push(
          `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="9" fill="${CARD_BG}" opacity="0.5"/>`,
        );
      }
    }
  }
  return cells.join('\n      ');
}

/** Confetti flecks, deterministic so reruns are byte-identical. */
function confetti() {
  const out = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const colours = [GOLD, PRIMARY, '#ff6b6b', '#3ddc97', TEXT];
  for (let i = 0; i < 28; i += 1) {
    const x = rand() * W;
    const y = rand() * H;
    const w = 6 + rand() * 7;
    const h = 3 + rand() * 4;
    const rot = rand() * 360;
    const fill = colours[Math.floor(rand() * colours.length)];
    // Keep flecks clear of the text column so nothing collides with a glyph.
    if (x > 380 && x < 980 && y > 150 && y < 400) continue;
    out.push(
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" ` +
        `rx="1.5" fill="${fill}" opacity="0.7" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`,
    );
  }
  return out.join('\n    ');
}

const outRoot = resolve(root, 'assets/play');

for (const locale of LOCALES) {
  const cjk = ['zh', 'ja', 'ko'].includes(locale.code);
  const font = FONTS[locale.code] ?? defaultFont;
  const title = listings[locale.code].title;
  const quote = SAMPLE.locales[locale.code].hero;

  // Bubble geometry first: the text is fitted to the space, not the other way
  // round, so nothing can run past the canvas edge.
  const bubbleX = 430;
  const bubbleY = 150;
  const bubbleW = 545;
  const padX = 34;
  const innerW = bubbleW - padX * 2;

  const { lines: quoteLines, size: quoteSize } = fitQuote(quote, innerW, font, cjk);
  const lineHeight = quoteSize * 1.3;
  const bubbleH = quoteLines.length * lineHeight + 56;

  const quoteText = quoteLines
    .map(
      (line, i) =>
        `<text x="${bubbleX + padX}" y="${bubbleY + 52 + i * lineHeight}" font-family="${font}" ` +
        `font-size="${quoteSize}" font-weight="bold" fill="${CARD_BG}">${esc(line)}</text>`,
    )
    .join('\n    ');

  // The title has to clear the right edge too — "Tombola delle Citazioni" is
  // more than twice the width of "名言ビンゴ".
  let titleSize = 52;
  while (titleSize > 30 && textWidth(title, titleSize, font) > W - bubbleX - 24) {
    titleSize -= 2;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG_FROM}"/>
      <stop offset="1" stop-color="${BG_TO}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g>
    ${confetti()}
  </g>

  <!-- Bingo card, tilted so it reads as an object rather than a table -->
  <g transform="translate(70 118) rotate(-7)">
    <rect x="-18" y="-18" width="301" height="301" rx="22" fill="${CARD_BG}" opacity="0.92"
          stroke="${PRIMARY}" stroke-opacity="0.5" stroke-width="2"/>
      ${cardSvg()}
  </g>

  <!-- Speech bubble carrying the hero quote -->
  <g>
    <rect x="${bubbleX}" y="${bubbleY}" width="${bubbleW}" height="${bubbleH}" rx="26" fill="${TEXT}"/>
    <path d="M ${bubbleX + 4} ${bubbleY + bubbleH - 54}
             l -34 30 l 44 -6 Z" fill="${TEXT}"/>
    ${quoteText}
  </g>

  <text x="${bubbleX}" y="${bubbleY + bubbleH + 74}" font-family="${font}" font-size="${titleSize}"
        font-weight="bold" fill="${TEXT}">${esc(title)}</text>
</svg>
`;

  const dir = resolve(outRoot, locale.playStore);
  mkdirSync(dir, { recursive: true });
  const svgPath = resolve(dir, 'feature-graphic.svg');
  const pngPath = resolve(dir, 'feature-graphic.png');
  writeFileSync(svgPath, svg);

  execFileSync('magick', [
    '-background', 'none',
    '-density', '192',
    svgPath,
    '-resize', `${W}x${H}!`,
    // Play rejects a feature graphic with an alpha channel.
    '-flatten',
    '-alpha', 'remove',
    '-alpha', 'off',
    '-define', 'png:color-type=2',
    '-strip',
    '-define', 'png:exclude-chunk=time',
    pngPath,
  ]);
  rmSync(svgPath);

  console.log(`  ${locale.playStore}  ${title} — “${quote}”`);
}

console.log(`\n${LOCALES.length} feature graphics in assets/play/<lang>/.`);
