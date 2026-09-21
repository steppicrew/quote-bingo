import { useEffect, useState } from 'react'

export type Route =
  | { name: 'manage' }
  | { name: 'person'; id: string }
  | { name: 'privacy' }
  | { name: 'game' }

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h === 'manage') return { name: 'manage' }
  if (h === 'privacy') return { name: 'privacy' }
  const m = /^person\/(.+)$/.exec(h)
  if (m) return { name: 'person', id: decodeURIComponent(m[1]!) }
  return { name: 'game' } // default / start page
}

function hashFor(route: Route): string {
  switch (route.name) {
    case 'game':
      return '#/'
    case 'manage':
      return '#/manage'
    case 'privacy':
      return '#/privacy'
    case 'person':
      return `#/person/${encodeURIComponent(route.id)}`
  }
}

export function navigate(route: Route): void {
  const hash = hashFor(route)
  if (window.location.hash !== hash) window.location.hash = hash
}

/**
 * Navigate by overwriting the current history entry instead of pushing one.
 *
 * For every move that goes *down* a level rather than deeper: an in-app back
 * button, a redirect the user did not ask for, or an overlay handing over to a
 * route (Settings → Privacy). Pushing in those cases puts the thing you just
 * left in front of the Back button, so Back walks forward.
 *
 * The replaced entry may be a modal's own pushed entry, whose `{modal:true}`
 * state must go with it: `useModalDismiss` reads that state to decide whether
 * it still owns an entry to pop, and a stale one makes the unmounting modal pop
 * the route we just navigated to.
 */
export function replaceRoute(route: Route): void {
  const hash = hashFor(route)
  if (window.location.hash === hash) return
  history.replaceState(null, '', hash)
  // replaceState fires neither hashchange nor popstate, so useRoute would keep
  // rendering the old route against the new URL. Tell it explicitly.
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = (): void => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
