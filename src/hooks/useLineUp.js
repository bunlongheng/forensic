import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { snapAlign } from '../lib/snapAlign.js'
import { matchHeightHint, snapToConnected } from '../lib/boardGraph.js'

// The modifier-drag layer: hold CMD to snap a node onto a neighbour's edge or
// centre line (and to be offered its height), hold SHIFT to line a node up with
// whatever it is wired to. Owns the guides, the dashed size ghost, and the
// "board is busy" flag the snapshot freezes on. Lifted out of Board.jsx whole -
// same handlers, same dependencies.
export function useLineUp({ canEdit, nodes, edges, setNodes, onNodesChange, flowToScreenPosition, getViewport }) {
  // `content` (in Board) mirrors nodes/edges for snapshot purposes, EXCEPT while
  // a drag is in flight, when it stays pinned to the pre-drag value and catches
  // up the instant the drag ends. React Flow updates node positions on every
  // pointermove, so without this freeze the whole board (incl. base64 image data)
  // got re-stringified - and useUndoRedo re-recorded - on every single frame of a
  // drag. Driven by the explicit drag start/stop callbacks (the per-change
  // `dragging` flag is not reliable).
  const [dragging, setDragging] = useState(false)
  const [sizeHint, setSizeHint] = useState(null) // { id, w, h, x, y, same } - CMD line-up ghost
  const hintRef = useRef(null)                   // same value, readable from onDragStop
  const [guides, setGuides] = useState([])       // CMD snap-align lines, in board coords
  const nodesRef = useRef(nodes)                 // live layout for the per-frame drag path
  const metaRef = useRef(false)                  // CMD/Ctrl held right now

  const onDragStart = useCallback(() => setDragging(true), [])
  // Releasing with the line-up ghost up commits it: the photo takes the
  // neighbour's height. NodeResizer writes to n.width/n.height (NOT n.style), so
  // set both - sanitizeNode folds them together when the board saves.
  const onDragStop = useCallback(() => {
    setDragging(false)
    const h = hintRef.current
    if (h) {
      if (!h.same) {
        setNodes((nds) => nds.map((n) => (n.id === h.id
          ? { ...n, width: h.w, height: h.h, style: { ...n.style, width: h.w, height: h.h } }
          : n)))
      }
    }
    hintRef.current = null
    setSizeHint(null)
    setGuides((g) => (g.length ? [] : g))
  }, [setNodes])

  // Safety net, and it is load-bearing: React Flow ABORTS a drag without calling
  // onNodeDragStop when the dragged node vanishes mid-gesture (delete it while
  // holding it) or a second finger lands. `dragging` then stayed true forever,
  // `content` stayed frozen, and the board silently stopped saving, undoing and
  // drafting for the rest of the session - no error, no pill, everything lost on
  // refresh. A pointer that is no longer down cannot be a drag in progress.
  useEffect(() => {
    if (!dragging) return
    // Same abort path leaves the snap guide and the size ghost painted on a line
    // the node is no longer on, so they come down with it.
    const clear = () => {
      setDragging(false)
      hintRef.current = null
      setSizeHint(null)
      setGuides((g) => (g.length ? [] : g))
    }
    window.addEventListener('pointerup', clear)
    window.addEventListener('pointercancel', clear)
    return () => {
      window.removeEventListener('pointerup', clear)
      window.removeEventListener('pointercancel', clear)
    }
  }, [dragging])

  // NodeResizer has no board-level callback, but React Flow flags the node with
  // `resizing` on every dimension change, so a resize is frozen the same way.
  const isResizing = nodes.some((n) => n.resizing)

  // CMD also proposes a SIZE, not just an alignment: drag a photo near another
  // photo with CMD held and a dashed ghost shows the height it would take to
  // match. Release to commit it; let go of CMD first and nothing is resized.
  // The position snapping itself is snapAlign's job, in onNodesChangeSnap below.
  const onNodeDrag = useCallback((e, node) => {
    if (e.shiftKey) {
      const pos = snapToConnected(node, nodes, edges)
      if (pos) setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position: pos } : n)))
      hintRef.current = null
      setSizeHint((prev) => (prev === null ? prev : null))
      return
    }
    const hint = (e.metaKey || e.ctrlKey) ? matchHeightHint(node, nodes) : null
    if (!hint) {
      hintRef.current = null
      setSizeHint((prev) => (prev === null ? prev : null))
      return
    }
    // Magnet the top edges together so the row reads as one line. Only within
    // range - a far-off neighbour still suggests its height without yanking the
    // photo across the board.
    const next = { id: node.id, w: hint.w, h: hint.h, same: hint.same === true, x: node.position.x, y: node.position.y }
    hintRef.current = next
    setSizeHint(next) // fires per pointermove; the board already re-renders each frame of a drag
  }, [nodes, edges, setNodes])

  useEffect(() => { nodesRef.current = nodes }, [nodes])

  // Hold CMD (Ctrl on Windows) while dragging and the node latches onto the
  // nearest edge/center line of another node, with a guide drawn on that line.
  // Rewriting the position CHANGE - rather than the node afterwards - is what
  // makes the snap STICK: React Flow's own drag position is applied after any
  // node we write, so a post-hoc correction gets overwritten on release.
  const onNodesChangeSnap = useCallback((changes) => {
    const drags = changes.filter((c) => c.type === 'position' && c.position)
    const drag = drags[0]
    let applied = changes
    // Single-node drags only. Rewriting one position out of a multi-node drag
    // would shear the selection apart.
    if (drag && drags.length === 1 && metaRef.current) {
      const dragged = nodesRef.current.find((n) => n.id === drag.id)
      if (dragged && !dragged.parentId) {
        const { position, guides: g } = snapAlign({ ...dragged, position: drag.position }, nodesRef.current)
        applied = changes.map((c) => (c === drag ? { ...c, position } : c))
        setGuides(drag.dragging === false ? [] : g)
      }
    } else if (drag) {
      setGuides((g) => (g.length ? [] : g))
    }
    onNodesChange(applied)
  }, [onNodesChange])

  // A NodeResizer drag never reaches the board component, so CMD has to be
  // tracked globally to know whether a resize wants the line-up guide.
  const [metaDown, setMetaDown] = useState(false)
  useEffect(() => {
    if (!canEdit) return
    const sync = (e) => { metaRef.current = e.metaKey || e.ctrlKey; setMetaDown(metaRef.current); if (!metaRef.current) setGuides((g) => (g.length ? [] : g)) }
    const off = () => { metaRef.current = false; setMetaDown(false); setGuides((g) => (g.length ? [] : g)) }
    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', off) // cmd+tab away and the key never "lifts"
    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', off)
    }
  }, [canEdit])

  // Same line-up guide for a RESIZE: hold CMD while pulling a photo's corner and
  // the nearest photo's height is suggested, then snapped to on release.
  const resizeHint = useMemo(() => {
    if (!metaDown) return null
    const n = nodes.find((x) => x.resizing)
    const hint = n && matchHeightHint(n, nodes)
    if (!hint || hint.same) return null
    return { id: n.id, w: hint.w, h: hint.h, same: false, x: n.position.x, y: n.position.y }
  }, [metaDown, nodes])

  // Hold the last suggestion so it survives into the frame the resize ends on -
  // by then the node is no longer `resizing` and resizeHint is already null.
  const resizeRef = useRef(null)
  useEffect(() => { if (resizeHint) resizeRef.current = resizeHint }, [resizeHint])
  useEffect(() => {
    if (isResizing) return
    const h = resizeRef.current
    resizeRef.current = null
    if (!h) return
    setNodes((nds) => nds.map((n) => (n.id === h.id
      ? { ...n, width: h.w, height: h.h, style: { ...n.style, width: h.w, height: h.h } }
      : n)))
  }, [isResizing, setNodes])

  // One ghost serves both gestures - only one can be in flight at a time.
  const ghost = sizeHint || resizeHint

  // The ghost lives in screen space (the wrapper is fixed at inset 0), so map the
  // flow position across and scale the box by the live zoom.
  const hintBox = useMemo(() => {
    if (!ghost) return null
    const { x, y } = flowToScreenPosition({ x: ghost.x, y: ghost.y })
    const { zoom } = getViewport()
    return { left: x, top: y, width: ghost.w * zoom, height: ghost.h * zoom }
  }, [ghost, flowToScreenPosition, getViewport])

  return {
    busy: dragging || isResizing,
    guides, ghost, hintBox,
    onDragStart, onDragStop, onNodeDrag, onNodesChangeSnap,
  }
}
