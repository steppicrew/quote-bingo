/**
 * Locale table for the build/publish scripts. Mirrors `SUPPORTED_LNGS` in
 * src/i18n/index.ts — the app is TypeScript and cannot be imported from plain
 * Node scripts, so the mapping to Play Console tags lives here as well.
 * Keep the two in sync; `yarn check-locales` verifies it.
 *
 * `code`     — the app's own locale code (src/i18n/<code>.json, Android
 *              values-<code>/, LISTINGS.json keys)
 * `playStore` — Play Console's tag (store-listing/<tag>/, assets/<tag>/, and
 *              the `language` parameter of the Play API)
 */
export const LOCALES = [
  { code: 'de', playStore: 'de-DE', label: 'Deutsch' },
  { code: 'en', playStore: 'en-US', label: 'English' },
  { code: 'fr', playStore: 'fr-FR', label: 'Français' },
  { code: 'es', playStore: 'es-ES', label: 'Español' },
  { code: 'it', playStore: 'it-IT', label: 'Italiano' },
  { code: 'pt', playStore: 'pt-PT', label: 'Português' },
  { code: 'zh', playStore: 'zh-CN', label: '中文' },
  { code: 'ja', playStore: 'ja-JP', label: '日本語' },
  { code: 'ko', playStore: 'ko-KR', label: '한국어' },
];

/** The listing Play falls back to when a user's language has none. */
export const DEFAULT_LOCALE = 'en';
