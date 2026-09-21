/** Zero-width space: a break opportunity that renders as nothing. */
const ZWSP = '​'

// A slash, or a run of them, with no surrounding space — "Wo/Wer",
// "Tach/Morgen", "Promoviert/produziert". A slash that already has a space
// beside it ("n*(n-1) / 2") can break there anyway and is left alone.
const TIGHT_SLASH = /(?<=[^\s/])(\/+)(?=[^\s/])/g

/**
 * Add invisible break opportunities so a cell can wrap where a reader expects.
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
  return text.replace(TIGHT_SLASH, `$1${ZWSP}`)
}
