import { useEffect, useRef } from 'react'

/**
 * Make a modal dismissable via the phone/browser Back button and the Escape
 * key, without disturbing the app's hash router.
 *
 * On mount we push a throwaway history entry. A real Back press pops it, firing
 * `popstate`, which calls `onClose`. When the modal is closed from the UI
 * (backdrop / ✕ / an action), the cleanup pops our own entry with
 * `history.back()`.
 *
 * `history.back()` is asynchronous: its `popstate` fires on a later tick, by
 * which point React 18 StrictMode may have re-run the effect and attached a
 * fresh listener that would otherwise treat the self-pop as a user Back and
 * close immediately. `suppressNextPop` (module-level, shared across mounts)
 * swallows exactly that one self-initiated popstate.
 */
let suppressNextPop = false

export function useModalDismiss(onClose: () => void): void {
  // Keep the latest onClose without re-subscribing listeners each render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    history.pushState({ modal: true }, '')

    const onPop = (): void => {
      if (suppressNextPop) {
        suppressNextPop = false
        return
      }
      onCloseRef.current()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseRef.current()
    }

    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      // Pop the entry we pushed only if it is still the current one (UI-driven
      // close). Suppress the resulting popstate so a freshly-mounted instance
      // (StrictMode) doesn't mistake it for a user Back press.
      const state: unknown = history.state
      if (state !== null && typeof state === 'object' && 'modal' in state) {
        suppressNextPop = true
        history.back()
      }
    }
  }, [])
}
