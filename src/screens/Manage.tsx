import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { navigate } from '../router'
import { SIZES, quotesNeeded, type QuoteListExport } from '../types'
import { importFromFile } from '../lib/share'
import { useInstall } from '../lib/install'
import { useToast } from '../components/toast-context'

// html5-qrcode is large; only pull it in when the scanner is opened.
const QrScan = lazy(() =>
  import('../components/QrScan').then((m) => ({ default: m.QrScan })),
)

export function Manage(): ReactNode {
  const persons = useStore((s) => s.persons)
  const quotes = useStore((s) => s.quotes)
  const addPerson = useStore((s) => s.addPerson)
  const importList = useStore((s) => s.importList)
  const { canInstall, promptInstall } = useInstall()
  const toast = useToast()

  const [newName, setNewName] = useState('')
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const count = (personId: string): number =>
    quotes.filter((q) => q.personId === personId).length

  const add = (): void => {
    const name = newName.trim()
    if (!name) return
    const id = addPerson(name)
    setNewName('')
    navigate({ name: 'person', id })
  }

  const applyImport = (list: QuoteListExport): void => {
    const res = importList(list.person.name, list.quotes)
    toast(
      `„${list.person.name}“ importiert: +${res.added} neu, ${res.skipped} Duplikate übersprungen`,
    )
  }

  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      applyImport(await importFromFile(file))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import fehlgeschlagen')
    }
  }

  return (
    <div className="content">
      <div className="card-tile">
        <div className="row">
          <input
            placeholder="Name der neuen Person"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="primary" onClick={add}>
            Hinzufügen
          </button>
        </div>
      </div>

      <div className="row">
        <button onClick={() => fileRef.current?.click()}>Datei importieren</button>
        <button onClick={() => setScanning(true)}>QR scannen</button>
        {canInstall && (
          <>
            <div className="spacer" />
            <button className="primary" onClick={() => void promptInstall()}>
              Installieren
            </button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      {persons.length === 0 && (
        <p className="dim">
          Noch keine Personen. Füge jemanden hinzu und fülle den Zitat-Pool.
        </p>
      )}

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
              <div className="dim">{n} Zitate</div>
            </div>
            <div className="spacer" />
            <span className={`badge ${maxPlayable ? 'ok' : 'warn'}`}>
              {maxPlayable ? `bis ${maxPlayable}×${maxPlayable}` : `noch ${minPool - n}`}
            </span>
          </div>
        )
      })}

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
