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
import MarkerNode from '../components/MarkerNode.jsx'
import WaxSealNode from '../components/WaxSealNode.jsx'
import CrosshairNode from '../components/CrosshairNode.jsx'
import SpotlightNode from '../components/SpotlightNode.jsx'
import { FloatingEdge } from '../components/FloatingEdge.jsx'
import { Inspector } from '../components/Inspector.jsx'
import { Decorations } from '../components/Decorations.jsx'
import { ReportModal } from '../components/ReportModal.jsx'
import { AddMenu } from '../components/AddMenu.jsx'
import { BoardTopBar, MultiSelectBar } from '../components/BoardTopBar.jsx'
import { fileToImage } from '../lib/image.js'
import { saveViewport } from '../lib/localBoard.js'
import {
  uid, withEditable, boardSnapshot, addNode, arrangeZ,
  groupNodes, ungroupNodes, threadPairs, addThreads, snapToConnected, styleNodes, styleEdges,
} from '../lib/boardGraph.js'
import { useBoardPersistence } from '../hooks/useBoardPersistence.js'
import { useUndoRedo } from '../hooks/useUndoRedo.js'
import { useNodeClipboard } from '../hooks/useNodeClipboard.js'

const NODE_TYPES = {
  image: ImageNode, note: NoteNode, text: TextNode, profile: ProfileNode,
  sticker: StickerNode, container: ContainerNode, annotation: AnnotationNode, drawing: DrawingNode,
  callout: CalloutNode, clip: ClipNode, stamp: StampNode, redaction: RedactionNode,
  marker: MarkerNode, wax: WaxSealNode, crosshair: CrosshairNode, spotlight: SpotlightNode,
}
const EDGE_TYPES = { floating: FloatingEdge }

const typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')

function BoardInner({ board, canEdit, theme, themeName, onToggleTheme, onBack, showToast }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(withEditable(board.nodes || [], canEdit))
  const [edges, setEdges, onEdgesChange] = useEdgesState(board.edges || [])
  const [title, setTitle] = useState(board.title || 'Untitled Board')
  const [zoomPct, setZoomPct] = useState(100)
  const { screenToFlowPosition, fitView, setViewport, updateNodeData, getViewport } = useReactFlow()
  const [sel, setSel] = useState(null) // { kind:'note'|'image'|'edge', id }
  const [multiCount, setMultiCount] = useState(0) // # of selected top-level nodes (for Group)
  const [showReport, setShowReport] = useState(false)
  const wrapRef = useRef(null)
  const fileRef = useRef(null)
  const toolbarRef = useRef(null)
  const [panelW, setPanelW] = useState(264) // inspector matches the toolbar's width
  const vpRef = useRef(null)          // latest viewport {x,y,zoom} for the local draft
  const vpTimer = useRef(null)        // throttle for persisting the viewport

  // `content` mirrors nodes/edges for snapshot purposes, EXCEPT while a drag is in
  // flight, when it stays pinned to the pre-drag value and catches up the instant
  // the drag ends. React Flow updates node positions on every pointermove, so
  // without this freeze the whole board (incl. base64 image data) got re-stringified
  // - and useUndoRedo re-recorded - on every single frame of a drag. Driven by the
  // explicit drag start/stop callbacks (the per-change `dragging` flag is not
  // reliable), and adjusted directly during render (React's documented pattern),
  // not in an effect, so it never lags a frame behind.
  const [dragging, setDragging] = useState(false)
  const onDragStart = useCallback(() => setDragging(true), [])
  const onDragStop = useCallback(() => setDragging(false), [])
  // NodeResizer has no board-level callback, but React Flow flags the node with
  // `resizing` on every dimension change, so a resize is frozen the same way.
  const busy = dragging || nodes.some((n) => n.resizing)
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

  const { save, restoreReady } = useBoardPersistence({ board, canEdit, snapshot, restore, fitView, setViewport, showToast })
  const { undo, redo, canUndo, canRedo } = useUndoRedo({ snapshot, canEdit, restore })

  // Remember where the owner is looking (zoom/pan), throttled, so an accidental
  // refresh reopens at the exact same spot instead of snapping back to fit.
  const onMove = useCallback((_, vp) => {
    setZoomPct(Math.round(vp.zoom * 100))
    vpRef.current = vp
    if (!board.id || !restoreReady.current || vpTimer.current) return
    vpTimer.current = setTimeout(() => { vpTimer.current = null; saveViewport(board.id, vpRef.current) }, 300)
  }, [board.id, restoreReady])

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

  const addNodeOfType = useCallback((type, at, extra) => setNodes((nds) => addNode(nds, type, at, extra)), [setNodes])

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

  useNodeClipboard({ canEdit, sel, nodes, setNodes, addImageFiles, centerPos, showToast })

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

  // Cmd/Ctrl+G groups the selection; add Shift to ungroup.
  useEffect(() => {
    if (!canEdit) return
    const onKey = (e) => {
      if (typing() || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'g') return
      e.preventDefault()
      if (e.shiftKey) ungroupSelected(); else groupSelected()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, groupSelected, ungroupSelected])

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
  // node(s) it's wired to. FloatingEdge draws boundary-to-boundary, so aligned
  // centers give a clean straight string.
  const onNodeDrag = useCallback((e, node) => {
    if (!e.shiftKey) return
    const pos = snapToConnected(node, nodes, edges)
    if (pos) setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position: pos } : n)))
  }, [nodes, edges, setNodes])

  // Memoized: zoom/pan re-renders every frame (zoomPct), so keep these arrays
  // referentially stable unless their inputs change - React Flow then skips diffing.
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
          setMultiCount(ns.filter((n) => !n.parentId).length)
        }}
        onPaneClick={onPaneClick}
        onNodeDrag={canEdit ? onNodeDrag : undefined}
        onNodeDragStart={onDragStart}
        onNodeDragStop={onDragStop}
        onSelectionDragStart={onDragStart}
        onSelectionDragStop={onDragStop}
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

      {/* Bottom-left add menu (text / callout / circle / person / stamp / redact /
          marker / wax seal / crosshair / spotlight / draw / group) */}
      {canEdit && <AddMenu onAdd={(type, extra) => addNodeOfType(type, centerPos(), extra)} onAddImage={() => fileRef.current?.click()} />}

      <BoardTopBar
        canEdit={canEdit} title={title} onTitle={setTitle} save={save} zoomPct={zoomPct} onBack={onBack} toolbarRef={toolbarRef}
        undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
        onFit={fit} onExport={exportPng} onShare={board.id ? share : null} onReport={() => setShowReport(true)}
        onAddImage={() => fileRef.current?.click()} onAddSticker={() => addNodeOfType('sticker', centerPos())}
        onToggleTheme={onToggleTheme} themeName={themeName}
      />
      {canEdit && <input ref={fileRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => { if (e.target.files?.length) addImageFiles(e.target.files, centerPos()); e.target.value = '' }} />}

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
