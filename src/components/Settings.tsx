import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { replaceRoute } from '../router'
import { type QuoteListExport } from '../types'
import { importAnyFile, exportBackup, importBackupFile } from '../lib/share'
import { useInstall } from '../lib/install'
import { isNativeApp } from '../lib/platform'
import { useModalDismiss } from '../lib/useModalDismiss'
import { playFanfare, type SoundKind, type SoundMode } from '../lib/fanfare'
import { useTranslation } from 'react-i18next'
import { ThemeToggle } from './ThemeToggle'
import { LanguageToggle } from './LanguageToggle'
import { useToast } from './toast-context'
import { useConfirm } from './confirm-context'
import './Settings.scss'

// html5-qrcode is large; only pull it in when the scanner is opened.
const QrScan = lazy(() => import('./QrScan').then((m) => ({ default: m.QrScan })))
const ShareApp = lazy(() => import('./ShareApp').then((m) => ({ default: m.ShareApp })))

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
  const confirm = useConfirm()

  const [scanning, setScanning] = useState(false)
  const [sharing, setSharing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const backupRef = useRef<HTMLInputElement>(null)
  useModalDismiss(onClose)

  const onBackupFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      const data = await importBackupFile(file)
      if (!(await confirm({ message: t('settings.restoreConfirm'), danger: true }))) return
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
      // Both exports are JSON and a user handed a file — from a download, a
      // share sheet or a file manager — has no reason to know which button
      // matches which shape. Route on the content, so picking the wrong one
      // reads as "it just worked" instead of "Import failed".
      const parsed = await importAnyFile(file)
      if (parsed.kind === 'backup') {
        if (!(await confirm({ message: t('settings.restoreConfirm'), danger: true })))
          return
        restoreBackup(parsed.data)
        toast(t('settings.restoreDone'))
        return
      }
      applyImport(parsed.data)
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
            <button
              onClick={() => {
                exportBackup(backupData())
                toast(t('settings.exportedAll'))
              }}
            >
              {t('settings.exportAll')}
            </button>
            <button onClick={() => backupRef.current?.click()}>
              {t('settings.importAll')}
            </button>
          </div>
        </div>

        <div className="setting">
          <span>{t('settings.app')}</span>
          <div className="row">
            {/*
              The install prompt and the "installed / not available" fallback
              only mean something on the web. In the packaged app the install
              IS the app, so that row said nothing — it is replaced by a way to
              pass the app on to whoever is sitting next to you.
            */}
            {!isNativeApp() &&
              (canInstall ? (
                <button className="primary" onClick={() => void promptInstall()}>
                  {t('settings.install')}
                </button>
              ) : (
                <span className="dim">{t('settings.installed')}</span>
              ))}
            {/*
              No Play Store button here: Share already shows a code for the
              listing and prints the link, which is the way to reach the store
              from inside the app.
            */}
            <button onClick={() => setSharing(true)}>{t('settings.shareApp')}</button>
          </div>
        </div>

        <div className="about dim">
          <div>{t('app.title')} v{__APP_VERSION__}</div>
          {/*
            Not a bare href: this modal hands over to a route rather than
            closing on top of one. replaceRoute overwrites the entry
            useModalDismiss pushed on open, so Privacy takes Settings' place in
            history and Back from there lands on whatever Settings was opened
            over. Order matters — onClose() last, so the hook's cleanup sees
            the replaced (non-modal) state and pops nothing.
          */}
          <a
            href="#/privacy"
            onClick={(e) => {
              e.preventDefault()
              replaceRoute({ name: 'privacy' })
              onClose()
            }}
          >
            {t('settings.privacy')}
          </a>
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

        {sharing && (
          <Suspense fallback={null}>
            <ShareApp onClose={() => setSharing(false)} />
          </Suspense>
        )}

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
