import { type QuoteListExport } from '../types'

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

function toExport(name: string, quotes: readonly string[]): QuoteListExport {
  return { version: 1, person: { name }, quotes: [...quotes] }
}

function parseExport(raw: unknown): QuoteListExport {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid list')
  const o = raw as Record<string, unknown>
  const person = o.person as Record<string, unknown> | undefined
  if (o.version !== 1 || !person || typeof person.name !== 'string' || !Array.isArray(o.quotes)) {
    throw new Error('Unrecognised quote list format')
  }
  const quotes = o.quotes.filter((q): q is string => typeof q === 'string')
  return { version: 1, person: { name: person.name }, quotes }
}

// ---- compact string codec (for QR / copy-paste) --------------------------

/** JSON -> gzip -> base64url string. */
export async function encodeList(name: string, quotes: readonly string[]): Promise<string> {
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

export function exportToFile(name: string, quotes: readonly string[]): void {
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

export interface MergeResult {
  quotes: string[]
  added: number
  skipped: number
}

/**
 * Merge incoming quote texts into an existing set, de-duplicating by
 * case-insensitive trimmed text. Existing quotes are preserved as-is.
 */
export function mergeQuotes(existing: readonly string[], incoming: readonly string[]): MergeResult {
  const seen = new Set(existing.map(norm))
  const quotes = [...existing]
  let added = 0
  let skipped = 0
  for (const raw of incoming) {
    const text = raw.trim()
    if (!text) continue
    const key = norm(text)
    if (seen.has(key)) {
      skipped++
    } else {
      seen.add(key)
      quotes.push(text)
      added++
    }
  }
  return { quotes, added, skipped }
}
