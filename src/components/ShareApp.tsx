import { useEffect, useRef, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { useTranslation } from 'react-i18next'
import { useModalDismiss } from '../lib/useModalDismiss'
import { PLAY_STORE_URL, isNativeApp } from '../lib/platform'
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
  const [target, setTarget] = useState<'play' | 'web'>(isNativeApp() ? 'play' : 'web')
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

        <div className="row">
          <button
            className={target === 'play' ? 'primary' : 'ghost'}
            onClick={() => setTarget('play')}
          >
            {t('share.play')}
          </button>
          <button
            className={target === 'web' ? 'primary' : 'ghost'}
            onClick={() => setTarget('web')}
          >
            {t('share.web')}
          </button>
        </div>

        {error ? <p className="dim">{t('qr.error', { error })}</p> : <canvas ref={canvasRef} />}

        <p className="dim">{t('share.hint')}</p>
        <p className="dim share-url">{url}</p>

        <button className="primary" onClick={onClose}>
          {t('settings.close')}
        </button>
      </div>
    </div>
  )
}
