// Dependency-free win fanfare synthesised with the Web Audio API (no asset
// file, so it works fully offline) plus an optional vibration pattern. The
// caller gates playback on the persisted `sound` setting.

let ctx: AudioContext | null = null

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  // Autoplay policies suspend the context until a user gesture; toggling a cell
  // (which triggers a win) counts as one, so resume is safe here.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Play one note: a detuned two-oscillator blip with a short A/D envelope. */
function note(ac: AudioContext, freq: number, at: number, dur: number, gainPeak: number): void {
  const master = ac.createGain()
  master.connect(ac.destination)
  // A/D/S/R: fast attack, brief dip to a sustain plateau held for most of the
  // note, then a release only at the very end. A plain exponential decay over
  // `dur` sounds like a short pluck no matter how long dur is — the plateau is
  // what makes a note read as a long, held "taaa".
  const attack = 0.03
  const release = Math.min(0.25, dur * 0.4)
  const sustain = gainPeak * 0.7
  // A final short linear fade to *true* zero avoids the click ("nack") an
  // exponential ramp leaves: it can only reach a tiny floor, so cutting the
  // oscillator there leaves a discontinuity. Ramp exp to the floor slightly
  // early, then linearly to 0, and stop the oscillator exactly at 0.
  const tail = 0.012
  const end = at + dur
  master.gain.setValueAtTime(0.0001, at)
  master.gain.exponentialRampToValueAtTime(gainPeak, at + attack)
  master.gain.exponentialRampToValueAtTime(sustain, at + attack + 0.08)
  master.gain.setValueAtTime(sustain, at + Math.max(attack + 0.08, dur - release))
  master.gain.exponentialRampToValueAtTime(0.0008, end - tail)
  master.gain.linearRampToValueAtTime(0, end)

  for (const [type, detune] of [
    ['triangle', -6],
    ['square', 6],
  ] as const) {
    const osc = ac.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, at)
    osc.detune.setValueAtTime(detune, at)
    const g = ac.createGain()
    g.gain.setValueAtTime(type === 'square' ? 0.35 : 1, at)
    osc.connect(g)
    g.connect(master)
    osc.start(at)
    osc.stop(end) // stop exactly when the gain reaches 0
  }
}

/** How a win is celebrated. */
export type SoundMode = 'on' | 'vibrate' | 'off'
/** Which fanfare plays when the mode is 'on'. */
export type SoundKind = 'tadaa' | 'arpeggio'

/**
 * "Ta-daa!" — modelled on a reference recording: a short bright pickup on G4
 * ("ta", ~0.18s), a brief gap, then a sustained C-major chord ("daaa", ~1s)
 * that rings out. G4 -> C major is the classic V->I resolution.
 */
function playTadaa(ac: AudioContext, big: boolean, t0: number): void {
  // "ta" — short, bright pickup on G4 (root + overtones like the reference).
  note(ac, 392.0, t0, 0.18, 0.2)
  note(ac, 783.99, t0, 0.16, 0.06) // octave sparkle

  // "daaa" — C major (C5 E5 G5) held and ringing, after a short gap.
  const daa = t0 + 0.24
  const dur = big ? 1.35 : 1.05
  for (const freq of [523.25, 659.25, 783.99]) note(ac, freq, daa, dur, 0.2)
  note(ac, 261.63, daa, dur, 0.14) // C4 root underneath adds body
  note(ac, 1046.5, daa, dur * 0.8, 0.09) // C6 overtone for brightness

  if (big) {
    note(ac, 1318.51, daa + 0.05, dur - 0.2, 0.12)
    note(ac, 1567.98, daa + 0.1, dur - 0.3, 0.1)
  }
}

/** Rising C major arpeggio (C5 E5 G5 C6) into a held top note. */
function playArpeggio(ac: AudioContext, big: boolean, t0: number): void {
  const seq: [number, number][] = [
    [523.25, 0.0],
    [659.25, 0.09],
    [783.99, 0.18],
    [1046.5, 0.27],
  ]
  for (const [freq, off] of seq) note(ac, freq, t0 + off, 0.18, 0.22)
  note(ac, 1046.5, t0 + 0.42, big ? 0.6 : 0.4, 0.26)
  if (big) {
    note(ac, 1318.51, t0 + 0.52, 0.5, 0.2)
    note(ac, 1567.98, t0 + 0.62, 0.5, 0.18)
  }
}

// Seconds between the start of consecutive repeats, per sound.
const REPEAT_GAP: Record<SoundKind, number> = {
  tadaa: 0.72,
  arpeggio: 0.5,
}

/**
 * Celebrate a win. `mode` gates it: 'off' does nothing, 'vibrate' fires only
 * haptics, 'on' plays the `kind` fanfare plus haptics. `big` (full card)
 * brightens the sound and strengthens the vibration; `times` repeats it
 * back-to-back (e.g. 2 for a double bingo).
 *
 * Note: the web can't read the phone's ringer/silent switch, so 'on' plays
 * audio regardless of system mute — 'vibrate'/'off' are the manual opt-outs.
 */
export function playFanfare(
  mode: SoundMode,
  kind: SoundKind,
  big = false,
  times = 1,
): void {
  if (mode === 'off') return
  const reps = Math.max(1, times)

  if (mode === 'on') {
    const ac = audioCtx()
    if (ac) {
      const gap = REPEAT_GAP[kind]
      for (let i = 0; i < reps; i++) {
        const at = ac.currentTime + 0.01 + i * gap
        if (kind === 'tadaa') playTadaa(ac, big, at)
        else playArpeggio(ac, big, at)
      }
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    const one = big ? [30, 60, 40, 30, 140] : [25, 60, 90]
    const pattern: number[] = []
    for (let i = 0; i < reps; i++) pattern.push(...one, 120)
    navigator.vibrate(pattern)
  }
}
