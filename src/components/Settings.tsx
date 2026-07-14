import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { type QuoteListExport } from '../types'
import { importFromFile } from '../lib/share'
import { useInstall } from '../lib/install'
import { useModalDismiss } from '../lib/useModalDismiss'
import { useTranslation } from 'react-i18next'
import { ThemeToggle } from './ThemeToggle'
import { LanguageToggle } from './LanguageToggle'
import { useToast } from './toast-context'
import './Settings.scss'

// html5-qrcode is large; only pull it in when the scanner is opened.
const QrScan = lazy(() => import('./QrScan').then((m) => ({ default: m.QrScan })))

interface Props {
  onClose: () => void
}

export function Settings({ onClose }: Props): ReactNode {
  const { t } = useTranslation()
  const importList = useStore((s) => s.importList)
  const { canInstall, promptInstall } = useInstall()
  const toast = useToast()

  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useModalDismiss(onClose)

  const applyImport = (list: QuoteListExport): void => {
    const res = importList(list.person.name, list.quotes)
    toast(
      t('settings.importResult', {
        name: list.person.name,
        added: res.added,
        skipped: res.skipped,
      }),
    )
  }

  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      applyImport(await importFromFile(file))
    } catch (e) {
      toast(e instanceof Error ? e.message : t('settings.importFailed'))
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <h2>{t('settings.title')}</h2>

        <div className="setting">
          <span>{t('settings.design')}</span>
          <ThemeToggle />
        </div>

        <div className="setting">
          <span>{t('settings.language')}</span>
          <LanguageToggle />
        </div>

        <div className="setting">
          <span>{t('settings.import')}</span>
          <div className="row">
            <button onClick={() => fileRef.current?.click()}>{t('settings.file')}</button>
            <button onClick={() => setScanning(true)}>{t('settings.scanQr')}</button>
          </div>
        </div>

        <div className="setting">
          <span>{t('settings.app')}</span>
          {canInstall ? (
            <button className="primary" onClick={() => void promptInstall()}>
              {t('settings.install')}
            </button>
          ) : (
            <span className="dim">{t('settings.installed')}</span>
          )}
        </div>

        <div className="about dim">
          <div>{t('app.title')} v{__APP_VERSION__}</div>
          <a
            href="https://github.com/steppicrew/quote-bingo"
            target="_blank"
            rel="noreferrer noopener"
          >
            github.com/steppicrew/quote-bingo
          </a>
        </div>

        <button className="primary" onClick={onClose}>
          {t('settings.close')}
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
