import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store'
import { navigate } from '../router'
import { SIZES, quotesNeeded, type QuoteListExport } from '../types'
import { useToast } from '../components/toast-context'
import { QrIcon } from '../components/icons'

// Pulls in the camera library, so keep it out of the initial bundle.
const QrScan = lazy(() => import('../components/QrScan').then((m) => ({ default: m.QrScan })))

export function Manage(): ReactNode {
  const { t } = useTranslation()
  const persons = useStore((s) => s.persons)
  const quotes = useStore((s) => s.quotes)
  const addPerson = useStore((s) => s.addPerson)
  const importList = useStore((s) => s.importList)
  const toast = useToast()

  const [newName, setNewName] = useState('')
  const [scanning, setScanning] = useState(false)

  // A scan either fills a new person's pool or merges into the matching one,
  // which is exactly what this screen is for — so it belongs here and not only
  // behind the Settings cog.
  const applyImport = (list: QuoteListExport): void => {
    const res = importList(list.person.name, list.quotes)
    toast(
      t('settings.importResult', {
        name: list.person.name,
        added: res.added,
        updated: res.updated,
        skipped: res.skipped,
      }),
    )
  }

  const count = (personId: string): number =>
    quotes.filter((q) => q.personId === personId).length

  const add = (): void => {
    const name = newName.trim()
    if (!name) return
    const id = addPerson(name)
    setNewName('')
    navigate({ name: 'person', id })
  }

  return (
    <div className="content">
      <div className="card-tile">
        <div className="row">
          <input
            placeholder={t('manage.newPersonPlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="primary" onClick={add}>
            {t('manage.add')}
          </button>
        </div>
      </div>

      {persons.length === 0 && <p className="dim">{t('manage.empty')}</p>}

      {persons.map((p) => {
        const n = count(p.id)
        const minPool = quotesNeeded(SIZES[0]!)
        const maxPlayable = [...SIZES].reverse().find((s) => n >= quotesNeeded(s))
        return (
          <div
            key={p.id}
            className="card-tile row"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate({ name: 'person', id: p.id })}
          >
            <div>
              <strong>{p.name}</strong>
              <div className="dim">{t('manage.quoteCount', { count: n })}</div>
            </div>
            <div className="spacer" />
            <span className={`badge ${maxPlayable ? 'ok' : 'warn'}`}>
              {maxPlayable
                ? t('manage.upTo', { size: maxPlayable })
                : t('manage.remaining', { count: minPool - n })}
            </span>
          </div>
        )
      })}

      <div className="scan-row">
        <button className="scan-btn" onClick={() => setScanning(true)}>
          <QrIcon />
          {t('manage.scanQr')}
        </button>
      </div>
      <p className="dim manage-hint">{t('manage.scanHint')}</p>

      {scanning && (
        <Suspense fallback={null}>
          <QrScan
            onResult={(list) => {
              setScanning(false)
              applyImport(list)
            }}
            onClose={() => setScanning(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
