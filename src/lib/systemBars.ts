import { isNativeApp } from './platform'
import type { Theme } from '../types'

/**
 * Keeps Android's status bar and navigation bar legible against whatever theme
 * the app is currently painting.
 *
 * The theme is chosen inside the app, not by the OS, so Android's own
 * `values-night/` resource qualifier cannot know about it: someone running the
 * app in light mode on a dark-mode phone would get light icons on a near-white
 * background and see nothing at all. The bars therefore have to be told at
 * runtime, every time the resolved theme changes.
 *
 * `dark` means "the app is painting a dark background", so the bars need light
 * icons — the native side inverts it into Android's `appearanceLight*Bars`
 * flags, which are named for the bar rather than the icons and read backwards.
 */

/** Resolve 'system' against the OS preference. */
export function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/**
 * Apply the resolved theme to the native system bars.
 *
 * A no-op on the web, where the `theme-color` meta tag already does this job.
 */
export async function applySystemBars(theme: Theme): Promise<void> {
  if (!isNativeApp()) return

  const resolved = resolveTheme(theme)

  try {
    // Our own plugin: it drives BOTH bars. @capacitor/status-bar has no
    // navigation-bar API, and from Android 15 the system draws that bar
    // transparent over the page, so its icons take contrast from whatever the
    // app paints — which made them nearly invisible on the light theme.
    const { registerPlugin } = await import('@capacitor/core')
    const SystemBars = registerPlugin<{
      setAppearance(options: { dark: boolean }): Promise<void>
    }>('SystemBars')
    await SystemBars.setAppearance({ dark: resolved === 'dark' })
  } catch {
    // The plugin is absent on the web build and may be unavailable on an
    // unusual device — the app must not fail to start over a bar colour.
  }
}
