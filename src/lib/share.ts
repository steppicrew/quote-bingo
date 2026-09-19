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

/**
 * Practical char budget for a QR payload that mid-tier phones can still scan.
 *
 * 800 produced a version-18 symbol: 89x89 modules, about 3.1px per module on
 * the old 288px canvas before the camera is even involved. That reads as a
 * very fine grid, and people reported codes that simply would not scan.
 *
 * Measured across budgets at the current canvas (340px) with 25% error
 * correction, 420 lands on version 15 — 77x77 modules, ~4.2px per module, a
 * third more than before. Raising it to 500 costs a whole version for no
 * fewer codes on a typical list, and dropping to 300 buys little and adds a
 * fifth code.
 *
 * The cost is more chunks per list (a 31-quote list goes from 2 codes to 3),
 * and that is the right trade: an extra code to scan is a minor annoyance, a
 * code that will not scan is a dead end.
 */
export const QR_MAX_CHARS = 420

/**
 * Error correction level for the codes we render.
 *
 * 'M' (15%) is the library default. 'Q' (25%) survives a glare spot, a crease
 * or a partly-obscured code, which is exactly how these get scanned — one
 * phone held over another. It costs symbol size, which is why the payload
 * budget above came down at the same time.
 */
export const QR_ERROR_CORRECTION = 'Q' as const

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
export function chunkCode(code: string, bodyMax: number = CHUNK_BODY_MAX): string[] {
  if (code.length <= bodyMax + ENVELOPE_MAX && code.length <= QR_MAX_CHARS) return [code]

  const total = Math.ceil(code.length / bodyMax)

  // Spread the payload evenly instead of filling each chunk to the brim and
  // leaving the remainder in the last one. Greedy packing produced sets like
  // 403 + 27: a dense code that is hard to scan next to a nearly empty one, for
  // no benefit — the number of codes is identical either way. Even chunks are
  // all as sparse as the set allows, so every code in it scans as easily as
  // the easiest one would have.
  const base = Math.floor(code.length / total)
  const extra = code.length % total

  const group = groupId()
  const parts: string[] = []
  let at = 0
  for (let i = 0; i < total; i++) {
    // The first `extra` chunks take one more character, so the sizes differ by
    // at most one and nothing is left over.
    const size = base + (i < extra ? 1 : 0)
    parts.push(`${CHUNK_PREFIX}.${group}.${i}.${total}.${code.slice(at, at + size)}`)
    at += size
  }
  return parts
}

/**
 * Body budgets offered by the "smaller codes" button, densest first.
 *
 * Splitting further is the lever a user has when a code will not scan — an
 * older camera, a cracked screen, bad light. Each step roughly halves the
 * payload, and the floor stops the list fragmenting into more codes than
 * anyone would want to scan in sequence.
 */
export const CHUNK_BODY_STEPS: readonly number[] = [
  CHUNK_BODY_MAX,
  Math.floor(CHUNK_BODY_MAX / 2),
  Math.floor(CHUNK_BODY_MAX / 3),
  Math.floor(CHUNK_BODY_MAX / 5),
]

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

/** A parsed import, tagged with which of the two JSON formats it turned out to be. */
export type AnyImport =
  | { kind: 'list'; data: QuoteListExport }
  | { kind: 'backup'; data: BackupData }

/**
 * Parse either export format from one file.
 *
 * A quote list and a full backup are both JSON, and a file arriving from a
 * download, a share sheet or a file manager carries no hint of which it is —
 * so detect it here rather than making the user pick the matching button.
 * Throws if it is neither.
 */
export async function importAnyFile(file: File): Promise<AnyImport> {
  const raw: unknown = JSON.parse(await file.text())
  if (isRecord(raw) && raw.app === 'quote-bingo-backup') {
    return { kind: 'backup', data: parseBackup(raw) }
  }
  return { kind: 'list', data: parseExport(raw) }
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
