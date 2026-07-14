import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import de from './de.json'
import en from './en.json'
import fr from './fr.json'
import es from './es.json'

export const SUPPORTED_LNGS = ['de', 'en', 'fr', 'es'] as const

// Static imports so Workbox precaches every locale — the app stays fully
// offline. The store's persisted `locale` drives changeLanguage() from App;
// the detector only supplies the initial guess for the 'system' setting.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
    },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LNGS],
    nonExplicitSupportedLngs: true, // 'de-DE' -> 'de'
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['navigator'],
      caches: [], // we persist the choice ourselves via Zustand
    },
  })

export default i18n
