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
export const ACCENTS: Record<Exclude<AccentName, 'default'>, AccentVars> = {
  indigo: { '--primary': '#6366f1', '--primary-dim': '#4f46e5', '--accent': '#a5b4fc' },
  rose: { '--primary': '#f43f5e', '--primary-dim': '#e11d48', '--accent': '#fda4af' },
  emerald: { '--primary': '#10b981', '--primary-dim': '#059669', '--accent': '#6ee7b7' },
  amber: { '--primary': '#f59e0b', '--primary-dim': '#d97706', '--accent': '#fcd34d' },
  sky: { '--primary': '#0ea5e9', '--primary-dim': '#0284c7', '--accent': '#7dd3fc' },
  violet: { '--primary': '#8b5cf6', '--primary-dim': '#7c3aed', '--accent': '#c4b5fd' },
}

/** Selectable accent names in picker order (default first). */
export const ACCENT_NAMES: AccentName[] = [
  'default',
  'indigo',
  'rose',
  'emerald',
  'amber',
  'sky',
  'violet',
]

/** Inline style overriding the accent vars, or undefined for the default theme. */
export function accentStyle(accent: AccentName | undefined): CSSProperties | undefined {
  if (!accent || accent === 'default') return undefined
  return ACCENTS[accent] as unknown as CSSProperties
}

/** A representative swatch colour for the picker chip. */
export function accentSwatch(accent: AccentName): string {
  if (accent === 'default') return 'var(--primary)'
  return ACCENTS[accent]['--primary']
}

/**
 * The real (non-default) presets, in the order they are handed out.
 * Derived from ACCENTS rather than filtered from ACCENT_NAMES so the type
 * stays non-optional under `noUncheckedIndexedAccess`.
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
    if (!person.accent || person.accent === 'default') continue
    used.set(person.accent, (used.get(person.accent) ?? 0) + 1)
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
