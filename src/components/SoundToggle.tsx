import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store'
import type { SoundMode } from '../types'
import { useToast } from './toast-context'
import { SoundOffIcon, SoundOnIcon, SoundVibrateIcon } from './icons'

const soundModeLabelKey: Record<SoundMode, string> = {
  on: 'settings.soundOn',
  vibrate: 'settings.soundVibrate',
  off: 'settings.soundOff',
}

// Cycles sound mode and announces the mode it just switched *to*. The icon
// alone is ambiguous — a speaker glyph reads equally well as "sound is on" and
// "tap for sound" — so the toast names the state that is now in effect.
export function SoundToggle(): ReactNode {
  const { t } = useTranslation()
  const soundMode = useStore((s) => s.soundMode)
  const cycleSoundMode = useStore((s) => s.cycleSoundMode)
  const toast = useToast()

  const label = t('app.nav.sound', { state: t(soundModeLabelKey[soundMode]) })

  return (
    <button
      className="icon-btn"
      aria-label={label}
      title={label}
      onClick={() => {
        // Read the mode back from the store: cycleSoundMode owns the order, so
        // deriving "next" here would duplicate it and could drift.
        cycleSoundMode()
        const next = useStore.getState().soundMode
        toast(t('app.toast.sound', { state: t(soundModeLabelKey[next]) }))
      }}
    >
      {soundMode === 'on' ? (
        <SoundOnIcon />
      ) : soundMode === 'vibrate' ? (
        <SoundVibrateIcon />
      ) : (
        <SoundOffIcon />
      )}
    </button>
  )
}
