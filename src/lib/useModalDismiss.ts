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
 * close immediately. `pendingSelfPops` (module-level, shared across mounts)
 * swallows those self-initiated popstates.
 *
 * A modal that hands over to a route (Settings → #/privacy) must not close
 * itself first: popping our entry and then pushing the route races the
 * traversal, which lands last and wins. Such a modal calls `replaceRoute`
 * instead, overwriting its own entry with the route — no traversal, and the
 * cleanup below then sees no `modal` state and correctly pops nothing.
 */
/**
 * Self-initiated pops still in flight. `history.back()` is async, and with
 * modals nested (a confirm over Settings) StrictMode can have two cleanups
 * pop within the same tick — a single boolean would suppress only the first
 * and let the second read as a user Back, closing a dialog the moment it
 * opened. Counting them keeps every self-pop accounted for.
 */
let pendingSelfPops = 0

/**
 * Every mounted modal, in mount order. Modals nest — a confirm dialog opens on
 * top of Settings — and both a Back press and Escape are single events seen by
 * every listener, so without this the two would close together. Only the last
 * entry, the one actually on top, acts on a dismissal.
 */
const stack: symbol[] = []

export function useModalDismiss(onClose: () => void): void {
  // Keep the latest onClose without re-subscribing listeners each render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    history.pushState({ modal: true }, '')
    const token = Symbol('modal')
    stack.push(token)
    const isTop = (): boolean => stack[stack.length - 1] === token

    const onPop = (): void => {
      if (pendingSelfPops > 0) {
        pendingSelfPops -= 1
        return
      }
      if (!isTop()) return
      onCloseRef.current()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isTop()) onCloseRef.current()
    }

    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      const at = stack.lastIndexOf(token)
      if (at !== -1) stack.splice(at, 1)
      // Pop the entry we pushed only if it is still the current one (UI-driven
      // close). Suppress the resulting popstate so a freshly-mounted instance
      // (StrictMode) doesn't mistake it for a user Back press.
      const state: unknown = history.state
      if (state !== null && typeof state === 'object' && 'modal' in state) {
        pendingSelfPops += 1
        history.back()
      }
    }
  }, [])
}
