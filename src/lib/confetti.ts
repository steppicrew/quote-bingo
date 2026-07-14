// Dependency-free confetti burst on a full-screen canvas overlay. Draws
// tumbling ribbons/rectangles under gravity, then removes its canvas. Honors
// prefers-reduced-motion (no-op).

const COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#eab308']
// Gold-heavy palette for the bigger (full-card) celebration.
const GOLD = ['#ffd700', '#f59e0b', '#fff4b8', '#eab308', '#ffcc33', '#fde68a']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  color: string
  rot: number
  vrot: number
}

interface Options {
  /** Particle-count multiplier. */
  intensity?: number
  /** Use the gold palette and a second delayed burst. */
  gold?: boolean
}

function spawn(W: number, H: number, count: number, palette: string[]): Particle[] {
  return Array.from({ length: count }, () => {
    const fromLeft = Math.random() < 0.5
    const ribbon = Math.random() < 0.35
    const size = 5 + Math.random() * 6
    return {
      x: fromLeft ? 0 : W,
      y: H * (0.5 + Math.random() * 0.4),
      vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 9),
      vy: -(9 + Math.random() * 10),
      w: size,
      h: ribbon ? size * 1.8 : size * 0.6,
      color: palette[Math.floor(Math.random() * palette.length)]!,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.5,
    }
  })
}

/** Fire a confetti burst. */
export function confetti(opts: number | Options = 1): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const { intensity = 1, gold = false } = typeof opts === 'number' ? { intensity: opts } : opts

  const canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  document.body.appendChild(canvas)

  const dpr = window.devicePixelRatio || 1
  const resize = (): void => {
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()

  const W = window.innerWidth
  const H = window.innerHeight
  const palette = gold ? GOLD : COLORS
  const parts = spawn(W, H, Math.round(140 * intensity), palette)
  // A gold celebration gets a second, delayed pop for extra drama.
  let secondFired = !gold

  const gravity = 0.3
  const drag = 0.99
  const start = performance.now()
  const durationMs = gold ? 3200 : 2600

  const frame = (now: number): void => {
    const elapsed = now - start
    if (!secondFired && elapsed > 450) {
      secondFired = true
      parts.push(...spawn(W, H, Math.round(90 * intensity), palette))
    }
    ctx.clearRect(0, 0, W, H)
    for (const p of parts) {
      p.vx *= drag
      p.vy = p.vy * drag + gravity
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vrot
      const fade = Math.max(0, 1 - elapsed / durationMs)
      ctx.save()
      ctx.globalAlpha = fade
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (elapsed < durationMs) {
      requestAnimationFrame(frame)
    } else {
      window.removeEventListener('resize', resize)
      canvas.remove()
    }
  }

  window.addEventListener('resize', resize)
  requestAnimationFrame(frame)
}
