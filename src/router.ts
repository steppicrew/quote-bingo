import { useEffect, useState } from 'react'

export type Route =
  | { name: 'manage' }
  | { name: 'person'; id: string }
  | { name: 'game' }

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h === 'manage') return { name: 'manage' }
  const m = /^person\/(.+)$/.exec(h)
  if (m) return { name: 'person', id: decodeURIComponent(m[1]!) }
  return { name: 'game' } // default / start page
}

export function navigate(route: Route): void {
  const hash =
    route.name === 'game'
      ? '#/'
      : route.name === 'manage'
        ? '#/manage'
        : `#/person/${encodeURIComponent(route.id)}`
  if (window.location.hash !== hash) window.location.hash = hash
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
