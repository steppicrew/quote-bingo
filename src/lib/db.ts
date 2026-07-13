import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { type StateStorage } from 'zustand/middleware'

/**
 * Single key/value store used to back Zustand's `persist` middleware.
 * Zustand serialises the whole persisted slice to one JSON string, so a plain
 * kv store is all we need — no per-entity object stores.
 */
interface BingoDB extends DBSchema {
  keyval: {
    key: string
    value: string
  }
}

const DB_NAME = 'quote-bingo'
const DB_VERSION = 1
const STORE = 'keyval'

let dbPromise: Promise<IDBPDatabase<BingoDB>> | null = null

function getDB(): Promise<IDBPDatabase<BingoDB>> {
  dbPromise ??= openDB<BingoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE)
    },
  })
  return dbPromise
}

/** IndexedDB-backed storage adapter for Zustand `persist`. */
export const idbStorage: StateStorage = {
  async getItem(name) {
    return (await (await getDB()).get(STORE, name)) ?? null
  },
  async setItem(name, value) {
    await (await getDB()).put(STORE, value, name)
  },
  async removeItem(name) {
    await (await getDB()).delete(STORE, name)
  },
}
