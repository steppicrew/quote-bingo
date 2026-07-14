import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { type QuoteListExport } from '../types'
import { importFromFile } from '../lib/share'
import { useInstall } from '../lib/install'
import { useModalDismiss } from '../lib/useModalDismiss'
import { ThemeToggle } from './ThemeToggle'
import { useToast } from './toast-context'
import './Settings.scss'

// html5-qrcode is large; only pull it in when the scanner is opened.
const QrScan = lazy(() => import('./QrScan').then((m) => ({ default: m.QrScan })))

interface Props {
  onClose: () => void
}

export function Settings({ onClose }: Props): ReactNode {
  const importList = useStore((s) => s.importList)
  const { canInstall, promptInstall } = useInstall()
  const toast = useToast()

  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useModalDismiss(onClose)

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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <h2>Einstellungen</h2>

        <div className="setting">
          <span>Design</span>
          <ThemeToggle />
        </div>

        <div className="setting">
          <span>Importieren</span>
          <div className="row">
            <button onClick={() => fileRef.current?.click()}>Datei</button>
            <button onClick={() => setScanning(true)}>QR scannen</button>
          </div>
        </div>

        <div className="setting">
          <span>App</span>
          {canInstall ? (
            <button className="primary" onClick={() => void promptInstall()}>
              Installieren
            </button>
          ) : (
            <span className="dim">Installiert / nicht verfügbar</span>
          )}
        </div>

        <div className="about dim">
          <div>Zitat-Bingo v{__APP_VERSION__}</div>
          <a
            href="https://github.com/steppicrew/quote-bingo"
            target="_blank"
            rel="noreferrer noopener"
          >
            github.com/steppicrew/quote-bingo
          </a>
        </div>

        <button className="primary" onClick={onClose}>
          Schließen
        </button>

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
    </div>
  )
}
