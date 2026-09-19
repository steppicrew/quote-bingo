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

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = (): void => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
