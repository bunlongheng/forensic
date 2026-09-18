import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap,
  useNodesState, useEdgesState, addEdge, useReactFlow,
} from '@xyflow/react'
import ImageNode from '../components/ImageNode.jsx'
import NoteNode from '../components/NoteNode.jsx'
import TextNode from '../components/TextNode.jsx'
import ProfileNode from '../components/ProfileNode.jsx'
import StickerNode from '../components/StickerNode.jsx'
import ContainerNode from '../components/ContainerNode.jsx'
import AnnotationNode from '../components/AnnotationNode.jsx'
import DrawingNode from '../components/DrawingNode.jsx'
import CalloutNode from '../components/CalloutNode.jsx'
import ClipNode from '../components/ClipNode.jsx'
import StampNode from '../components/StampNode.jsx'
import RedactionNode from '../components/RedactionNode.jsx'
import CrosshairNode from '../components/CrosshairNode.jsx'
import WaxSealNode from '../components/WaxSealNode.jsx'
import FileNode from '../components/FileNode.jsx'
import { FloatingEdge } from '../components/FloatingEdge.jsx'
import { Icon } from '../components/Icon.jsx'
import { Inspector } from '../components/Inspector.jsx'
import { Decorations } from '../components/Decorations.jsx'
import { ReportModal } from '../components/ReportModal.jsx'
import { CursorTools, RING_SAFE } from '../components/CursorTools.jsx'
import { SnapGuides } from '../components/SnapGuides.jsx'
import { BoardTopBar, MultiSelectBar } from '../components/BoardTopBar.jsx'
import { fileToImage, isImageFile } from '../lib/image.js'
import { fileToAttachment, parseLink, ATTACH_MAX, prettySize } from '../lib/attach.js'
import { makeThumbnail } from '../lib/thumbnail.js'
import { snapAlign } from '../lib/snapAlign.js'
import { TOOL_ITEMS } from '../lib/tools.js'
import {
  uid, withEditable, boardSnapshot, addNode, arrangeZ,
  groupNodes, ungroupNodes, threadPairs, addThreads, snapToConnected, matchHeightHint, styleNodes, styleEdges,
} from '../lib/boardGraph.js'
import { useBoardPersistence } from '../hooks/useBoardPersistence.js'
import { useUndoRedo } from '../hooks/useUndoRedo.js'
import { useNodeClipboard } from '../hooks/useNodeClipboard.js'

const NODE_TYPES = {
  image: ImageNode, note: NoteNode, text: TextNode, profile: ProfileNode,
  sticker: StickerNode, container: ContainerNode, annotation: AnnotationNode, drawing: DrawingNode,
  callout: CalloutNode, clip: ClipNode, stamp: StampNode, redaction: RedactionNode,
  crosshair: CrosshairNode, wax: WaxSealNode, file: FileNode,
}
const EDGE_TYPES = { floating: FloatingEdge }

// An exhibit pins exactly where you pasted it - unless another one is already
// sitting on that spot, in which case it steps down the page (a card is ~96px
// tall) so the one underneath keeps its Open button. That covers both a second
// paste at the same point and several files arriving in one paste. Capped, so a
// pile never walks off the board.
const EXHIBIT_STEP = 108
function freeSpot(at, nds) {
  const p = { ...at }
  for (let i = 0; i < 6; i++) {
    const taken = nds.some((n) => n.type === 'file' && !n.parentId
      && Math.abs(n.position.x - p.x) < 8 && Math.abs(n.position.y - p.y) < 8)
    if (!taken) break
    p.x += 24
    p.y += EXHIBIT_STEP
  }
  return p
}

const typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')

function BoardInner({ board, canEdit, readOnly, theme, themeName, onToggleTheme, onBack, showToast }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(withEditable(board.nodes || [], canEdit))
  const [edges, setEdges, onEdgesChange] = useEdgesState(board.edges || [])
  const [title, setTitle] = useState(board.title || 'Untitled Board')
  const { screenToFlowPosition, flowToScreenPosition, fitView, setViewport, updateNodeData, getViewport } = useReactFlow()
  const [sel, setSel] = useState(null) // { kind:'note'|'image'|'edge', id }
  const [multiCount, setMultiCount] = useState(0) // # of selected top-level nodes (for Group)
  const [showReport, setShowReport] = useState(false)
  const wrapRef = useRef(null)
  const cursorRef = useRef(null)      // last pointer position, screen coords (null until the mouse moves)
  const fileRef = useRef(null)
  const fabRef = useRef(null)          // bottom-left ring summon
  const toolbarRef = useRef(null)
  const [panelW, setPanelW] = useState(264) // inspector matches the toolbar's width

  // `content` mirrors nodes/edges for snapshot purposes, EXCEPT while a drag is in
  // flight, when it stays pinned to the pre-drag value and catches up the instant
  // the drag ends. React Flow updates node positions on every pointermove, so
  // without this freeze the whole board (incl. base64 image data) got re-stringified
  // - and useUndoRedo re-recorded - on every single frame of a drag. Driven by the
  // explicit drag start/stop callbacks (the per-change `dragging` flag is not
  // reliable), and adjusted directly during render (React's documented pattern),
  // not in an effect, so it never lags a frame behind.
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
  const busy = dragging || isResizing
  const [content, setContent] = useState({ nodes, edges })
  if (!busy && (nodes !== content.nodes || edges !== content.edges)) {
    setContent({ nodes, edges })
  }

  // Only re-serialize when the durable content actually changes. Without this memo
  // the whole board (incl. base64 image data) was re-stringified on EVERY render -
  // and zooming re-renders each frame - which is what made pan/zoom feel laggy.
  const snapshot = useMemo(() => boardSnapshot({ title, nodes: content.nodes, edges: content.edges }), [title, content])

  // Rewrite the live board from a parsed snapshot (undo/redo, draft restore).
  const restore = useCallback((d) => {
    setTitle(d.title || 'Untitled Board')
    setNodes(withEditable(d.nodes || [], canEdit))
    setEdges(d.edges || [])
    setSel(null)
  }, [setNodes, setEdges, canEdit])

  // Snapshots the live canvas fitted to the whole board. The fit is an override
  // passed to the capture, not a real viewport move, so the owner's zoom and pan
  // stay exactly where they are.
  const contentRef = useRef(content)
  useEffect(() => { contentRef.current = content }, [content])
  const makeThumb = useCallback(
    () => makeThumbnail(contentRef.current.nodes, theme.canvas),
    [theme.canvas],
  )

  const { save } = useBoardPersistence({ board, canEdit, snapshot, restore, fitView, showToast, makeThumb })
  const { undo, redo, canUndo, canRedo } = useUndoRedo({ snapshot, canEdit, restore })

  // Keep the inspector the same width as the top-right toolbar so they line up.
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const measure = () => setPanelW(Math.round(el.getBoundingClientRect().width))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [canEdit])

  const fit = useCallback(() => fitView({ padding: 0.2, duration: 400 }), [fitView])
  const closeReport = useCallback(() => setShowReport(false), []) // stable so the modal's focus effect runs once

  // ── Add content ────────────────────────────────────────────────────────────
  const addImageFiles = useCallback(async (files, at) => {
    const imgs = [...files].filter(isImageFile)
    if (!imgs.length) return
    let i = 0
    for (const file of imgs) {
      try {
        // Only an oversized GIF reports progress - it is being re-encoded in a worker.
        // Each toast call restarts the auto-hide, so the message stays up until done.
        const onProgress = (p) => showToast(`Shrinking ${file.name}${p.passes > 1 && p.pass > 1 ? ` - pass ${p.pass}` : ''} - ${p.pct}%`)
        const { src, width, height } = await fileToImage(file, onProgress)
        const w = 240, h = Math.max(60, Math.round((240 * height) / width))
        const pos = { x: at.x + i * 28, y: at.y + i * 28 }
        setNodes((nds) => nds.concat({
          id: uid('img'), type: 'image', position: pos,
          style: { width: w, height: h },
          data: { src, editable: true },
        }))
        i++
      } catch (err) {
        showToast(err?.code === 'too-large'
          ? `${file.name} is still over ${prettySize(ATTACH_MAX)} after shrinking - pin a link to it instead`
          : err?.code === 'no-shrink'
            ? `${file.name} is over ${prettySize(ATTACH_MAX)} and this browser cannot shrink GIFs - use Chrome, or pin a link`
            : 'Could not read an image')
      }
    }
    if (i) showToast(`Pinned ${i} image${i > 1 ? 's' : ''}`)
  }, [setNodes, showToast])

  // Everything that is NOT a photo - a PDF, an audio or video file, a document -
  // becomes one exhibit card you click to open. The bytes ride in the board JSON,
  // so an oversized file is refused up front with the reason, not a failed save.
  const addAttachFiles = useCallback(async (files, at) => {
    let i = 0
    for (const file of files) {
      try {
        const data = await fileToAttachment(file)
        setNodes((nds) => nds.concat({
          id: uid('file'), type: 'file', position: freeSpot(at, nds), style: { width: 240 },
          data: { ...data, editable: true },
        }))
        i++
      } catch (err) {
        showToast(err?.code === 'too-large'
          ? `${file.name} is over ${prettySize(ATTACH_MAX)} - pin a link to it instead`
          : `Could not read ${file.name}`)
      }
    }
    if (i) showToast(`Pinned ${i} file${i > 1 ? 's' : ''}`)
  }, [setNodes, showToast])

  // One entry point for dropped/pasted/picked files: photos pin as photos,
  // everything else pins as an exhibit card.
  const addFiles = useCallback((files, at) => {
    const list = [...files]
    const imgs = list.filter(isImageFile)
    const rest = list.filter((f) => !isImageFile(f))
    if (imgs.length) addImageFiles(imgs, at)
    if (rest.length) addAttachFiles(rest, imgs.length ? { x: at.x + 40, y: at.y + 40 } : at)
  }, [addImageFiles, addAttachFiles])

  // A pasted (or dragged) URL lands as a link card - click its icon to open it.
  const addLink = useCallback((link, at) => {
    setNodes((nds) => nds.concat({
      id: uid('file'), type: 'file', position: freeSpot(at, nds), style: { width: 240 },
      data: { ...link, editable: true },
    }))
    showToast('Pinned a link')
  }, [setNodes, showToast])

  const addNodeOfType = useCallback((type, at, extra, exact) => setNodes((nds) => addNode(nds, type, at, extra, exact)), [setNodes])

  const centerPos = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect()
    return screenToFlowPosition({ x: (r?.left || 0) + (r?.width || 800) / 2, y: (r?.top || 0) + (r?.height || 600) / 2 })
  }, [screenToFlowPosition])

  // Where a paste lands: on the pointer, so what you paste appears where you are
  // looking. Falls back to the middle of the view when the mouse has not moved
  // yet, has left the canvas, or is parked over the chrome (toolbar, inspector,
  // minimap) - dropping a card under a panel would look like nothing happened.
  const pastePos = useCallback(() => {
    const c = cursorRef.current
    const r = wrapRef.current?.getBoundingClientRect()
    const inside = c && r && c.x >= r.left && c.x <= r.right && c.y >= r.top && c.y <= r.bottom
    if (!inside) return centerPos()
    if (document.elementFromPoint(c.x, c.y)?.closest('.fx-noexport')) return centerPos()
    return screenToFlowPosition(c)
  }, [centerPos, screenToFlowPosition])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    if (!canEdit) {
      if (readOnly) showToast(readOnly === 'auth' ? 'Sign in to edit this board' : 'Read-only on this device')
      return
    }
    const at = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    if (e.dataTransfer.files?.length) { addFiles(e.dataTransfer.files, at); return }
    // A link dragged in from another tab/app.
    const link = parseLink(e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text'))
    if (link) addLink(link, at)
  }, [canEdit, readOnly, showToast, screenToFlowPosition, addFiles, addLink])

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }, [])

  useNodeClipboard({ canEdit, readOnly, sel, nodes, setNodes, addFiles, addLink, pastePos, showToast })

  // Ignore self-connections - a thread from a node back to itself collapses to a
  // stray pin in the middle of the card (no visible string). Only wire two cards.
  const onConnect = useCallback((c) => {
    if (c.source === c.target) return
    setEdges((eds) => addEdge(c, eds))
  }, [setEdges])

  const arrange = useCallback((nodeId, dir) => setNodes((nds) => arrangeZ(nds, nodeId, dir)), [setNodes])
  const groupSelected = useCallback(() => setNodes(groupNodes), [setNodes])
  const ungroupSelected = useCallback(() => setNodes(ungroupNodes), [setNodes])

  // Auto-thread the selected assets: 'chain' (nearest-neighbour path) or 'fan' (hub -> rest).
  const connectSelected = useCallback((mode) => {
    const pairs = threadPairs(nodes.filter((n) => n.selected && !n.parentId), mode)
    if (pairs.length) setEdges((eds) => addThreads(eds, pairs))
  }, [nodes, setEdges])

  // Cmd/Ctrl+G TOGGLES: with a group selected it ungroups, otherwise it groups.
  // Hitting the same keys again to undo the grouping is the reflex, and having to
  // remember a second Shift variant for it never was. Shift still forces ungroup.
  useEffect(() => {
    if (!canEdit) return
    const onKey = (e) => {
      if (typing() || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'g') return
      e.preventDefault()
      const onGroup = nodes.some((n) => n.selected && (n.type === 'container' || n.parentId))
      if (e.shiftKey || onGroup) ungroupSelected(); else groupSelected()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, nodes, groupSelected, ungroupSelected])

  // Hold SHIFT while dragging a node to snap it into a straight line with the
  // node(s) it's wired to. FloatingEdge draws boundary-to-boundary, so aligned
  // centers give a clean straight string.
  // DOUBLE-click/tap empty canvas to drop a note, already open for typing, exactly
  // where you tapped. Two paths on purpose, both funnelling through dropNote,
  // which de-dupes so they can never both add:
  //  - MOUSE: the real dblclick. React Flow runs selectionOnDrag and intermittently
  //    swallows one of the two pane clicks, so tap-counting alone dropped roughly
  //    one double-click in three. Listened for on the CAPTURE phase: d3-zoom stops
  //    the event propagating, so a plain bubbling onDoubleClick never sees it.
  //  - TOUCH: tap counting, because dblclick and e.detail are both unreliable there.
  const paneTaps = useRef([])
  const lastDrop = useRef(-Infinity)
  const dropNote = useCallback((clientX, clientY, t) => {
    if (!canEdit || t - lastDrop.current < 500) return
    lastDrop.current = t
    paneTaps.current = []
    addNodeOfType('clip', screenToFlowPosition({ x: clientX, y: clientY }), { autoEdit: true }, true)
  }, [canEdit, addNodeOfType, screenToFlowPosition])

  const onPaneClick = useCallback((e) => {
    if (!canEdit) return
    const t = e.timeStamp
    paneTaps.current = paneTaps.current.filter((x) => t - x < 450)
    paneTaps.current.push(t)
    if (paneTaps.current.length >= 2) dropNote(e.clientX, e.clientY, t)
  }, [canEdit, dropNote])

  // Only the bare canvas: a dblclick on a node is that node's own business.
  const onPaneDoubleClick = useCallback((e) => {
    if (!e.target?.classList?.contains('react-flow__pane')) return
    dropNote(e.clientX, e.clientY, e.timeStamp)
  }, [dropNote])

  // CMD also proposes a SIZE, not just an alignment: drag a photo near another
  // photo with CMD held and a dashed ghost shows the height it would take to
  // match. Release to commit it; let go of CMD first and nothing is resized.
  // The position snapping itself is snapAlign's job, in onNodesChange below.
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

  // ─── Tool ring ────────────────────────────────────────────────────────────
  // Opened by the toolbar + or the corner +, never by a held key. The hold-CMD
  // summon was removed: its dwell timer raced CMD-drag line-up and every CMD
  // shortcut, so the ring bloomed when nobody asked for it. CMD on the canvas
  // now means nothing; CMD on a node still means line up.
  const [ring, setRing] = useState(null)     // {x,y} in screen coords, or null
  const summonRef = useRef(0)                // bumped per summon so the ring remounts
  // The pointer is tracked for one reason: a paste lands ON THE CURSOR.
  useEffect(() => {
    if (!canEdit) return
    const track = (e) => { cursorRef.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('pointermove', track)
    return () => window.removeEventListener('pointermove', track)
  }, [canEdit])

  // Drop the picked tool on the exact spot the ring's crosshair marked.
  const pickRingTool = useCallback((it) => {
    const at = screenToFlowPosition(ring)
    // Do NOT clear `ring` here - the ring plays its own retract and calls
    // onClose when the sweep lands. Nulling it here unmounted it mid-animation.
    if (it.action === 'image' || it.key === 'image') { fileRef.current?.click(); return }
    addNodeOfType(it.key, at, it.extra, true)
  }, [ring, screenToFlowPosition, addNodeOfType])

  // The toolbar's + summons the ring over the middle of the canvas, so the
  // pointer path is short and there is only ever ONE tool UI to learn.
  const closeRing = useCallback(() => setRing(null), [])
  // Every summon lands here, clamped so no tool ends up off-screen.
  const openRingAt = useCallback((x, y) => {
    const clamp = (v, max) => Math.min(Math.max(v, RING_SAFE), max - RING_SAFE)
    setRing({ x: clamp(x, window.innerWidth), y: clamp(y, window.innerHeight), n: ++summonRef.current })
  }, [])
  const openRingAtCenter = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect()
    openRingAt((r?.left || 0) + (r?.width || 800) / 2, (r?.top || 0) + (r?.height || 600) / 2)
  }, [openRingAt])
  // The bottom-left summon blooms the ring over itself, so the tools appear
  // under the thumb that asked for them.
  const openRingAtFab = useCallback(() => {
    const r = fabRef.current?.getBoundingClientRect()
    if (!r) return openRingAtCenter()
    openRingAt(r.left + r.width / 2, r.top + r.height / 2)
  }, [openRingAt, openRingAtCenter])

  // A NodeResizer drag never reaches this component, so CMD has to be tracked
  // globally to know whether a resize wants the line-up guide.
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

  // Memoized: zoom/pan re-renders every frame (zoomPct), so keep these arrays
  // referentially stable unless their inputs change - React Flow then skips diffing.
  // Stable object/function props for <ReactFlow>: a fresh literal on every render
  // makes React Flow re-run its own prop diffing for nothing.
  const onSelectionChange = useCallback(({ nodes: ns, edges: es }) => {
    const next = ns.length === 1
      ? { kind: ns[0].type, id: ns[0].id }
      : es.length === 1 ? { kind: 'edge', id: es[0].id } : null
    // Return the SAME reference when unchanged so React bails out - otherwise
    // a fresh object every fire loops against the glow re-render.
    setSel((prev) => (prev?.id === next?.id && prev?.kind === next?.kind ? prev : next))
    setMultiCount(ns.filter((n) => !n.parentId).length)
  }, [])
  const connectionLineStyle = useMemo(() => ({ stroke: theme.accent, strokeWidth: 2.4 }), [theme.accent])
  const minimap = useMemo(() => ({
    mask: themeName === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)',
    style: { background: theme.minimapBg, border: `1px solid ${theme.panelBorder}`, right: 42, bottom: 42, width: 118, height: 82 },
  }), [themeName, theme.minimapBg, theme.panelBorder])

  const styledNodes = useMemo(() => styleNodes(nodes), [nodes])
  const styledEdges = useMemo(() => styleEdges(edges, sel, theme.accent), [edges, sel, theme.accent])

  function exportPng() {
    // Capture the whole board window - frame, lamps and all - minus the UI chrome.
    const el = wrapRef.current
    if (!el) return
    const hide = (n) => {
      const c = n.classList
      return !c || (!c.contains('react-flow__minimap') && !c.contains('react-flow__controls') && !c.contains('fx-noexport'))
    }
    // Export should capture the WHOLE board, not just whatever's currently in the
    // viewport - so fit everything into view first, wait for it to paint, capture,
    // then put the viewport back exactly where the owner had it.
    const prevVp = getViewport()
    fitView({ padding: 0.1, duration: 0 })
    requestAnimationFrame(() => requestAnimationFrame(() => {
      import('html-to-image')
        .then(({ toPng }) => toPng(el, { backgroundColor: theme.canvas, pixelRatio: 2, filter: hide }))
        .then((url) => { const a = document.createElement('a'); a.href = url; a.download = `${(title || 'board').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`; a.click() })
        .catch(() => showToast('Export failed'))
        .finally(() => setViewport(prevVp, { duration: 0 }))
    }))
  }

  function share() {
    const url = `${window.location.origin}/?id=${board.id}`
    navigator.clipboard.writeText(url).then(() => showToast('Share link copied')).catch(() => showToast('Copy failed'))
  }

  return (
    <div ref={wrapRef} style={{ position: 'fixed', inset: 0, background: theme.canvas }}
      onDrop={onDrop} onDragOver={onDragOver} onDoubleClickCapture={canEdit ? onPaneDoubleClick : undefined}>
      {/* Crumpled-paper warp used by images with the Wrinkle option on. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="fx-wrinkle" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.016" numOctaves="3" seed="8" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={canEdit ? onNodesChangeSnap : undefined}
        onEdgesChange={canEdit ? onEdgesChange : undefined}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        onNodeDrag={canEdit ? onNodeDrag : undefined}
        onNodeDragStart={onDragStart}
        onNodeDragStop={onDragStop}
        onSelectionDragStart={onDragStart}
        onSelectionDragStop={onDragStop}
        colorMode={themeName}
        connectionMode="loose"
        connectionLineType="straight"
        connectionLineStyle={connectionLineStyle}
        connectionRadius={34}
        zoomOnDoubleClick={false}
        minZoom={0.02}
        maxZoom={40}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        elementsSelectable={canEdit}
        deleteKeyCode={canEdit ? ['Backspace', 'Delete'] : null}
        selectionOnDrag={canEdit}
        panOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <SnapGuides guides={guides} color={theme.accent} />
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.6} color={theme.dot} />
        <MiniMap
          className="fx-minimap fx-mobile-hide" pannable zoomable position="bottom-right"
          maskColor={minimap.mask}
          style={minimap.style}
          nodeColor={theme.minimapNode}
          nodeStrokeColor={theme.accent}
        />
      </ReactFlow>

      {/* CMD line-up: a dashed ghost at the height of the nearest photo. */}
      {hintBox && (
        <div className="fx-noexport" style={{
          position: 'fixed', left: hintBox.left, top: hintBox.top,
          width: hintBox.width, height: hintBox.height,
          border: `2px dashed ${theme.accent}`, borderRadius: 3,
          pointerEvents: 'none', zIndex: 6,
        }}>
          <span className="mono" style={{
            position: 'absolute', left: 0, top: -25, whiteSpace: 'nowrap',
            background: theme.accent, color: '#fff', fontSize: 10, fontWeight: 700,
            letterSpacing: 0.4, padding: '3px 7px', borderRadius: 4,
            boxShadow: '0 3px 10px rgba(0,0,0,.35)',
          }}>
            {ghost.same ? `lined up - height ${ghost.h}` : `line up - height ${ghost.h}`}
          </span>
        </div>
      )}

      {/* Empty-state hint */}
      {canEdit && nodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', color: theme.muted, animation: 'fx-rise .5s both' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🧵</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: theme.text }}>DROP EVIDENCE ONTO THE BOARD</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Drag in images, PDFs, audio or links - paste from the clipboard - or double-click to add a note.</div>
            <div style={{ fontSize: 13, marginTop: 2 }}>Drag from a node's edge to wire connections.</div>
          </div>
        </div>
      )}

      {/* Bottom-left add menu (text / callout / circle / person / stamp / redact /
          crosshair / draw / group) */}
      {canEdit && <CursorTools key={ring ? ring.n : "shut"} at={ring} items={TOOL_ITEMS} onPick={pickRingTool} onClose={closeRing} />}

      {/* Bottom-left summon: a ghost until you reach for it, then a real button.
          The same ring the toolbar + opens, for the times your hand is on the
          mouse and not the keyboard. */}
      {canEdit && (
        <button
          ref={fabRef} className="fx-noexport fx-fab" onClick={openRingAtFab}
          aria-label="Open add tools" title="Add to board"
          style={{
            position: 'absolute', zIndex: 9,
            left: 'calc(42px + env(safe-area-inset-left))', bottom: 'calc(42px + env(safe-area-inset-bottom))',
            width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer',
            background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)', padding: 0,
          }}
        >
          <Icon name="plus" size={21} />
        </button>
      )}

      <BoardTopBar
        canEdit={canEdit} readOnly={readOnly} title={title} onTitle={setTitle} save={save} onBack={onBack} toolbarRef={toolbarRef}
        undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
        onFit={fit} onExport={exportPng} onShare={board.id ? share : null} onReport={() => setShowReport(true)}
        onAddTool={openRingAtCenter}
        onAddImage={() => fileRef.current?.click()} onAddSticker={() => addNodeOfType('sticker', centerPos())}
        onToggleTheme={onToggleTheme} themeName={themeName}
      />
      {canEdit && <input ref={fileRef} type="file" accept="image/*,application/pdf,audio/*,video/*,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.md" multiple hidden
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files, centerPos()); e.target.value = '' }} />}

      {canEdit && multiCount >= 2 && (
        <MultiSelectBar count={multiCount} onChain={() => connectSelected('chain')} onFan={() => connectSelected('fan')} onGroup={groupSelected} />
      )}

      {/* ── Inspector (right panel) ─────────────────────────────────────────── */}
      {canEdit && sel && (() => {
        const el = sel.kind === 'edge' ? edges.find((e) => e.id === sel.id) : nodes.find((n) => n.id === sel.id)
        if (!el) return null
        return (
          <Inspector
            kind={sel.kind} data={el.data || {}} width={panelW}
            onNode={(patch) => updateNodeData(sel.id, patch)}
            onEdge={(patch) => setEdges((eds) => eds.map((x) => (x.id === sel.id ? { ...x, data: { ...x.data, ...patch } } : x)))}
            onArrange={(dir) => arrange(sel.id, dir)}
            onUngroup={ungroupSelected}
          />
        )
      })()}

      {/* Fixed board frame. Window-anchored, pointer-events off, so the corkboard
          still pans/zooms inside. */}
      {canEdit && <Decorations />}

      {showReport && <ReportModal title={title} nodes={nodes} edges={edges} onClose={closeReport} />}
    </div>
  )
}

export default function Board(props) {
  return (
    <ReactFlowProvider>
      <BoardInner {...props} />
    </ReactFlowProvider>
  )
}
