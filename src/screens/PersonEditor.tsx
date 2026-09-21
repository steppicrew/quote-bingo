import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useStore } from '../store'
import { replaceRoute } from '../router'
import { SIZES, quotesNeeded } from '../types'
import { ACCENT_NAMES, accentSwatch, normalizeAccent } from '../lib/accents'
import { exportToFile } from '../lib/share'
import { useToast } from '../components/toast-context'
import { useConfirm } from '../components/confirm-context'

const QrShow = lazy(() =>
  import('../components/QrShow').then((m) => ({ default: m.QrShow })),
)

export function PersonEditor({ id }: { id: string }): ReactNode {
  const { t } = useTranslation()
  const person = useStore((s) => s.persons.find((p) => p.id === id))
  const quotes = useStore((s) => s.quotes)
  const addQuotes = useStore((s) => s.addQuotes)
  const editQuote = useStore((s) => s.editQuote)
  const deleteQuote = useStore((s) => s.deleteQuote)
  const renamePerson = useStore((s) => s.renamePerson)
  const setAccent = useStore((s) => s.setAccent)
  const deletePerson = useStore((s) => s.deletePerson)
  const toast = useToast()
  const confirm = useConfirm()

  const [bulk, setBulk] = useState('')
  const [showQr, setShowQr] = useState(false)

  const mine = useMemo(
    () => quotes.filter((q) => q.personId === id),
    [quotes, id],
  )

  if (!person) {
    return (
      <div className="content">
        <p className="dim">{t('editor.notFound')}</p>
        <button onClick={() => replaceRoute({ name: 'manage' })}>{t('editor.back')}</button>
      </div>
    )
  }

  const texts = mine.map((q) => q.text)
  const minPool = quotesNeeded(SIZES[0]!) // 3x3 -> 8
  const maxPlayable = [...SIZES].reverse().find((s) => mine.length >= quotesNeeded(s))

  const addBulk = (): void => {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    addQuotes(id, lines)
    setBulk('')
    toast(t('editor.quotesAdded', { count: lines.length }))
  }

  const remove = async (): Promise<void> => {
    if (
      await confirm({
        message: t('editor.deleteConfirm', { name: person.name }),
        confirmLabel: t('editor.delete'),
        danger: true,
      })
    ) {
      deletePerson(id)
      // The person this entry points at is gone, so overwrite it rather than
      // stacking on top: Back must not return to an editor for a dead id.
      replaceRoute({ name: 'manage' })
    }
  }

  return (
    <div className="content">
      <div className="row">
        <input
          value={person.name}
          onChange={(e) => renamePerson(id, e.target.value)}
        />
        <button className="danger" onClick={() => void remove()}>
          {t('editor.delete')}
        </button>
      </div>

      <div className="row accent-row">
        <span className="dim">{t('editor.accent')}</span>
        {ACCENT_NAMES.map((name) => {
          // Compare normalised, so a person still stored with a retired accent
          // shows the preset it maps to as selected instead of nothing at all.
          const selected = normalizeAccent(person.accent) === name
          return (
            <button
              key={name}
              type="button"
              className={clsx('accent-swatch', { active: selected })}
              style={{ background: accentSwatch(name) }}
              aria-label={t(`accent.${name}`)}
              aria-pressed={selected}
              title={t(`accent.${name}`)}
              onClick={() => setAccent(id, name)}
            />
          )
        })}
      </div>

      <div className="row">
        <span className={`badge ${maxPlayable ? 'ok' : 'warn'}`}>
          {t('editor.badgeCount', { count: mine.length })}
          {maxPlayable
            ? t('editor.badgeUpTo', { size: maxPlayable })
            : t('editor.badgeMin', { min: minPool })}
        </span>
        <div className="spacer" />
        <button
          onClick={() => {
            exportToFile(person.name, mine)
            toast(t('editor.exportedFile'))
          }}
        >
          {t('editor.exportFile')}
        </button>
        <button onClick={() => setShowQr(true)} disabled={texts.length === 0}>
          {t('editor.showQr')}
        </button>
      </div>

      <div className="card-tile">
        <textarea
          placeholder={t('editor.bulkPlaceholder')}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <div className="spacer" />
          <button className="primary" onClick={addBulk}>
            {t('editor.addQuotes')}
          </button>
        </div>
      </div>

      {mine.length === 0 && <p className="dim">{t('editor.noQuotes')}</p>}

      {mine.map((q) => (
        <div key={q.id} className="card-tile row">
          <input
            value={q.text}
            onChange={(e) => editQuote(q.id, e.target.value)}
            onBlur={(e) => editQuote(q.id, e.target.value.trim())}
          />
          <button className="ghost danger" onClick={() => deleteQuote(q.id)}>
            ✕
          </button>
        </div>
      ))}

      {showQr && (
        <Suspense fallback={null}>
          <QrShow name={person.name} quotes={mine} onClose={() => setShowQr(false)} />
        </Suspense>
      )}
    </div>
  )
}
