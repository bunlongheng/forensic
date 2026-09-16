// Crash-safe local persistence. The server autosave is debounced and can fail
// (offline, request too large, tab closed mid-flight), so before anything reaches
// the server we mirror the board's CONTENT on THIS device. On reload we restore it
// exactly, so an accidental refresh or a dropped connection costs at most the last
// change, never the session. (The viewport is not stored: a board always opens
// fitted to view - see useBoardPersistence.)
//
// The snapshot is heavy (base64 images, up to a few MB), so it goes to IndexedDB
// and its large quota. Everything is best-effort - a storage failure never throws
// into the UI.

const DB = 'forensic'
const STORE = 'drafts'
let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  // Do NOT cache a rejection. Safari can fail indexedDB.open transiently right
  // after launch; caching that failure silently disabled every draft write for
  // the rest of the session, while the save pill still promised the work was
  // "safe on this device". Clearing it lets the next call try again.
  dbPromise.catch(() => { dbPromise = null })
  return dbPromise
}

function tx(mode, run) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const rq = run(t.objectStore(STORE))
        t.oncomplete = () => resolve(rq && rq.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      })
  )
}

// draft = { snapshot: string, ts: number } keyed by board id.
export const saveDraft = (id, draft) => tx('readwrite', (s) => s.put(draft, id)).catch(() => {})
export const loadDraft = (id) => tx('readonly', (s) => s.get(id)).catch(() => null)
export const clearDraft = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {})
