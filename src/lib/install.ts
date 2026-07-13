import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// The browser fires `beforeinstallprompt` once, possibly before React mounts,
// so we stash the latest event on the module.
let deferred: BeforeInstallPromptEvent | null = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  window.dispatchEvent(new Event('pwa-installable'))
})

window.addEventListener('appinstalled', () => {
  deferred = null
  window.dispatchEvent(new Event('pwa-installable'))
})

/** True when the app is already running as an installed PWA. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export interface InstallState {
  /** Prompt is available and app is not already installed. */
  canInstall: boolean
  /** Trigger the native install prompt; resolves to whether it was accepted. */
  promptInstall: () => Promise<boolean>
}

export function useInstall(): InstallState {
  const [canInstall, setCanInstall] = useState<boolean>(
    () => deferred !== null && !isStandalone(),
  )

  useEffect(() => {
    const update = (): void => setCanInstall(deferred !== null && !isStandalone())
    window.addEventListener('pwa-installable', update)
    return () => window.removeEventListener('pwa-installable', update)
  }, [])

  const promptInstall = async (): Promise<boolean> => {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    setCanInstall(false)
    return outcome === 'accepted'
  }

  return { canInstall, promptInstall }
}
