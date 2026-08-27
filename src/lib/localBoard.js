// Crash-safe local persistence. The server autosave is debounced and can fail
// (offline, request too large, tab closed mid-flight), so before anything reaches
// the server we mirror the board on THIS device. On reload we restore it exactly -
// content and the precise viewport (zoom/pan) - so an accidental refresh or a
// dropped connection costs at most the last change, never the session.
//
// Split by weight: the heavy content snapshot (base64 images, up to a few MB) goes
// to IndexedDB, which has a large quota; the tiny viewport ({x,y,zoom}) goes to
// localStorage so it can be written cheaply on every pan without rewriting the
// images. Everything is best-effort - a storage failure never throws into the UI.

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

const vpKey = (id) => `fx:vp:${id}`
export function saveViewport(id, vp) {
  try { localStorage.setItem(vpKey(id), JSON.stringify(vp)) } catch { /* quota / private mode */ }
}
export function loadViewport(id) {
  try { const v = localStorage.getItem(vpKey(id)); return v ? JSON.parse(v) : null } catch { return null }
}
