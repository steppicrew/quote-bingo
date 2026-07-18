import { type ExportQuote, type QuoteListExport } from '../types'

const uid = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** Practical char budget for a QR payload that mid-tier phones can still scan. */
export const QR_MAX_CHARS = 800

// ---- base64url helpers (no padding) --------------------------------------

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// ---- gzip via CompressionStream ------------------------------------------

async function gzip(input: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip')
  const stream = new Blob([input as BlobPart]).stream().pipeThrough(cs)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzip(input: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip')
  const stream = new Blob([input as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// ---- validation ----------------------------------------------------------

function toExport(name: string, quotes: readonly ExportQuote[]): QuoteListExport {
  return { version: 2, person: { name }, quotes: quotes.map((q) => ({ id: q.id, text: q.text })) }
}

function parseExport(raw: unknown): QuoteListExport {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid list')
  const o = raw as Record<string, unknown>
  const person = o.person as Record<string, unknown> | undefined
  if (!person || typeof person.name !== 'string' || !Array.isArray(o.quotes)) {
    throw new Error('Unrecognised quote list format')
  }
  let quotes: ExportQuote[]
  if (o.version === 2) {
    // v2: objects with id + text.
    quotes = o.quotes
      .filter((q): q is Record<string, unknown> => typeof q === 'object' && q !== null)
      .filter((q) => typeof q.text === 'string' && q.text.trim() !== '')
      .map((q) => ({
        id: typeof q.id === 'string' && q.id ? q.id : uid(),
        text: q.text as string,
      }))
  } else if (o.version === 1) {
    // v1: plain strings — mint a fresh id for each so they can be tracked later.
    quotes = o.quotes
      .filter((q): q is string => typeof q === 'string' && q.trim() !== '')
      .map((text) => ({ id: uid(), text }))
  } else {
    throw new Error('Unrecognised quote list format')
  }
  return { version: 2, person: { name: person.name }, quotes }
}

// ---- compact string codec (for QR / copy-paste) --------------------------

/** JSON -> gzip -> base64url string. */
export async function encodeList(name: string, quotes: readonly ExportQuote[]): Promise<string> {
  const json = JSON.stringify(toExport(name, quotes))
  const gz = await gzip(new TextEncoder().encode(json))
  return bytesToBase64url(gz)
}

/** base64url -> gunzip -> JSON. */
export async function decodeList(code: string): Promise<QuoteListExport> {
  const bytes = base64urlToBytes(code.trim())
  const json = new TextDecoder().decode(await gunzip(bytes))
  return parseExport(JSON.parse(json))
}

// ---- plain JSON file IO --------------------------------------------------

export function exportToFile(name: string, quotes: readonly ExportQuote[]): void {
  const json = JSON.stringify(toExport(name, quotes), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bingo-${name.replace(/[^\w-]+/g, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importFromFile(file: File): Promise<QuoteListExport> {
  return parseExport(JSON.parse(await file.text()))
}

// ---- merge / dedupe ------------------------------------------------------

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()

/** An id-carrying quote (a stored Quote or an ExportQuote) — merge works on both. */
export interface IdQuote {
  id: string
  text: string
}

export interface MergeResult {
  /** Reconciled quotes in order: existing (possibly edited) first, then new. */
  quotes: IdQuote[]
  added: number
  updated: number
  skipped: number
}

/**
 * Reconcile incoming shared quotes into an existing set, matching **by id
 * first, then by text**:
 *  - id matches → update the text if it changed (edits propagate), same id kept
 *  - id unknown but text already present → skip (dedupe)
 *  - id unknown and text new → append (reusing the incoming id)
 *
 * Existing quote ids are never changed, so any card cells referencing them stay
 * valid. Returns the full reconciled list plus counts.
 */
export function mergeQuotes(
  existing: readonly IdQuote[],
  incoming: readonly IdQuote[],
): MergeResult {
  const quotes: IdQuote[] = existing.map((q) => ({ id: q.id, text: q.text }))
  const byId = new Map(quotes.map((q, i) => [q.id, i]))
  const textIndex = new Map(quotes.map((q, i) => [norm(q.text), i]))

  let added = 0
  let updated = 0
  let skipped = 0

  for (const inc of incoming) {
    const text = inc.text.trim()
    if (!text) continue
    const key = norm(text)
    const idHit = byId.get(inc.id)

    if (idHit !== undefined) {
      // Same lineage: propagate an edit, keep the id (and card references).
      const textHit = textIndex.get(key)
      if (norm(quotes[idHit]!.text) === key) {
        skipped++ // unchanged
      } else if (textHit !== undefined && textHit !== idHit) {
        // Edited text collides with a *different* existing quote — applying it
        // would create a duplicate, so skip rather than duplicate.
        skipped++
      } else {
        textIndex.delete(norm(quotes[idHit]!.text))
        quotes[idHit] = { id: inc.id, text }
        textIndex.set(key, idHit)
        updated++
      }
    } else if (textIndex.has(key)) {
      // Different lineage, same text: keep the existing one untouched.
      skipped++
    } else {
      const i = quotes.length
      quotes.push({ id: inc.id, text })
      byId.set(inc.id, i)
      textIndex.set(key, i)
      added++
    }
  }

  return { quotes, added, updated, skipped }
}
