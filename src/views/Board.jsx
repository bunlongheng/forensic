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
import { FloatingEdge } from '../components/FloatingEdge.jsx'
import { Inspector } from '../components/Inspector.jsx'
import { Decorations } from '../components/Decorations.jsx'
import { ReportModal } from '../components/ReportModal.jsx'
import { AddMenu } from '../components/AddMenu.jsx'
import { PROFILE_NAMES, PROFILE_COLORS, STICKER_EMOJIS, CONTAINER_TINTS } from '../lib/constants.js'
import { updateBoard } from '../lib/api.js'
import { fileToImage } from '../lib/image.js'
import { saveDraft, loadDraft, clearDraft, saveViewport } from '../lib/localBoard.js'
import { Icon } from '../components/Icon.jsx'

const NODE_TYPES = {
  image: ImageNode, note: NoteNode, text: TextNode, profile: ProfileNode,
  sticker: StickerNode, container: ContainerNode, annotation: AnnotationNode, drawing: DrawingNode,
  callout: CalloutNode, clip: ClipNode, stamp: StampNode, redaction: RedactionNode,
}
const EDGE_TYPES = { floating: FloatingEdge }

// Written to the system clipboard on Cmd/Ctrl+C of a node, so a following Cmd/Ctrl+V
// reliably fires a 'paste' event (which we use to duplicate the node) without ever
// shadowing a real image paste.
const NODE_COPY_MARKER = 'forensic-node-copy'
let SEQ = 0
const uid = (p) => `${p}-${Date.now().toString(36)}-${(SEQ++).toString(36)}`

// Keep only the durable board shape when persisting - drop React Flow's
// transient bookkeeping (selection/drag state) and the UI-only `editable` flag.
// Crucial: NodeResizer writes the new size to n.width/n.height (NOT n.style), so
// fold the current rendered size back into style - otherwise a resize is never
// saved and the node snaps back to its original size on reload.
function sanitizeNodes(nodes) {
  return nodes.map((n) => {
    const data = { ...(n.data || {}) }
    delete data.editable
    const w = n.width ?? n.measured?.width ?? n.style?.width
    const style = { ...n.style }
    if (w != null) style.width = w
    // Persist a height ONLY when the node owns an explicit one (a resize, or a
    // fixed-size node). Auto-height nodes (quick notes) keep none so they stay
    // content-sized on reload instead of freezing at a measured height.
    if (n.style?.height != null || n.height != null) {
      const h = n.height ?? n.style?.height
      if (h != null) style.height = h
    }
    return { id: n.id, type: n.type, position: n.position, style, data }
  })
}
function sanitizeEdges(edges) {
  return edges.map((e) => {
    const c = { ...e }
    delete c.selected
    return c
  })
}

function withEditable(nodes, editable) {
  return nodes.map((n) => ({ ...n, data: { ...n.data, editable } }))
}

function BoardInner({ board, canEdit, theme, themeName, onToggleTheme, onBack, showToast }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(withEditable(board.nodes || [], canEdit))
  const [edges, setEdges, onEdgesChange] = useEdgesState(board.edges || [])
  const [title, setTitle] = useState(board.title || 'Untitled Board')
  const [save, setSave] = useState('idle') // idle | saving | saved | error
  const [zoomPct, setZoomPct] = useState(100)
  const { screenToFlowPosition, fitView, updateNodeData } = useReactFlow()
  const [sel, setSel] = useState(null) // { kind:'note'|'image'|'edge', id }
  const [showReport, setShowReport] = useState(false)
  const wrapRef = useRef(null)
  const fileRef = useRef(null)
  const toolbarRef = useRef(null)
  const [panelW, setPanelW] = useState(264) // inspector matches the toolbar's width
  const savedSnap = useRef(null)
  const vpRef = useRef(null)          // latest viewport {x,y,zoom} for the local draft
  const vpTimer = useRef(null)        // throttle for persisting the viewport
  const restoreReady = useRef(false)  // gates local writes until we've checked for an existing draft
  const clipRef = useRef(null)        // copied node for Cmd/Ctrl+C -> +V duplicate
  const history = useRef([])          // undo stack of durable snapshots (JSON strings)
  const histIdx = useRef(-1)          // current position in the stack
  const isRestoring = useRef(false)   // set while undo/redo writes state, so it isn't re-recorded
  const [hist, setHist] = useState({ canUndo: false, canRedo: false })

  // Remember where the owner is looking (zoom/pan), throttled, so an accidental
  // refresh reopens at the exact same spot instead of snapping back to fit.
  const onMove = useCallback((_, vp) => {
    setZoomPct(Math.round(vp.zoom * 100))
    vpRef.current = vp
    if (!board.id || !restoreReady.current || vpTimer.current) return
    vpTimer.current = setTimeout(() => { vpTimer.current = null; saveViewport(board.id, vpRef.current) }, 300)
  }, [board.id])

  // ── Persistence: debounced autosave (owner only) ──────────────────────────
  // Persist only when the DURABLE content changes. sanitize strips selection /
  // drag / hover state, so merely opening or clicking a board never re-saves and
  // never bumps its gallery order.
  // Only re-serialize when the durable content actually changes. Without this memo
  // the whole board (incl. base64 image data) was re-stringified on EVERY render -
  // and zooming re-renders each frame - which is what made pan/zoom feel laggy.
  const snapshot = useMemo(
    () => JSON.stringify({ title, nodes: sanitizeNodes(nodes), edges: sanitizeEdges(edges) }),
    [title, nodes, edges],
  )
  useEffect(() => {
    if (!canEdit || !board.id) return
    if (savedSnap.current === null) { savedSnap.current = snapshot; return } // initial load - never save
    if (snapshot === savedSnap.current) return                              // no real change
    setSave('saving')
    const h = setTimeout(async () => {
      try {
        await updateBoard(board.id, JSON.parse(snapshot))
        savedSnap.current = snapshot
        clearDraft(board.id) // server has it now - drop the local draft so a reload never restores stale work
        setSave('saved')
      } catch { setSave('error') }
    }, 1100)
    return () => clearTimeout(h)
  }, [snapshot, canEdit, board.id])

  // ── Crash safety: mirror every change onto THIS device, fast ──────────────
  // Written on a short throttle (well ahead of the 1100ms server debounce) so a
  // refresh or dropped connection loses at most the last change, never the
  // session. Gated on restoreReady so we never clobber an unsynced draft with the
  // server copy before we've had a chance to restore it.
  useEffect(() => {
    if (!canEdit || !board.id || !restoreReady.current) return
    const h = setTimeout(() => saveDraft(board.id, { snapshot, ts: Date.now() }), 350)
    return () => clearTimeout(h)
  }, [snapshot, canEdit, board.id])

  // Retry the server save the moment the connection returns (offline -> online),
  // pushing whatever the device is still holding but the server has not confirmed.
  useEffect(() => {
    if (!canEdit || !board.id) return
    const flush = async () => {
      if (savedSnap.current === null || snapshot === savedSnap.current) return
      setSave('saving')
      try { await updateBoard(board.id, JSON.parse(snapshot)); savedSnap.current = snapshot; clearDraft(board.id); setSave('saved') }
      catch { setSave('error') }
    }
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [snapshot, canEdit, board.id])

  // Cmd/Ctrl+S -> force an immediate save (still debounced follow-up is harmless).
  useEffect(() => {
    if (!canEdit) return
    const onKey = async (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!board.id) return
        setSave('saving')
        try { await updateBoard(board.id, JSON.parse(snapshot)); savedSnap.current = snapshot; clearDraft(board.id); setSave('saved'); showToast('Board saved') }
        catch { setSave('error') }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, board.id, snapshot, showToast])

  // Cmd/Ctrl + C copies the selected node into clipRef. The actual paste (duplicate)
  // is handled in the single 'paste' listener below so it never competes with
  // pasting an image - we write a marker to the clipboard so that paste event still
  // fires even when nothing else is on the clipboard. Ignored while typing in a note.
  useEffect(() => {
    if (!canEdit) return
    const onKey = (e) => {
      if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() !== 'c') return
      if (!sel || sel.kind === 'edge') return
      const n = nodes.find((x) => x.id === sel.id)
      if (n) { clipRef.current = n; navigator.clipboard?.writeText?.(NODE_COPY_MARKER).catch(() => {}) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, sel, nodes])

  // ── Undo / redo ─────────────────────────────────────────────────────────────
  // Record every DURABLE change (snapshot already strips selection/drag noise, so
  // dragging or clicking never spams the stack). Undo walks back through the stack
  // and rewrites nodes/edges/title; the write is flagged so it isn't re-recorded.
  useEffect(() => {
    if (!canEdit) return
    if (isRestoring.current) { isRestoring.current = false; return }
    history.current = history.current.slice(0, histIdx.current + 1) // drop any redo tail
    history.current.push(snapshot)
    if (history.current.length > 100) history.current.shift()       // cap long sessions
    histIdx.current = history.current.length - 1
    setHist({ canUndo: histIdx.current > 0, canRedo: false })
  }, [snapshot, canEdit])

  const restoreSnapshot = useCallback((snap) => {
    try {
      const d = JSON.parse(snap)
      isRestoring.current = true
      setTitle(d.title || 'Untitled Board')
      setNodes(withEditable(d.nodes || [], canEdit))
      setEdges(d.edges || [])
      setSel(null)
    } catch { /* skip a corrupt history entry */ }
  }, [setNodes, setEdges, canEdit])

  const undo = useCallback(() => {
    if (histIdx.current <= 0) return
    histIdx.current -= 1
    restoreSnapshot(history.current[histIdx.current])
    setHist({ canUndo: histIdx.current > 0, canRedo: histIdx.current < history.current.length - 1 })
  }, [restoreSnapshot])

  const redo = useCallback(() => {
    if (histIdx.current >= history.current.length - 1) return
    histIdx.current += 1
    restoreSnapshot(history.current[histIdx.current])
    setHist({ canUndo: histIdx.current > 0, canRedo: histIdx.current < history.current.length - 1 })
  }, [restoreSnapshot])

  // Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y = redo. Ignored while typing
  // so the browser's native text undo still works inside a note.
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

  // Auto-hide the "Saved" pill 3s after a save settles.
  useEffect(() => {
    if (save !== 'saved') return
    const t = setTimeout(() => setSave('idle'), 3000)
    return () => clearTimeout(t)
  }, [save])

  const fit = useCallback(() => fitView({ padding: 0.2, duration: 400 }), [fitView])

  // ── Restore on open ────────────────────────────────────────────────────────
  // Runs once. If this device holds a draft the server never confirmed (crash /
  // offline / closed mid-save), bring it back and let autosave push it up. Then
  // return to the exact viewport the owner left off at, like reopening a doc.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const serverSnap = JSON.stringify({
        title: board.title || 'Untitled Board',
        nodes: sanitizeNodes(board.nodes || []),
        edges: sanitizeEdges(board.edges || []),
      })
      const draft = canEdit && board.id ? await loadDraft(board.id) : null
      if (!alive) return
      let hasContent = (board.nodes || []).length > 0
      if (draft?.snapshot && draft.snapshot !== serverSnap) {
        try {
          const d = JSON.parse(draft.snapshot)
          setTitle(d.title || 'Untitled Board')
          setNodes(withEditable(d.nodes || [], canEdit))
          setEdges(d.edges || [])
          savedSnap.current = serverSnap // baseline = server, so autosave re-pushes the restored draft
          showToast('Restored your unsaved changes')
          hasContent = (d.nodes || []).length > 0
        } catch { /* corrupt draft - fall through to the server copy */ }
      }
      // Always frame the whole board on open so it's ready to read - no need to
      // reach for Fit. A brand-new empty board stays at a calm 100%. (Two rAFs so
      // React Flow has measured the nodes before we fit.)
      if (hasContent) {
        requestAnimationFrame(() => requestAnimationFrame(() => { if (alive) fitView({ padding: 0.18, duration: 0 }) }))
      }
      restoreReady.current = true
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Add content ────────────────────────────────────────────────────────────
  const addImageFiles = useCallback(async (files, at) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) return
    let i = 0
    for (const file of imgs) {
      try {
        const { src, width, height } = await fileToImage(file)
        const w = 240, h = Math.max(60, Math.round((240 * height) / width))
        const pos = { x: at.x + i * 28, y: at.y + i * 28 }
        setNodes((nds) => nds.concat({
          id: uid('img'), type: 'image', position: pos,
          style: { width: w, height: h },
          data: { src, editable: true },
        }))
        i++
      } catch { showToast('Could not read an image') }
    }
    if (imgs.length) showToast(`Pinned ${imgs.length} image${imgs.length > 1 ? 's' : ''}`)
  }, [setNodes, showToast])

  // Drop one of the FAB object types at `at`. Containers slide to the BACK of the
  // stack (they group visually and must sit under the evidence); everything else
  // lands on top where you added it.
  const addNodeOfType = useCallback((type, at, extra) => {
    setNodes((nds) => {
      const spec = {
        text: { style: { width: 180, height: 90 }, data: { text: '', editable: true } },
        clip: { style: { width: 210 }, data: { text: '', color: '#fbfaf6', editable: true } }, // no height - auto-fits
        callout: { style: { width: 240, height: 120 }, data: { text: 'Important!!!', color: '#fff3bf', editable: true } },
        stamp: { style: { width: 220, height: 60 }, data: { label: 'APPROVED', color: '#d0342c', editable: true } },
        redaction: { style: { width: 170, height: 26 }, data: { color: '#111111', editable: true } },
        annotation: { style: { width: 190, height: 130 }, data: { color: '#e5231b', editable: true } },
        drawing: { style: { width: 220, height: 160 }, data: { paths: [], editable: true } },
        sticker: { style: { width: 76, height: 76 }, data: { emoji: STICKER_EMOJIS[nds.length % STICKER_EMOJIS.length], editable: true } },
        profile: (() => {
          const i = nds.filter((n) => n.type === 'profile').length
          return { style: { width: 96, height: 96 }, data: { name: PROFILE_NAMES[i % PROFILE_NAMES.length], color: PROFILE_COLORS[i % PROFILE_COLORS.length], editable: true } }
        })(),
        container: { style: { width: 320, height: 240 }, data: { title: 'Section', color: CONTAINER_TINTS[nds.filter((n) => n.type === 'container').length % CONTAINER_TINTS.length], editable: true } },
      }[type]
      if (!spec) return nds
      // Cascade each new object so they never land in one stack (which buries them).
      const off = (nds.length % 8) * 28
      const node = { id: uid(type), type, position: { x: at.x + off, y: at.y + off }, ...spec }
      if (extra) node.data = { ...node.data, ...extra }
      if (type === 'container') { node.position = { x: at.x - 160, y: at.y - 120 }; node.zIndex = 0; return [node, ...nds] }
      return nds.concat(node)
    })
  }, [setNodes])

  const centerPos = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect()
    return screenToFlowPosition({ x: (r?.left || 0) + (r?.width || 800) / 2, y: (r?.top || 0) + (r?.height || 600) / 2 })
  }, [screenToFlowPosition])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    if (!canEdit) return
    const at = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    if (e.dataTransfer.files?.length) addImageFiles(e.dataTransfer.files, at)
  }, [canEdit, screenToFlowPosition, addImageFiles])

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }, [])

  // Single paste path. An image on the clipboard ALWAYS wins - so copying a node
  // earlier can never block pasting a screenshot. Only when there is no image, and
  // the clipboard carries our copy marker (or nothing), do we duplicate the copied
  // node. This is what lets Cmd+C on a node -> Cmd+V drop a duplicate.
  useEffect(() => {
    if (!canEdit) return
    const onPaste = (e) => {
      const items = [...(e.clipboardData?.items || [])]
      const files = items.filter((it) => it.kind === 'file' && it.type.startsWith('image/')).map((it) => it.getAsFile()).filter(Boolean)
      if (files.length) { e.preventDefault(); addImageFiles(files, centerPos()); return }
      const text = e.clipboardData?.getData('text') || ''
      if (clipRef.current && (text === NODE_COPY_MARKER || text === '')) {
        e.preventDefault()
        const src = clipRef.current
        const copy = { ...src, id: uid(src.type), selected: false, position: { x: src.position.x + 30, y: src.position.y + 30 }, data: { ...src.data } }
        setNodes((nds) => nds.concat(copy))
        showToast('Pasted a copy')
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [canEdit, addImageFiles, centerPos, setNodes, showToast])

  // Ignore self-connections - a thread from a node back to itself collapses to a
  // stray pin in the middle of the card (no visible string). Only wire two cards.
  const onConnect = useCallback((c) => {
    if (c.source === c.target) return
    setEdges((eds) => addEdge(c, eds))
  }, [setEdges])

  // DOUBLE-click/tap empty canvas to drop a note, already open for typing. We count
  // taps in a short window ourselves rather than trust e.detail, which is unreliable
  // on touch. onPaneClick only fires on the pane, so nodes are never affected.
  const paneTaps = useRef([])
  const onPaneClick = useCallback((e) => {
    if (!canEdit) return
    const t = e.timeStamp
    paneTaps.current = paneTaps.current.filter((x) => t - x < 450)
    paneTaps.current.push(t)
    if (paneTaps.current.length >= 2) {
      paneTaps.current = []
      addNodeOfType('clip', screenToFlowPosition({ x: e.clientX, y: e.clientY }), { autoEdit: true })
    }
  }, [canEdit, addNodeOfType, screenToFlowPosition])

  // Hold SHIFT while dragging a node to snap it into a straight line with the
  // node(s) it's wired to - align centers on X or Y so the thread runs perfectly
  // horizontal or vertical. FloatingEdge draws boundary-to-boundary, so aligned
  // centers give a clean straight string.
  const onNodeDrag = useCallback((e, node) => {
    if (!e.shiftKey) return
    const conn = new Set()
    edges.forEach((ed) => { if (ed.source === node.id) conn.add(ed.target); if (ed.target === node.id) conn.add(ed.source) })
    if (!conn.size) return
    const dim = (n) => ({ w: n.measured?.width ?? n.width ?? n.style?.width ?? 200, h: n.measured?.height ?? n.height ?? n.style?.height ?? 140 })
    const d = dim(node)
    const cx = node.position.x + d.w / 2
    const cy = node.position.y + d.h / 2
    const SNAP = 34
    let nx = node.position.x, ny = node.position.y, bestX = SNAP, bestY = SNAP
    for (const n of nodes) {
      if (!conn.has(n.id)) continue
      const nd = dim(n)
      const dx = Math.abs(cx - (n.position.x + nd.w / 2))
      const dy = Math.abs(cy - (n.position.y + nd.h / 2))
      if (dx < bestX) { bestX = dx; nx = n.position.x + nd.w / 2 - d.w / 2 }
      if (dy < bestY) { bestY = dy; ny = n.position.y + nd.h / 2 - d.h / 2 }
    }
    if (nx !== node.position.x || ny !== node.position.y) {
      setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position: { x: nx, y: ny } } : n)))
    }
  }, [nodes, edges, setNodes])

  // Apply per-node lock (not draggable) and send-to-back (renders behind others).
  // Locked stays selectable so you can still open it and unlock.
  const styledNodes = nodes.map((n) => {
    const locked = n.data?.locked === true
    const back = n.data?.back === true
    if (!locked && !back) return n
    return { ...n, draggable: locked ? false : undefined, zIndex: back ? -1 : n.zIndex }
  })

  // Theme edges live. Straight routing. When a node is selected, its connections
  // LIGHT UP (thicker + glowing) - but every OTHER thread stays fully solid (never
  // dimmed), so the board always reads clearly.
  const selNodeId = sel && sel.kind !== 'edge' ? sel.id : null
  const styledEdges = edges.map((e) => {
    const stroke = e.data?.color || theme.accent
    // Light a thread when its node is selected OR when the thread itself is clicked.
    const lit = (selNodeId && (e.source === selNodeId || e.target === selNodeId)) || (sel?.kind === 'edge' && sel.id === e.id)
    return {
      ...e,
      type: 'floating', // auto-connect at the nearest point on each node's boundary
      animated: lit || e.animated,
      zIndex: 1001, // thread lies ON TOP of the pinned photos/notes (realistic string)
      style: {
        ...e.style, stroke, opacity: 1, // solid at all times
        strokeWidth: lit ? 4.6 : 2.7,
        // Lit: a bright double glow so a traced connection reads unmistakably. Idle:
        // a soft cast shadow so the thread looks like a physical string on the board.
        filter: lit
          ? `drop-shadow(0 0 9px ${stroke}) drop-shadow(0 0 4px ${stroke}) brightness(1.12)`
          : 'drop-shadow(0.5px 1.6px 1px rgba(0,0,0,0.42))',
      },
    }
  })

  function exportPng() {
    // Capture the whole board window - frame, lamps and all - minus the UI chrome.
    const el = wrapRef.current
    if (!el) return
    const hide = (n) => {
      const c = n.classList
      return !c || (!c.contains('react-flow__minimap') && !c.contains('react-flow__controls') && !c.contains('fx-noexport'))
    }
    import('html-to-image').then(({ toPng }) =>
      toPng(el, { backgroundColor: theme.canvas, pixelRatio: 2, filter: hide })
        .then((url) => { const a = document.createElement('a'); a.href = url; a.download = `${(title || 'board').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`; a.click() })
    ).catch(() => showToast('Export failed'))
  }

  function share() {
    const url = `${window.location.origin}/?id=${board.id}`
    navigator.clipboard.writeText(url).then(() => showToast('Share link copied')).catch(() => showToast('Copy failed'))
  }

  const saveLabel = { saving: 'Saving…', saved: 'Saved', error: 'Offline · safe on this device', idle: '' }[save]

  return (
    <div ref={wrapRef} style={{ position: 'fixed', inset: 0, background: theme.canvas }}
      onDrop={onDrop} onDragOver={onDragOver}>
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
        onNodesChange={canEdit ? onNodesChange : undefined}
        onEdgesChange={canEdit ? onEdgesChange : undefined}
        onConnect={onConnect}
        onSelectionChange={({ nodes: ns, edges: es }) => {
          const next = ns.length === 1
            ? { kind: ns[0].type, id: ns[0].id }
            : es.length === 1 ? { kind: 'edge', id: es[0].id } : null
          // Return the SAME reference when unchanged so React bails out - otherwise
          // a fresh object every fire loops against the glow re-render.
          setSel((prev) => (prev?.id === next?.id && prev?.kind === next?.kind ? prev : next))
        }}
        onPaneClick={onPaneClick}
        onNodeDrag={canEdit ? onNodeDrag : undefined}
        onMove={onMove}
        colorMode={themeName}
        connectionMode="loose"
        connectionLineType="straight"
        connectionLineStyle={{ stroke: theme.accent, strokeWidth: 2.4 }}
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
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.6} color={theme.dot} />
        <MiniMap
          className="fx-minimap fx-mobile-hide" pannable zoomable position="bottom-right"
          maskColor={themeName === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)'}
          style={{ background: theme.minimapBg, border: `1px solid ${theme.panelBorder}`, right: 42, bottom: 42, width: 118, height: 82 }}
          nodeColor={theme.minimapNode}
          nodeStrokeColor={theme.accent}
        />
      </ReactFlow>

      {/* Empty-state hint */}
      {canEdit && nodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', color: theme.muted, animation: 'fx-rise .5s both' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🧵</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: theme.text }}>DROP EVIDENCE ONTO THE BOARD</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Drag images in, paste from clipboard, or double-click to add a note.</div>
            <div style={{ fontSize: 13, marginTop: 2 }}>Drag from a node's edge to wire connections.</div>
          </div>
        </div>
      )}

      {/* Bottom-left add menu (text / circle / person / draw / sticker / group) */}
      {canEdit && <AddMenu onAdd={(type, extra) => addNodeOfType(type, centerPos(), extra)} onAddImage={() => fileRef.current?.click()} />}

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="fx-noexport fx-topbar" style={{ position: 'absolute', top: 42, left: 42, right: 42, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 8px', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto' }}>
          <button onClick={onBack} title="Back to boards" style={iconBtn}><Icon name="back" size={16} /></button>
          {canEdit ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mono fx-mobile-hide"
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, width: Math.min(320, Math.max(120, title.length * 9 + 20)), color: 'var(--text)' }}
            />
          ) : (
            <span className="mono fx-mobile-hide" style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
          )}
          {saveLabel && (
            <span className="fx-mobile-hide" style={{ fontSize: 11, color: save === 'error' ? 'var(--accent)' : 'var(--muted)', marginLeft: 2 }}>· {saveLabel}</span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div ref={toolbarRef} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 6px', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto' }}>
          <span className="mono fx-mobile-hide" style={{ fontSize: 10.5, color: 'var(--muted)', padding: '0 5px', minWidth: 40, textAlign: 'center' }}>{zoomPct}%</span>
          {canEdit && <button onClick={undo} disabled={!hist.canUndo} title="Undo (Cmd/Ctrl+Z)" style={{ ...iconBtn, opacity: hist.canUndo ? 1 : 0.35, cursor: hist.canUndo ? 'pointer' : 'default' }}><Icon name="undo" size={16} /></button>}
          {canEdit && <button onClick={redo} disabled={!hist.canRedo} title="Redo (Cmd/Ctrl+Shift+Z)" style={{ ...iconBtn, opacity: hist.canRedo ? 1 : 0.35, cursor: hist.canRedo ? 'pointer' : 'default' }}><Icon name="redo" size={16} /></button>}
          <button onClick={fit} title="Fit to view" style={iconBtn}><Icon name="fit" size={16} /></button>
          <button onClick={exportPng} title="Export PNG" style={iconBtn}><Icon name="download" size={16} /></button>
          {board.id && <button onClick={share} title="Copy share link" style={iconBtn}><Icon name="share" size={16} /></button>}
          <button onClick={() => setShowReport(true)} title="Case report" style={iconBtn}><Icon name="report" size={16} /></button>
          {canEdit && <button onClick={() => fileRef.current?.click()} title="Add image" style={iconBtn}><Icon name="image" size={16} /></button>}
          {canEdit && <button onClick={() => addNodeOfType('sticker', centerPos())} title="Add sticker" style={iconBtn}><Icon name="sticker" size={16} /></button>}
          <button onClick={onToggleTheme} title="Toggle theme" style={iconBtn}><Icon name={themeName === 'dark' ? 'sun' : 'moon'} size={16} /></button>
          {canEdit && <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => { if (e.target.files?.length) addImageFiles(e.target.files, centerPos()); e.target.value = '' }} />}
        </div>
      </div>

      {/* ── Inspector (right panel) ─────────────────────────────────────────── */}
      {canEdit && sel && (() => {
        const el = sel.kind === 'edge' ? edges.find((e) => e.id === sel.id) : nodes.find((n) => n.id === sel.id)
        if (!el) return null
        return (
          <Inspector
            kind={sel.kind} data={el.data || {}} width={panelW}
            onNode={(patch) => updateNodeData(sel.id, patch)}
            onEdge={(patch) => setEdges((eds) => eds.map((x) => (x.id === sel.id ? { ...x, data: { ...x.data, ...patch } } : x)))}
          />
        )
      })()}

      {/* Fixed board frame. Window-anchored, pointer-events off, so the corkboard
          still pans/zooms inside. */}
      <Decorations />

      {showReport && <ReportModal title={title} nodes={nodes} edges={edges} onClose={() => setShowReport(false)} />}
    </div>
  )
}

const iconBtn = {
  display: 'grid', placeItems: 'center', width: 27, height: 27, borderRadius: 7,
  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)',
}

export default function Board(props) {
  return (
    <ReactFlowProvider>
      <BoardInner {...props} />
    </ReactFlowProvider>
  )
}
