import { isNativeApp } from './platform'
import { accentHex } from './accents'
import type { Id, Person } from '../types'

/**
 * Android launcher shortcuts: long-press the app icon for the most recently
 * viewed people, each in their own accent colour, and tap one to open their
 * board. Native only — a web app's shortcuts are fixed in its manifest at
 * install time and cannot list anyone.
 *
 * The page owns the data, so it sends the whole list in recency order and the
 * native side (ShortcutsPlugin.java) decides how many the launcher gets; it
 * also refreshes or disables shortcuts pinned to the home screen, so a renamed
 * or deleted person never lingers there.
 */

interface ShortcutPerson {
  id: Id
  label: string
  /** Accent as #rrggbb; the icon is the initial on this colour. */
  color: string
}

interface ShortcutsPlugin {
  set(options: { people: ShortcutPerson[] }): Promise<void>
  addListener(
    event: 'open',
    listener: (data: { personId: Id }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

// Registered once and handed around WRAPPED: a Capacitor plugin proxy answers
// every property, `then` included, so resolving a promise with the bare proxy
// makes JS treat it as a thenable and call `Shortcuts.then()` on the native
// side — which fails, and the await never yields the plugin.
let registered: Promise<{ native: ShortcutsPlugin } | null> | null = null

function plugin(): Promise<{ native: ShortcutsPlugin } | null> {
  registered ??= isNativeApp()
    ? import('@capacitor/core').then(({ registerPlugin }) => ({
        native: registerPlugin<ShortcutsPlugin>('Shortcuts'),
      }))
    : Promise.resolve(null)
  return registered
}

/** Most recently viewed first; never-viewed people keep their list order. */
export function byRecency(persons: Person[], viewedAt: Record<Id, number>): Person[] {
  return persons
    .map((p, i) => ({ p, i, t: viewedAt[p.id] ?? 0 }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map(({ p }) => p)
}

// Android rate-limits shortcut updates, and every board switch changes the
// recency stamps; only call across the bridge when the list actually changed.
let lastSent = ''

export async function syncShortcuts(
  persons: Person[],
  viewedAt: Record<Id, number>,
): Promise<void> {
  const people = byRecency(persons, viewedAt).map((p) => ({
    id: p.id,
    label: p.name,
    color: accentHex(p.accent),
  }))
  const key = JSON.stringify(people)
  if (key === lastSent) return
  try {
    const handle = await plugin()
    if (!handle) return
    await handle.native.set({ people })
    lastSent = key
  } catch {
    // A launcher without shortcut support must not break the app.
  }
}

/**
 * Calls `onOpen` with the person a shortcut was tapped for — also for the
 * tap that cold-started the app, which the native side holds until a listener
 * is attached. Returns the unsubscribe function.
 */
export function onShortcutOpen(onOpen: (personId: Id) => void): () => void {
  let remove: (() => Promise<void>) | null = null
  let cancelled = false
  void plugin()
    .then((handle) => handle?.native.addListener('open', ({ personId }) => onOpen(personId)))
    .then((handle) => {
      if (!handle) return
      if (cancelled) void handle.remove()
      else remove = handle.remove
    })
    .catch(() => undefined)
  return () => {
    cancelled = true
    if (remove) void remove()
  }
}
