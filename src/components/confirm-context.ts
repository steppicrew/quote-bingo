import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  /** Question shown in the dialog body. */
  message: string
  /** Label of the confirming button; defaults to a generic OK. */
  confirmLabel?: string
  /** Marks the action as destructive so the button is styled as a warning. */
  danger?: boolean
}

/**
 * Ask the user to confirm, resolving true/false — a drop-in shape for the
 * `window.confirm` calls this replaces, so `if (await confirm(...))` reads the
 * same at every call site.
 */
export type AskConfirm = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmCtx = createContext<AskConfirm>(() => Promise.resolve(false))

export function useConfirm(): AskConfirm {
  return useContext(ConfirmCtx)
}
