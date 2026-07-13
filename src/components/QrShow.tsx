import { useEffect, useRef, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { encodeList, QR_MAX_CHARS } from '../lib/share'

interface Props {
  name: string
  quotes: string[]
  onClose: () => void
}

export function QrShow({ name, quotes, onClose }: Props): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tooBig, setTooBig] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        if (!cancelled) setError(e instanceof Error ? e.message : 'QR fehlgeschlagen')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [name, quotes])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>„{name}“ teilen</h2>
        {error && <p className="dim">Fehler: {error}</p>}
        {tooBig ? (
          <p className="dim">
            Diese Liste ist zu groß für einen QR-Code ({quotes.length} Zitate). Nutze stattdessen{' '}
            <strong>Datei exportieren</strong>.
          </p>
        ) : (
          <>
            <canvas ref={canvasRef} className="qr-canvas" />
            <p className="dim">Mit einem anderen Gerät scannen, um die Zitate zu importieren.</p>
          </>
        )}
        <button className="primary" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  )
}
