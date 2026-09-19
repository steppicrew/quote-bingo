import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import QRCode from 'qrcode'
import { useTranslation } from 'react-i18next'
import { useModalDismiss } from '../lib/useModalDismiss'
import { PLAY_STORE_URL } from '../lib/platform'
import './modal.scss'

/** Where the web version lives, for people without Play. */
const WEB_URL = 'https://bingo.steppicrew.de/'

interface Props {
  onClose: () => void
}

/**
 * A QR code pointing at the app, so it can be handed to the person sitting
 * next to you — which is exactly the situation the game is played in.
 *
 * Inside the Android build this replaces the PWA install row, which there only
 * ever reported "installed / not available": the app *is* the install.
 */
export function ShareApp({ onClose }: Props): ReactNode {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Play is the default everywhere: handing someone the store listing is the
  // normal way to pass the app on, and the website is the fallback for people
  // without Play rather than the first offer.
  const [target, setTarget] = useState<'play' | 'web'>('play')
  const [error, setError] = useState<string | null>(null)
  useModalDismiss(onClose)

  const url = target === 'play' ? PLAY_STORE_URL : WEB_URL

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    void QRCode.toCanvas(canvas, url, { width: 288, margin: 2 }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : t('qr.showFailed'))
    })
  }, [url, t])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('share.title')}</h2>

        {/*
          `.toggle` rather than swapping primary/ghost: `primary` also sets
          font-weight, so the selected side rendered taller than the other.
          The class keeps both sides identical and colours only the active one.
        */}
        <div className="row share-targets">
          <button
            className={clsx('toggle', { active: target === 'play' })}
            onClick={() => setTarget('play')}
          >
            {t('share.play')}
          </button>
          <button
            className={clsx('toggle', { active: target === 'web' })}
            onClick={() => setTarget('web')}
          >
            {t('share.web')}
          </button>
        </div>

        {error ? <p className="dim">{t('qr.error', { error })}</p> : <canvas ref={canvasRef} />}

        <p className="dim">{t('share.hint')}</p>
        {/* Tappable as well as readable: on the device holding the code, this
            is the quickest way to reach the listing yourself. */}
        <p className="dim share-url">
          <a href={url} target="_blank" rel="noreferrer noopener">
            {url}
          </a>
        </p>

        <button className="primary" onClick={onClose}>
          {t('settings.close')}
        </button>
      </div>
    </div>
  )
}
