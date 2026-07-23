import {
  type BackupData,
  type BackupFile,
  type Card,
  type ExportQuote,
  type Id,
  type Person,
  type Quote,
  type QuoteListExport,
} from '../types'
import { uid } from './id'

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

// ---- multi-QR chunking ----------------------------------------------------
//
// A single encoded list can exceed what one QR reliably scans (QR_MAX_CHARS).
// Split it into an ordered set of QR payloads, each wrapped in a tiny envelope
// so the scanner can group and reassemble them in any order:
//
//   QB1.<group>.<idx>.<total>.<chunk>
//
// The prefix is plain text (not gzipped) so the scanner reads it raw. '.' is
// safe as a separator: it never appears in a base64url body. A single-chunk
// list is returned bare (no envelope) so old scanners stay compatible.

const CHUNK_PREFIX = 'QB1'
/** Envelope overhead worst case: "QB1." + group(4) + "." + idx + "." + total + "." */
const ENVELOPE_MAX = CHUNK_PREFIX.length + 1 + 4 + 1 + 3 + 1 + 3 + 1
/** Body budget per chunk, leaving room for the envelope inside QR_MAX_CHARS. */
const CHUNK_BODY_MAX = QR_MAX_CHARS - ENVELOPE_MAX

const groupId = (): string =>
  Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0')

/**
 * Split an encoded code into scannable QR payloads. Short codes come back as a
 * single bare string (back-compatible); longer codes are wrapped in numbered
 * `QB1.<group>.<idx>.<total>.<chunk>` envelopes.
 */
export function chunkCode(code: string): string[] {
  if (code.length <= QR_MAX_CHARS) return [code]
  const total = Math.ceil(code.length / CHUNK_BODY_MAX)
  const group = groupId()
  const parts: string[] = []
  for (let i = 0; i < total; i++) {
    const body = code.slice(i * CHUNK_BODY_MAX, (i + 1) * CHUNK_BODY_MAX)
    parts.push(`${CHUNK_PREFIX}.${group}.${i}.${total}.${body}`)
  }
  return parts
}

export interface ChunkInfo {
  group: string
  idx: number
  total: number
  body: string
}

/** Parse one scanned payload. Returns null if it is not a chunk envelope. */
export function parseChunk(text: string): ChunkInfo | null {
  const t = text.trim()
  if (!t.startsWith(CHUNK_PREFIX + '.')) return null
  // Split only the 4 header fields; the body may itself be arbitrary base64url.
  const rest = t.slice(CHUNK_PREFIX.length + 1)
  const m = /^([0-9a-z]+)\.(\d+)\.(\d+)\.(.*)$/s.exec(rest)
  if (!m) return null
  const idx = Number(m[2])
  const total = Number(m[3])
  if (!Number.isInteger(idx) || !Number.isInteger(total) || total < 1 || idx >= total) {
    return null
  }
  return { group: m[1]!, idx, total, body: m[4]! }
}

/**
 * Reassemble a full code from collected chunk bodies (keyed by idx). Returns
 * null until every index [0, total) is present.
 */
export function joinChunks(bodies: ReadonlyMap<number, string>, total: number): string | null {
  if (bodies.size < total) return null
  const ordered: string[] = []
  for (let i = 0; i < total; i++) {
    const b = bodies.get(i)
    if (b === undefined) return null
    ordered.push(b)
  }
  return ordered.join('')
}

// ---- plain JSON file IO --------------------------------------------------

function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportToFile(name: string, quotes: readonly ExportQuote[]): void {
  const json = JSON.stringify(toExport(name, quotes), null, 2)
  downloadJson(json, `bingo-${name.replace(/[^\w-]+/g, '_')}.json`)
}

export async function importFromFile(file: File): Promise<QuoteListExport> {
  return parseExport(JSON.parse(await file.text()))
}

// ---- full backup (export/import all data) --------------------------------

/** Download the complete app state as a backup file. */
export function exportBackup(state: BackupData): void {
  const file: BackupFile = { app: 'quote-bingo-backup', version: 1, state }
  const date = new Date().toISOString().slice(0, 10)
  downloadJson(JSON.stringify(file, null, 2), `bingo-backup-${date}.json`)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Validate + parse a backup file into restorable state. Throws if malformed. */
export function parseBackup(raw: unknown): BackupData {
  if (!isRecord(raw) || raw.app !== 'quote-bingo-backup' || raw.version !== 1) {
    throw new Error('Unrecognised backup file')
  }
  const st = raw.state
  if (
    !isRecord(st) ||
    !Array.isArray(st.persons) ||
    !Array.isArray(st.quotes) ||
    !isRecord(st.cards)
  ) {
    throw new Error('Unrecognised backup file')
  }
  // Settings are validated against their unions in store.restoreBackup, so a
  // loose cast here is fine; a hand-edited/garbage value falls back on restore.
  return {
    persons: st.persons as Person[],
    quotes: st.quotes as Quote[],
    cards: st.cards as Record<Id, Card>,
    activePersonId: typeof st.activePersonId === 'string' ? st.activePersonId : null,
    theme: st.theme as BackupData['theme'],
    locale: st.locale as BackupData['locale'],
    soundMode: st.soundMode as BackupData['soundMode'],
    soundKind: st.soundKind as BackupData['soundKind'],
  }
}

export async function importBackupFile(file: File): Promise<BackupData> {
  return parseBackup(JSON.parse(await file.text()))
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
