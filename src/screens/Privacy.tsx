import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate } from '../router'
import POLICY from '../../privacy/POLICY.json'

interface Section {
  heading: string
  body: string
}
interface Entry {
  title: string
  intro: string
  sections: Section[]
}

/**
 * The privacy policy, in-app.
 *
 * Play requires a reachable policy URL and expects it to be findable inside
 * the app too. The text comes from privacy/POLICY.json, the same source the
 * static /privacy/ page is rendered from, so the page a reviewer opens and the
 * screen a user opens cannot drift apart.
 */
export function Privacy(): ReactNode {
  const { t, i18n } = useTranslation()
  const locales = POLICY.locales as Record<string, Entry>
  const entry = locales[i18n.language] ?? locales.en!

  return (
    <div className="content">
      <article className="policy">
        <h2>{entry.title}</h2>
        <p>{entry.intro}</p>
        {entry.sections.map((s) => (
          <section key={s.heading}>
            <h3>{s.heading}</h3>
            <p>{s.body}</p>
          </section>
        ))}
        <p className="dim">
          {POLICY.updated} · {POLICY.contact}
        </p>
      </article>

      <button className="primary" onClick={() => navigate({ name: 'game' })}>
        {t('editor.back')}
      </button>
    </div>
  )
}
