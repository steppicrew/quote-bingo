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

  const push = useCallback<PushToast>((text, kind = 'info') => {
    const id = Date.now() + Math.random()
    setItems((cur) => [...cur, { id, text, kind }])
    window.setTimeout(() => {
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
