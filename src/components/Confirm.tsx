import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useModalDismiss } from '../lib/useModalDismiss'
import { ConfirmCtx, type AskConfirm, type ConfirmOptions } from './confirm-context'
import './modal.scss'

interface Pending extends ConfirmOptions {
  id: number
}

/**
 * Replaces `window.confirm` with an in-app modal. The native dialog is a
 * blocking browser chrome popup: it ignores the app's theme, is styled by the
 * OS ("localhost says…") and, in the Android WebView, freezes the page while
 * it is up. This resolves the same boolean, asynchronously.
 */
export function ConfirmProvider({ children }: { children: ReactNode }): ReactNode {
  const [pending, setPending] = useState<Pending | null>(null)
  // The resolver for the dialog currently on screen. Kept in a ref because
  // settling it must not depend on a re-render having happened.
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const ask = useCallback<AskConfirm>((options) => {
    return new Promise<boolean>((resolve) => {
      // A second ask while one is open would strand the first promise, so
      // decline it before taking over.
      resolveRef.current?.(false)
      resolveRef.current = resolve
      setPending({ ...options, id: Date.now() + Math.random() })
    })
  }, [])

  const settle = useCallback((ok: boolean) => {
    resolveRef.current?.(ok)
    resolveRef.current = null
    setPending(null)
  }, [])

  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {pending && <ConfirmDialog key={pending.id} pending={pending} settle={settle} />}
    </ConfirmCtx.Provider>
  )
}

interface DialogProps {
  pending: Pending
  settle: (ok: boolean) => void
}

function ConfirmDialog({ pending, settle }: DialogProps): ReactNode {
  const { t } = useTranslation()
  // Escape and the phone Back button count as "no", like dismissing the native
  // dialog does.
  useModalDismiss(() => settle(false))

  return (
    <div className="modal-backdrop" onClick={() => settle(false)}>
      <div className="modal confirm" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-message">{pending.message}</p>
        <div className="confirm-actions">
          <button onClick={() => settle(false)}>{t('common.cancel')}</button>
          <button
            className={pending.danger ? 'danger' : 'primary'}
            autoFocus
            onClick={() => settle(true)}
          >
            {pending.confirmLabel ?? t('common.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}
