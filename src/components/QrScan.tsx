import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { decodeList, joinChunks, parseChunk } from '../lib/share'
import { type QuoteListExport } from '../types'
import { useModalDismiss } from '../lib/useModalDismiss'

interface Props {
  onResult: (list: QuoteListExport) => void
  onClose: () => void
}

const REGION_ID = 'qr-scan-region'

/** Chunks collected so far for a multi-QR group, keyed by chunk index. */
interface Collected {
  group: string
  total: number
  bodies: Map<number, string>
}

export function QrScan({ onResult, onClose }: Props): ReactNode {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ have: number; total: number } | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const doneRef = useRef(false)
  const collectedRef = useRef<Collected | null>(null)
  useModalDismiss(onClose)

  useEffect(() => {
    const scanner = new Html5Qrcode(REGION_ID, { verbose: false })
    scannerRef.current = scanner

    const stop = (): void => {
      if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
        void scanner.stop().catch(() => undefined)
      }
    }

    const finish = async (code: string): Promise<void> => {
      try {
        const list = await decodeList(code)
        doneRef.current = true
        stop()
        onResult(list)
      } catch {
        setError(t('qr.invalidCode'))
      }
    }

    const onScan = (text: string): void => {
      if (doneRef.current) return
      const chunk = parseChunk(text)
      if (!chunk) {
        // Plain single-QR code (back-compatible path).
        void finish(text)
        return
      }
      // Multi-QR: accumulate this chunk into its group.
      let c = collectedRef.current
      if (!c || c.group !== chunk.group) {
        c = { group: chunk.group, total: chunk.total, bodies: new Map() }
        collectedRef.current = c
      }
      c.bodies.set(chunk.idx, chunk.body)
      setProgress({ have: c.bodies.size, total: c.total })
      const joined = joinChunks(c.bodies, c.total)
      if (joined !== null) void finish(joined)
    }

    void scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        onScan,
        () => undefined,
      )
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : t('qr.cameraUnavailable'))
      })

    return () => {
      stop()
    }
  }, [onResult, t])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('qr.scanTitle')}</h2>
        <div id={REGION_ID} className="qr-scan-region" />
        {progress && progress.total > 1 && (
          <p className="dim">
            {t('qr.scanProgress', { have: progress.have, total: progress.total })}
          </p>
        )}
        {error && <p className="dim">{error}</p>}
        <button className="primary" onClick={onClose}>
          {t('qr.close')}
        </button>
      </div>
    </div>
  )
}
