import { useCallback, useEffect, useRef, useState } from 'react'
import { updateBoard } from '../lib/api.js'
import { saveDraft, loadDraft, clearDraft } from '../lib/localBoard.js'
import { boardSnapshot } from '../lib/boardGraph.js'

// A board this large would blow past most hosts' request-body limit (and the
// server's own 413), so we refuse to even try and tell the owner why instead of
// spinning on a save that can never land.
const MAX_NODES_BYTES = 4_000_000 // mirrors lib/validate.js

// Byte size of a draft's nodes, using the same measure as the save guard.
// A corrupt draft counts as infinite so it is never preferred.
function draftNodesBytes(snapshot) {
  try { return JSON.stringify(JSON.parse(snapshot).nodes || []).length } catch { return Infinity }
}

// Everything that gets a board from memory to somewhere durable, owner only:
//   - debounced autosave to the server (only when DURABLE content changes)
//   - a fast local draft on this device (crash / offline safety)
//   - a retry the moment the connection returns
//   - Cmd/Ctrl+S to force a save
//   - restore-on-open: bring back an unsynced draft, then frame the board
// Returns the save state for the pill.
export function useBoardPersistence({ board, canEdit, snapshot, restore, fitView, showToast, makeThumb }) {
  const [save, setSave] = useState('idle') // idle | saving | saved | error | toolarge | unauth
  const savedSnap = useRef(null)
  const restoreReady = useRef(false)
  const thumbBusy = useRef(false)
  const snapRef = useRef(snapshot)   // the latest snapshot, for the clearDraft guard
  const queued = useRef(null)        // the next save to run once the current one lands
  const running = useRef(false)

  // The gallery card is a real snapshot of the canvas. Capturing it costs
  // 150-600ms of main thread on a heavy board, so it runs ONLY on an explicit
  // Cmd/Ctrl+S - never on autosave, and never on a timer. The card can therefore
  // lag behind the board, which is the deliberate trade: no background capture
  // ever stutters an edit, and no idle tab quietly hammers the server.
  // It rides its own tiny PUT (thumbnail only, no nodes), so a board too large to
  // sync its content still keeps a card. Best-effort: a failed capture is never
  // worth a toast, and never blocks or fails the save itself.
  const pushThumb = useCallback(async () => {
    if (!makeThumb || !board.id || thumbBusy.current) return
    thumbBusy.current = true
    try {
      const thumbnail = await makeThumb()
      if (thumbnail) await updateBoard(board.id, { thumbnail })
    } catch { /* best effort */ }
    finally { thumbBusy.current = false }
  }, [makeThumb, board.id])

  // Single place that actually pushes a snapshot to the server: the size guard,
  // the PUT, and the bookkeeping (savedSnap / local draft / save state) that the
  // debounced save, the online retry and Cmd+S all used to duplicate.
  const sendOne = useCallback(async (snap, { toast } = {}) => {
    const body = JSON.parse(snap)
    // Same measure as lib/validate.js (nodes only, 4 MB) so the pill and the 400 agree.
    if (JSON.stringify(body.nodes).length > MAX_NODES_BYTES) { setSave('toolarge'); return }
    setSave('saving')
    try {
      await updateBoard(board.id, body)
      savedSnap.current = snap
      // Only drop the device's safety net when what we just stored IS the current
      // board. Clearing unconditionally deleted the draft of an edit made WHILE
      // the request was in flight, so an offline pill could claim "safe on this
      // device" with nothing actually on the device.
      if (snap === snapRef.current) clearDraft(board.id)
      setSave('saved')
      if (toast) showToast(toast)
    } catch (e) {
      // No HTTP status (or the browser says so) = offline. Anything else is the
      // server refusing the save - say that, not 'offline'.
      if (e?.status === 413) setSave('toolarge')
      else if (e?.status === 401) setSave('unauth')
      else if (!e?.status || navigator.onLine === false) setSave('error')
      else setSave('failed')
    }
  }, [board.id, showToast])

  // Saves are SERIALIZED, never fired in parallel. Two overlapping PUTs have no
  // ordering guarantee: a slow save of an older snapshot could land after a newer
  // one and overwrite it, while the pill happily said "Saved". Only one request is
  // ever in flight, and whatever arrives while it runs collapses into a single
  // follow-up carrying the NEWEST state.
  const push = useCallback(async (snap, opts) => {
    queued.current = { snap, opts }
    if (running.current) return
    running.current = true
    try {
      while (queued.current) {
        const next = queued.current
        queued.current = null
        await sendOne(next.snap, next.opts)
      }
    } finally { running.current = false }
  }, [sendOne])

  // Persist only when the durable content changes. `snapshot` strips selection /
  // drag / hover state, so merely opening or clicking a board never re-saves and
  // never bumps its gallery order.
  useEffect(() => {
    snapRef.current = snapshot
    if (!canEdit || !board.id) return
    if (savedSnap.current === null) { savedSnap.current = snapshot; return } // initial load - never save
    if (snapshot === savedSnap.current) return                              // no real change
    setSave('saving')
    const h = setTimeout(() => { push(snapshot) }, 1100)
    return () => clearTimeout(h)
  }, [snapshot, canEdit, board.id, push])

  // Mirror every change onto THIS device on a short throttle (well ahead of the
  // 1100ms server debounce) so a refresh or dropped connection loses at most the
  // last change, never the session. Gated on restoreReady so we never clobber an
  // unsynced draft with the server copy before we've had a chance to restore it.
  useEffect(() => {
    if (!canEdit || !board.id || !restoreReady.current) return
    const h = setTimeout(() => saveDraft(board.id, { snapshot, ts: Date.now() }), 350)
    return () => clearTimeout(h)
  }, [snapshot, canEdit, board.id])

  // Retry the server save the moment the connection returns (offline -> online),
  // pushing whatever the device is still holding but the server has not confirmed.
  useEffect(() => {
    if (!canEdit || !board.id) return
    const flush = () => {
      if (savedSnap.current === null || snapshot === savedSnap.current) return
      push(snapshot)
    }
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [snapshot, canEdit, board.id, push])

  // Cmd/Ctrl+S -> force an immediate save (the debounced follow-up is harmless).
  useEffect(() => {
    if (!canEdit) return
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!board.id) return
        push(snapshot, { toast: 'Board saved' })
        pushThumb() // an explicit save is the ONLY thing that refreshes the gallery card
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, board.id, snapshot, push, pushThumb])

  // Auto-hide the "Saved" pill 3s after a save settles.
  useEffect(() => {
    if (save !== 'saved') return
    const t = setTimeout(() => setSave('idle'), 3000)
    return () => clearTimeout(t)
  }, [save])

  // Restore on open. Runs once. If this device holds a draft the server never
  // confirmed (crash / offline / closed mid-save), bring it back and let autosave
  // push it up. Then frame the whole board so it's ready to read.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const serverSnap = boardSnapshot(board)
      const draft = canEdit && board.id ? await loadDraft(board.id) : null
      if (!alive) return
      let hasContent = (board.nodes || []).length > 0
      if (draft?.snapshot && draft.snapshot !== serverSnap) {
        // NEWEST WINS. This used to restore the local draft unconditionally, which
        // meant an hour-old draft on this device silently overwrote work saved
        // from another device - reproduced, and it destroyed the remote version
        // with no prompt. A draft only wins when it is genuinely newer than what
        // the server holds.
        const serverTs = Date.parse(board.updatedAt || '') || 0
        // A draft bigger than the save cap can NEVER reach the server. Restoring
        // one traps the board in "Too large to sync" forever: the fat draft is
        // rewritten on every edit, so it stays the newest copy and wins every
        // reload. If the server has a version that actually fits, that one wins
        // regardless of age - a copy that can sync beats one that cannot.
        const draftFits = draftNodesBytes(draft.snapshot) <= MAX_NODES_BYTES
        const serverFits = JSON.stringify(board.nodes || []).length <= MAX_NODES_BYTES
        if (!draftFits && serverFits) {
          clearDraft(board.id)
          showToast('Your device held an oversized copy - loaded the synced version')
        } else if (draft.ts > serverTs) {
          try {
            const d = JSON.parse(draft.snapshot)
            restore(d)
            savedSnap.current = serverSnap // baseline = server, so autosave re-pushes the restored draft
            showToast('Restored your unsaved changes')
            hasContent = (d.nodes || []).length > 0
          } catch { /* corrupt draft - fall through to the server copy */ }
        } else {
          // The server moved on after this draft was written. Keep the newer copy
          // and drop the stale one, so it cannot clobber anything on a later open.
          clearDraft(board.id)
          showToast('Loaded a newer version saved elsewhere')
        }
      }
      // ALWAYS frame the whole board on open - you should see the whole case the
      // moment it loads, never a corner of it at whatever zoom you left behind.
      // A brand-new empty board stays at a calm 100%. (Two rAFs so React Flow has
      // measured the nodes before we fit.)
      if (hasContent) {
        requestAnimationFrame(() => requestAnimationFrame(() => { if (alive) fitView({ padding: 0.18, duration: 0 }) }))
      }
      restoreReady.current = true
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { save }
}
