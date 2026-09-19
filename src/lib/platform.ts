/**
 * Where the app is currently running.
 *
 * Capacitor serves the bundle from `https://localhost/`, which is
 * indistinguishable from a dev server by URL alone — so this reads the bridge
 * object the Android WebView injects rather than sniffing `location`.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

/** True inside the packaged Android app, false in any browser. */
export function isNativeApp(): boolean {
  const cap = (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor
  return cap?.isNativePlatform?.() === true
}

/** The Play Store listing for the Android build. */
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=de.steppicrew.quotebingo'
