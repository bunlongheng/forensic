import { useCallback, useEffect, useRef, useState } from 'react'
import { updateBoard } from '../lib/api.js'
import { saveDraft, loadDraft, clearDraft, loadViewport } from '../lib/localBoard.js'
import { boardSnapshot } from '../lib/boardGraph.js'

// A board this large would blow past most hosts' request-body limit (and the
// server's own 413), so we refuse to even try and tell the owner why instead of
// spinning on a save that can never land.
const MAX_SNAPSHOT_BYTES = 4_300_000

// Everything that gets a board from memory to somewhere durable, owner only:
//   - debounced autosave to the server (only when DURABLE content changes)
//   - a fast local draft on this device (crash / offline safety)
//   - a retry the moment the connection returns
//   - Cmd/Ctrl+S to force a save
//   - restore-on-open: bring back an unsynced draft, then frame the board
// Returns the save state for the pill and `restoreReady`, which gates local
// writes until we've checked for an existing draft.
export function useBoardPersistence({ board, canEdit, snapshot, restore, fitView, setViewport, showToast }) {
  const [save, setSave] = useState('idle') // idle | saving | saved | error | toolarge | unauth
  const savedSnap = useRef(null)
  const restoreReady = useRef(false)

  // Single place that actually pushes a snapshot to the server: the size guard,
  // the PUT, and the bookkeeping (savedSnap / local draft / save state) that the
  // debounced save, the online retry and Cmd+S all used to duplicate.
  const push = useCallback(async (snap, { toast } = {}) => {
    if (snap.length > MAX_SNAPSHOT_BYTES) { setSave('toolarge'); return }
    setSave('saving')
    try {
      await updateBoard(board.id, JSON.parse(snap))
      savedSnap.current = snap
      clearDraft(board.id) // server has it now - drop the local draft so a reload never restores stale work
      setSave('saved')
      if (toast) showToast(toast)
    } catch (e) {
      setSave(e?.status === 413 ? 'toolarge' : e?.status === 401 ? 'unauth' : 'error')
    }
  }, [board.id, showToast])

  // Persist only when the durable content changes. `snapshot` strips selection /
  // drag / hover state, so merely opening or clicking a board never re-saves and
  // never bumps its gallery order.
  useEffect(() => {
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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, board.id, snapshot, push])

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
        try {
          const d = JSON.parse(draft.snapshot)
          restore(d)
          savedSnap.current = serverSnap // baseline = server, so autosave re-pushes the restored draft
          showToast('Restored your unsaved changes')
          hasContent = (d.nodes || []).length > 0
        } catch { /* corrupt draft - fall through to the server copy */ }
      }
      // A saved viewport (zoom/pan) beats fitView - the owner (or a returning
      // viewer) reopens exactly where they left off instead of snapping to fit.
      const vp = board.id ? loadViewport(board.id) : null
      if (vp && setViewport) {
        setViewport(vp, { duration: 0 })
      } else if (hasContent) {
        // A brand-new empty board stays at a calm 100%. (Two rAFs so React Flow has
        // measured the nodes before we fit.)
        requestAnimationFrame(() => requestAnimationFrame(() => { if (alive) fitView({ padding: 0.18, duration: 0 }) }))
      }
      restoreReady.current = true
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { save, restoreReady }
}
