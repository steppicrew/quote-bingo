import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { type QuoteListExport } from '../types'
import { importFromFile, exportBackup, importBackupFile } from '../lib/share'
import { useInstall } from '../lib/install'
import { useModalDismiss } from '../lib/useModalDismiss'
import { playFanfare, type SoundKind, type SoundMode } from '../lib/fanfare'
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
  const backupData = useStore((s) => s.backupData)
  const restoreBackup = useStore((s) => s.restoreBackup)
  const soundMode = useStore((s) => s.soundMode)
  const setSoundMode = useStore((s) => s.setSoundMode)
  const soundKind = useStore((s) => s.soundKind)
  const setSoundKind = useStore((s) => s.setSoundKind)
  const { canInstall, promptInstall } = useInstall()
  const toast = useToast()

  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const backupRef = useRef<HTMLInputElement>(null)
  useModalDismiss(onClose)

  const onBackupFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      const data = await importBackupFile(file)
      if (!confirm(t('settings.restoreConfirm'))) return
      restoreBackup(data)
      toast(t('settings.restoreDone'))
    } catch (e) {
      toast(e instanceof Error ? e.message : t('settings.restoreFailed'))
    }
  }

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
          <span>
            {t('settings.language')}
            {t('settings.language') !== 'Language' && ' / Language'}
          </span>
          <LanguageToggle />
        </div>

        <div className="setting">
          <span>{t('settings.sound')}</span>
          <select
            aria-label={t('settings.sound')}
            value={soundMode}
            onChange={(e) => {
              const mode = e.target.value as SoundMode
              setSoundMode(mode)
              playFanfare(mode, soundKind) // preview the choice
            }}
          >
            <option value="on">{t('settings.soundOn')}</option>
            <option value="vibrate">{t('settings.soundVibrate')}</option>
            <option value="off">{t('settings.soundOff')}</option>
          </select>
        </div>

        <div className="setting">
          <span>{t('settings.soundType')}</span>
          <select
            aria-label={t('settings.soundType')}
            value={soundKind}
            disabled={soundMode !== 'on'}
            onChange={(e) => {
              const kind = e.target.value as SoundKind
              setSoundKind(kind)
              playFanfare('on', kind) // preview the choice
            }}
          >
            <option value="tadaa">{t('settings.soundTadaa')}</option>
            <option value="arpeggio">{t('settings.soundArpeggio')}</option>
          </select>
        </div>

        <div className="setting">
          <span>{t('settings.import')}</span>
          <div className="row">
            <button onClick={() => fileRef.current?.click()}>{t('settings.file')}</button>
            <button onClick={() => setScanning(true)}>{t('settings.scanQr')}</button>
          </div>
        </div>

        <div className="setting">
          <span>{t('settings.backup')}</span>
          <div className="row">
            <button onClick={() => exportBackup(backupData())}>
              {t('settings.exportAll')}
            </button>
            <button onClick={() => backupRef.current?.click()}>
              {t('settings.importAll')}
            </button>
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

        <input
          ref={backupRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void onBackupFile(e.target.files?.[0])
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
