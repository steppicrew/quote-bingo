import { createContext, useContext } from 'react'

export type ToastKind = 'info' | 'win'
export type PushToast = (text: string, kind?: ToastKind) => void

export const ToastCtx = createContext<PushToast>(() => {})

export function useToast(): PushToast {
  return useContext(ToastCtx)
}
