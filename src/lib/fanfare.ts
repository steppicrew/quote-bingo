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
  master.gain.setValueAtTime(0.0001, at)
  master.gain.exponentialRampToValueAtTime(gainPeak, at + attack)
  master.gain.exponentialRampToValueAtTime(sustain, at + attack + 0.08)
  master.gain.setValueAtTime(sustain, at + Math.max(attack + 0.08, dur - release))
  master.gain.exponentialRampToValueAtTime(0.0001, at + dur)

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
    osc.stop(at + dur + 0.05)
  }
}

export type SoundKind = 'off' | 'tadaa' | 'arpeggio'

/**
 * "Ta-daa!" — modelled on a reference recording: a short bright pickup on G4
 * ("ta", ~0.18s), a brief gap, then a sustained C-major chord ("daaa", ~1s)
 * that rings out. G4 -> C major is the classic V->I resolution.
 */
function playTadaa(ac: AudioContext, big: boolean): void {
  const t0 = ac.currentTime + 0.01

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
function playArpeggio(ac: AudioContext, big: boolean): void {
  const t0 = ac.currentTime + 0.01
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

/**
 * Play the chosen win sound plus a vibration. `big` (full card) brightens the
 * sound and strengthens the vibration. No-ops for 'off' or when audio is
 * unavailable.
 */
export function playFanfare(kind: SoundKind, big = false): void {
  if (kind === 'off') return

  const ac = audioCtx()
  if (ac) {
    if (kind === 'tadaa') playTadaa(ac, big)
    else playArpeggio(ac, big)
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(big ? [30, 60, 40, 30, 140] : [25, 60, 90])
  }
}
