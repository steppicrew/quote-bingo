import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { decodeList } from '../lib/share'
import { type QuoteListExport } from '../types'

interface Props {
  onResult: (list: QuoteListExport) => void
  onClose: () => void
}

const REGION_ID = 'qr-scan-region'

export function QrScan({ onResult, onClose }: Props): ReactNode {
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode(REGION_ID, { verbose: false })
    scannerRef.current = scanner

    const stop = (): void => {
      if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
        void scanner.stop().catch(() => undefined)
      }
    }

    void scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          if (doneRef.current) return
          void (async () => {
            try {
              const list = await decodeList(text)
              doneRef.current = true
              stop()
              onResult(list)
            } catch {
              setError('Gescannter Code ist keine gültige Zitatliste.')
            }
          })()
        },
        () => undefined,
      )
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Kamera nicht verfügbar')
      })

    return () => {
      stop()
    }
  }, [onResult])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Zitatliste scannen</h2>
        <div id={REGION_ID} className="qr-scan-region" />
        {error && <p className="dim">{error}</p>}
        <button className="primary" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  )
}
