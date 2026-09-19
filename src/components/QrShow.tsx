import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import { chunkCode, encodeList, QR_ERROR_CORRECTION } from '../lib/share'
import { useModalDismiss } from '../lib/useModalDismiss'
import { type ExportQuote } from '../types'
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from './icons'

interface Props {
  name: string
  quotes: ExportQuote[]
  onClose: () => void
}

/** How long each chunk stays on screen when auto-advancing (ms). */
const AUTO_ADVANCE_MS = 2500

export function QrShow({ name, quotes, onClose }: Props): ReactNode {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [chunks, setChunks] = useState<string[] | null>(null)
  const [page, setPage] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useModalDismiss(onClose)

  // Encode + split once per quote set.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const code = await encodeList(name, quotes)
        if (cancelled) return
        setChunks(chunkCode(code))
        setPage(0)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('qr.showFailed'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [name, quotes, t])

  const total = chunks?.length ?? 0
  const multi = total > 1

  // Render the current chunk into the canvas whenever it changes.
  useEffect(() => {
    if (!chunks) return
    const code = chunks[page]
    const canvas = canvasRef.current
    if (!code || !canvas) return
    // Bigger canvas and 25% error correction: these are scanned by holding one
    // phone over another, where glare and a slight tilt are the norm. See
    // QR_MAX_CHARS for why the payload budget shrank at the same time.
    void QRCode.toCanvas(canvas, code, {
      width: 340,
      margin: 2,
      errorCorrectionLevel: QR_ERROR_CORRECTION,
    }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : t('qr.showFailed'))
    })
  }, [chunks, page, t])

  // Auto-advance through chunks while playing.
  useEffect(() => {
    if (!multi || !playing) return
    const id = window.setInterval(() => {
      setPage((p) => (p + 1) % total)
    }, AUTO_ADVANCE_MS)
    return () => window.clearInterval(id)
  }, [multi, playing, total])

  const go = (delta: number): void => {
    setPlaying(false)
    setPage((p) => (p + delta + total) % total)
  }

  // Horizontal swipe on the QR to step between chunks (touch devices).
  const swipeStart = useRef<number | null>(null)
  const onTouchStart = (e: TouchEvent): void => {
    swipeStart.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: TouchEvent): void => {
    const start = swipeStart.current
    swipeStart.current = null
    if (start === null || !multi) return
    const dx = (e.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(dx) < 40) return
    go(dx < 0 ? 1 : -1)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('qr.shareTitle', { name })}</h2>
        {error && <p className="dim">{t('qr.error', { error })}</p>}
        {!error && (
          <>
            <canvas
              ref={canvasRef}
              className="qr-canvas"
              onTouchStart={multi ? onTouchStart : undefined}
              onTouchEnd={multi ? onTouchEnd : undefined}
            />
            {multi ? (
              <>
                <p className="dim">{t('qr.chunkHint')}</p>
                <div className="qr-pager">
                  <button
                    className={playing ? 'hidden' : undefined}
                    onClick={() => go(-1)}
                    aria-label={t('qr.prev')}
                    disabled={playing}
                  >
                    <ChevronLeftIcon />
                  </button>
                  <span className="qr-page">{t('qr.chunkOf', { idx: page + 1, total })}</span>
                  <button
                    className={playing ? 'hidden' : undefined}
                    onClick={() => go(1)}
                    aria-label={t('qr.next')}
                    disabled={playing}
                  >
                    <ChevronRightIcon />
                  </button>
                  <button
                    onClick={() => setPlaying((v) => !v)}
                    aria-label={playing ? t('qr.pause') : t('qr.play')}
                  >
                    {playing ? <PauseIcon /> : <PlayIcon />}
                  </button>
                </div>
                <div className="qr-dots">
                  {chunks?.map((_, i) => (
                    <span key={i} className={i === page ? 'dot active' : 'dot'} />
                  ))}
                </div>
              </>
            ) : (
              <p className="dim">{t('qr.scanHint')}</p>
            )}
          </>
        )}
        <button className="primary" onClick={onClose}>
          {t('qr.close')}
        </button>
      </div>
    </div>
  )
}
