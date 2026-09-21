import { type CSSProperties } from 'react'
import { type AccentName } from '../types'

/** The CSS custom properties a person's accent overrides on their board. */
export interface AccentVars {
  '--primary': string
  '--primary-dim': string
  '--accent': string
}

// Each preset overrides the themeable accent vars. `default` is empty so the
// person falls back to the active light/dark theme. Values are chosen to read
// on both themes; the gold win-tile styling is intentionally independent.
//
// The presets are spread around the hue circle, and the set is deliberately
// SMALL. `default` is itself a purple (#7c6cff dark / #6a4bff light, ~247deg),
// so it competes with any violet-ish preset: the old palette had indigo at
// 239deg and violet at 258deg, i.e. 8deg and 11deg from the theme colour, and
// the three read as the same colour on a chip row. One purple is kept, pushed
// out to 271deg. Adding a sixth hue would mean squeezing another blue-green in
// beside sky/emerald and reintroducing exactly that problem — telling boards
// apart matters more than the length of the list.
export const ACCENTS: Record<Exclude<AccentName, 'default'>, AccentVars> = {
  amber: { '--primary': '#f59e0b', '--primary-dim': '#d97706', '--accent': '#fcd34d' },
  sky: { '--primary': '#0ea5e9', '--primary-dim': '#0284c7', '--accent': '#7dd3fc' },
  rose: { '--primary': '#f43f5e', '--primary-dim': '#e11d48', '--accent': '#fda4af' },
  emerald: { '--primary': '#10b981', '--primary-dim': '#059669', '--accent': '#6ee7b7' },
  purple: { '--primary': '#a855f7', '--primary-dim': '#9333ea', '--accent': '#d8b4fe' },
}

/**
 * Selectable accent names in picker order (default first).
 *
 * Same order as the handout below, so the swatch row reads as an even spread
 * of hues rather than grouping similar colours next to each other.
 */
export const ACCENT_NAMES: AccentName[] = ['default', 'amber', 'sky', 'rose', 'emerald', 'purple']

/**
 * Coerce a stored accent to one this build knows.
 *
 * Persisted state and imported backups predate the palette being spread out,
 * so they can hold `indigo` or `violet` — and an unknown name would index
 * ACCENTS as undefined and throw in `accentSwatch`. Both were purples, so both
 * map to the surviving purple. Anything unrecognised falls back to the theme.
 */
export function normalizeAccent(accent: string | undefined): AccentName {
  if (!accent) return 'default'
  if (accent === 'default' || accent in ACCENTS) return accent as AccentName
  if (accent === 'indigo' || accent === 'violet') return 'purple'
  return 'default'
}

/** Inline style overriding the accent vars, or undefined for the default theme. */
export function accentStyle(accent: AccentName | undefined): CSSProperties | undefined {
  const name = normalizeAccent(accent)
  if (name === 'default') return undefined
  return ACCENTS[name] as unknown as CSSProperties
}

/** A representative swatch colour for the picker chip. */
export function accentSwatch(accent: AccentName): string {
  const name = normalizeAccent(accent)
  if (name === 'default') return 'var(--primary)'
  return ACCENTS[name]['--primary']
}

/**
 * The real (non-default) presets, in the order they are handed out.
 * Derived from ACCENTS rather than filtered from ACCENT_NAMES so the type
 * stays non-optional under `noUncheckedIndexedAccess`.
 *
 * ACCENTS is declared in hue-spread order, so consecutive people get colours
 * from opposite sides of the circle. This matters most for person 2: they are
 * the first to receive a preset at all (person 1 keeps `default`), and the old
 * order handed them indigo — 8deg from the theme purple person 1 was wearing.
 * Amber now leads, 151deg away, the furthest any preset gets from `default`.
 */
const PALETTE = Object.keys(ACCENTS) as Exclude<AccentName, 'default'>[]

/**
 * Pick a colour for a new person: the first preset nobody is using yet.
 *
 * Telling boards apart at a glance is the whole point of the accent, so a new
 * person should not silently arrive in the same colour as an existing one.
 * Once every preset is taken the palette wraps by usage count, which keeps the
 * split as even as possible rather than piling everyone onto the first entry.
 */
export function nextAccent(existing: readonly { accent?: AccentName }[]): AccentName {
  const used = new Map<AccentName, number>()
  for (const person of existing) {
    // Through normalizeAccent so a legacy `violet` counts against `purple`
    // rather than as an unused preset, which would hand out a duplicate.
    const accent = normalizeAccent(person.accent)
    if (accent === 'default') continue
    used.set(accent, (used.get(accent) ?? 0) + 1)
  }

  let best: AccentName = 'default'
  let bestCount = Infinity
  for (const name of PALETTE) {
    const count = used.get(name) ?? 0
    if (count === 0) return name
    if (count < bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}
