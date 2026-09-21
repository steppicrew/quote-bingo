import { useCallback, useState, type ReactNode } from 'react'
import { ToastCtx, type PushToast, type ToastKind } from './toast-context'
import './Toast.scss'

interface ToastItem {
  id: number
  text: string
  kind: ToastKind
}

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [items, setItems] = useState<ToastItem[]>([])

  // One toast at a time: a new message replaces whatever is still on screen
  // rather than queueing below it. Stacked toasts read as a list of equally
  // current states, which is exactly wrong for a toggle — the sound button can
  // be tapped three times in a row and only the last state is true.
  const push = useCallback<PushToast>((text, kind = 'info') => {
    const id = Date.now() + Math.random()
    setItems([{ id, text, kind }])
    window.setTimeout(() => {
      // Only clear if we are still the current toast — a later push already
      // replaced us and owns its own timer.
      setItems((cur) => cur.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
