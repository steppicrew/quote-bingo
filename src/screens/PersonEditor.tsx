import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { navigate } from '../router'
import { SIZES, quotesNeeded } from '../types'
import { exportToFile } from '../lib/share'
import { useToast } from '../components/toast-context'

const QrShow = lazy(() =>
  import('../components/QrShow').then((m) => ({ default: m.QrShow })),
)

export function PersonEditor({ id }: { id: string }): ReactNode {
  const person = useStore((s) => s.persons.find((p) => p.id === id))
  const quotes = useStore((s) => s.quotes)
  const addQuotes = useStore((s) => s.addQuotes)
  const editQuote = useStore((s) => s.editQuote)
  const deleteQuote = useStore((s) => s.deleteQuote)
  const renamePerson = useStore((s) => s.renamePerson)
  const deletePerson = useStore((s) => s.deletePerson)
  const toast = useToast()

  const [bulk, setBulk] = useState('')
  const [showQr, setShowQr] = useState(false)

  const mine = useMemo(
    () => quotes.filter((q) => q.personId === id),
    [quotes, id],
  )

  if (!person) {
    return (
      <div className="content">
        <p className="dim">Person nicht gefunden.</p>
        <button onClick={() => navigate({ name: 'manage' })}>Zurück</button>
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
    toast(`${lines.length} Zitat${lines.length === 1 ? '' : 'e'} hinzugefügt`)
  }

  const remove = (): void => {
    if (confirm(`„${person.name}“ und alle Zitate löschen?`)) {
      deletePerson(id)
      navigate({ name: 'manage' })
    }
  }

  return (
    <div className="content">
      <div className="row">
        <input
          value={person.name}
          onChange={(e) => renamePerson(id, e.target.value)}
        />
        <button className="danger" onClick={remove}>
          Löschen
        </button>
      </div>

      <div className="row">
        <span className={`badge ${maxPlayable ? 'ok' : 'warn'}`}>
          {mine.length} Zitate
          {maxPlayable
            ? ` · bis ${maxPlayable}×${maxPlayable}`
            : ` · min. ${minPool} für 3×3`}
        </span>
        <div className="spacer" />
        <button onClick={() => exportToFile(person.name, texts)}>Datei exportieren</button>
        <button onClick={() => setShowQr(true)} disabled={texts.length === 0}>
          QR anzeigen
        </button>
      </div>

      <div className="card-tile">
        <textarea
          placeholder="Zitate hinzufügen – eines pro Zeile"
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <div className="spacer" />
          <button className="primary" onClick={addBulk}>
            Zitate hinzufügen
          </button>
        </div>
      </div>

      {mine.length === 0 && <p className="dim">Noch keine Zitate.</p>}

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
          <QrShow name={person.name} quotes={texts} onClose={() => setShowQr(false)} />
        </Suspense>
      )}
    </div>
  )
}
