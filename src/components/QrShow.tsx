import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import QRCode from 'qrcode'
import { encodeList, QR_MAX_CHARS } from '../lib/share'
import { useModalDismiss } from '../lib/useModalDismiss'
import { type ExportQuote } from '../types'

interface Props {
  name: string
  quotes: ExportQuote[]
  onClose: () => void
}

export function QrShow({ name, quotes, onClose }: Props): ReactNode {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tooBig, setTooBig] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useModalDismiss(onClose)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const code = await encodeList(name, quotes)
        if (cancelled) return
        if (code.length > QR_MAX_CHARS) {
          setTooBig(true)
          return
        }
        const canvas = canvasRef.current
        if (!canvas) return
        await QRCode.toCanvas(canvas, code, { width: 288, margin: 2 })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('qr.showFailed'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [name, quotes, t])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('qr.shareTitle', { name })}</h2>
        {error && <p className="dim">{t('qr.error', { error })}</p>}
        {tooBig ? (
          <p className="dim">
            <Trans i18nKey="qr.tooBig" count={quotes.length}>
              placeholder <strong>export</strong>
            </Trans>
          </p>
        ) : (
          <>
            <canvas ref={canvasRef} className="qr-canvas" />
            <p className="dim">{t('qr.scanHint')}</p>
          </>
        )}
        <button className="primary" onClick={onClose}>
          {t('qr.close')}
        </button>
      </div>
    </div>
  )
}
