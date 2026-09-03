import { useCallback, useEffect, useRef, useState } from 'react'

// Undo / redo over durable board snapshots (JSON strings). Records every change
// to `snapshot`. `snapshot` strips selection/drag flags and other UI-only state -
// positions ARE durable and do get recorded - but the Board freezes the snapshot
// value for the duration of a drag, so the flurry of pointermove position updates
// collapses into one history entry once the drag ends. Undo walks back through
// the stack and hands the parsed snapshot to `restore`; that write is flagged so
// it isn't re-recorded.
// Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y = redo. Ignored while typing
// so the browser's native text undo still works inside a note.
export function useUndoRedo({ snapshot, canEdit, restore, limit = 100 }) {
  const history = useRef([])          // undo stack of durable snapshots (JSON strings)
  const histIdx = useRef(-1)          // current position in the stack
  const isRestoring = useRef(false)   // set while undo/redo writes state, so it isn't re-recorded
  const [hist, setHist] = useState({ canUndo: false, canRedo: false })

  useEffect(() => {
    if (!canEdit) return
    if (isRestoring.current) { isRestoring.current = false; return }
    history.current = history.current.slice(0, histIdx.current + 1) // drop any redo tail
    history.current.push(snapshot)
    if (history.current.length > limit) history.current.shift()      // cap long sessions
    histIdx.current = history.current.length - 1
    setHist({ canUndo: histIdx.current > 0, canRedo: false })
  }, [snapshot, canEdit, limit])

  const go = useCallback((delta) => {
    const next = histIdx.current + delta
    if (next < 0 || next > history.current.length - 1) return
    let d
    try { d = JSON.parse(history.current[next]) } catch { return } // skip a corrupt history entry
    histIdx.current = next
    isRestoring.current = true
    restore(d)
    setHist({ canUndo: next > 0, canRedo: next < history.current.length - 1 })
  }, [restore])

  const undo = useCallback(() => go(-1), [go])
  const redo = useCallback(() => go(1), [go])

  useEffect(() => {
    if (!canEdit) return
    const onKey = (e) => {
      if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return
      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z') { e.preventDefault(); (e.shiftKey ? redo : undo)() }
      else if (k === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, undo, redo])

  return { undo, redo, canUndo: hist.canUndo, canRedo: hist.canRedo }
}
