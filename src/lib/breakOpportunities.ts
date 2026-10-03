/** Zero-width space: a break opportunity that renders as nothing. */
const ZWSP = '​'

// A slash, or a run of them, with no surrounding space — "Wo/Wer",
// "Tach/Morgen", "Promoviert/produziert". A slash that already has a space
// beside it ("n*(n-1) / 2") can break there anyway and is left alone.
const TIGHT_SLASH = /(?<=[^\s/])(\/+)(?=[^\s/])/g

/** Three periods, as an ellipsis is usually typed. */
const TYPED_ELLIPSIS = /\.{3}/g

/**
 * The quote as it is displayed: an ellipsis typed as "..." becomes "…".
 *
 * Partly typography — one glyph, tighter than three periods, so a cell fits
 * it a little larger — and partly line breaking: Chrome will not hyphenate a
 * word with "..." glued to its front, so "...vollkommen" stayed one token wider
 * than its cell and `word-break` chopped it as "...vollko|mmen", with no
 * hyphen. In front of "…" the hyphenator sees the word.
 *
 * Display only, for the same reason as the break opportunities below.
 */
export function displayText(text: string): string {
  return text.replace(TYPED_ELLIPSIS, '…')
}

/**
 * The cell's text: `displayText`, plus invisible break opportunities so it
 * wraps where a reader expects.
 *
 * Chrome does not offer a line break after "/" in a tight compound: "Wo/Wer"
 * needs its full width on one line, and "Tach/Morgen" 84px where breaking
 * after the slash needs only 34px. `hyphens: auto` does not help — the
 * dictionary sees one token. So a zero-width space goes AFTER the slash,
 * which both keeps the slash on the first line (as German typography wants)
 * and adds no glyph, no width and no change to the copied text.
 *
 * Render-time only. The store, exports, the QR payload and `mergeQuotes`'
 * text matching all keep the original string — a ZWSP baked into the data
 * would make two visually identical quotes compare unequal.
 */
export function withBreakOpportunities(text: string): string {
  return displayText(text).replace(TIGHT_SLASH, `$1${ZWSP}`)
}
