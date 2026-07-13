// Dependency-free confetti burst on a full-screen canvas overlay.
// Draws colored rectangles under gravity for a short duration, then
// removes its canvas. Honors prefers-reduced-motion (no-op).

const COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#eab308']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rot: number
  vrot: number
}

/** Fire a confetti burst. `intensity` scales particle count. */
export function confetti(intensity = 1): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

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
  const count = Math.round(120 * intensity)
  const parts: Particle[] = Array.from({ length: count }, () => {
    const fromLeft = Math.random() < 0.5
    return {
      x: fromLeft ? 0 : W,
      y: H * (0.5 + Math.random() * 0.4),
      vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 8),
      vy: -(9 + Math.random() * 9),
      size: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.4,
    }
  })

  const gravity = 0.32
  const drag = 0.99
  const start = performance.now()
  const durationMs = 2600

  const frame = (now: number): void => {
    const elapsed = now - start
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
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
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
