import { type Id } from '../types'

/**
 * Generate a short, opaque id (base36, ~8 chars). Ids are only unique within a
 * person's quote set (a small pool), so full UUIDs are wasteful — they also
 * dominate the share payload and defeat gzip (random UUID = max entropy). A
 * 48-bit random space (36^8 ≈ 2.8e12) makes collisions effectively impossible
 * at these sizes while keeping the QR payload small.
 */
export function uid(): Id {
  const rnd = Math.floor(Math.random() * 36 ** 8)
    .toString(36)
    .padStart(8, '0')
  return rnd
}
