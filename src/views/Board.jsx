import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap,
  useNodesState, useEdgesState, addEdge, useReactFlow,
} from '@xyflow/react'
// React Flow's stylesheet rides the LAZY board chunk, not the entry: 15 kB of CSS
// that sign-in and the gallery never paint a single rule of.
import '@xyflow/react/dist/style.css'
import { FloatingEdge } from '../components/FloatingEdge.jsx'
import { Icon } from '../components/Icon.jsx'
import { Inspector } from '../components/Inspector.jsx'
import { Decorations } from '../components/Decorations.jsx'
import { ReportModal } from '../components/ReportModal.jsx'
import { CursorTools } from '../components/CursorTools.jsx'
import { SnapGuides } from '../components/SnapGuides.jsx'
import { BoardTopBar, MultiSelectBar } from '../components/BoardTopBar.jsx'
import { makeThumbnail } from '../lib/thumbnail.js'
import { TOOL_ITEMS } from '../lib/tools.js'
// Every node type - its renderer, defaults, inspector panel and ring entry -
// is declared once in the registry; this view just reads the renderer map off it.
import { NODE_TYPES } from '../lib/nodeTypes.js'
import {
  withEditable, boardSnapshot, arrangeZ,
  groupNodes, ungroupNodes, threadPairs, addThreads, styleNodes, styleEdges,
} from '../lib/boardGraph.js'
import { useBoardPersistence } from '../hooks/useBoardPersistence.js'
import { useUndoRedo } from '../hooks/useUndoRedo.js'
import { useNodeClipboard } from '../hooks/useNodeClipboard.js'
import { useAddContent } from '../hooks/useAddContent.js'
import { useLineUp } from '../hooks/useLineUp.js'
import { useBoardShortcuts } from '../hooks/useBoardShortcuts.js'
import { useBoardExport } from '../hooks/useBoardExport.js'

const EDGE_TYPES = { floating: FloatingEdge }

function BoardInner({ board, canEdit, readOnly, theme, themeName, onToggleTheme, onBack, showToast }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(withEditable(board.nodes || [], canEdit))
  const [edges, setEdges, onEdgesChange] = useEdgesState(board.edges || [])
  const [title, setTitle] = useState(board.title || 'Untitled Board')
  const { screenToFlowPosition, flowToScreenPosition, fitView, setViewport, updateNodeData, getViewport } = useReactFlow()
  const [sel, setSel] = useState(null) // { kind:'note'|'image'|'edge', id }
  const [multiCount, setMultiCount] = useState(0) // # of selected top-level nodes (for Group)
  const [showReport, setShowReport] = useState(false)
  const wrapRef = useRef(null)
  const fileRef = useRef(null)
  const fabRef = useRef(null)          // bottom-left ring summon
  const toolbarRef = useRef(null)
  const [panelW, setPanelW] = useState(264) // inspector matches the toolbar's width

  // CMD/SHIFT drag line-up: the snap guides, the dashed size ghost, and `busy`
  // (a drag or resize in flight), which is what freezes the snapshot below.
  const { busy, guides, ghost, hintBox, onDragStart, onDragStop, onNodeDrag, onNodesChangeSnap } =
    useLineUp({ canEdit, nodes, edges, setNodes, onNodesChange, flowToScreenPosition, getViewport })

  // `content` mirrors nodes/edges for snapshot purposes, EXCEPT while a drag or
  // resize is in flight, when it stays pinned to the pre-drag value and catches up
  // the instant the gesture ends - otherwise the whole board (incl. base64 image
  // data) got re-stringified, and useUndoRedo re-recorded, on every frame of a
  // drag. Adjusted directly during render (React's documented pattern), not in an
  // effect, so it never lags a frame behind.
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

  // Everything that puts something new on the board: drop, paste, the file
  // picker, dragged links, the tool ring and double-tap-to-note.
  const {
    addFiles, addLink, addNodeOfType, centerPos, pastePos,
    onDrop, onDragOver, onPaneClick, onPaneDoubleClick,
    ring, pickRingTool, closeRing, openRingAtCenter, openRingAtFab,
  } = useAddContent({ canEdit, readOnly, setNodes, showToast, screenToFlowPosition, wrapRef, fabRef, fileRef })

  useNodeClipboard({ canEdit, readOnly, nodes, setNodes, edges, setEdges, addFiles, addLink, pastePos, showToast })

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

  useBoardShortcuts({ canEdit, nodes, groupSelected, ungroupSelected })

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

  const { exportPng, share } = useBoardExport({
    boardId: board.id, title, wrapRef, canvasColor: theme.canvas, showToast, fitView, getViewport, setViewport,
  })

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

      {/* Empty-state hint. A read-only viewer gets it too - an empty corkboard
          with no caption reads as a page that failed to load. */}
      {nodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', color: theme.muted, animation: 'fx-rise .5s both' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🧵</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: theme.text }}>
              {canEdit ? 'DROP EVIDENCE ONTO THE BOARD' : 'NOTHING PINNED HERE YET'}
            </div>
            {canEdit ? (
              <>
                <div style={{ fontSize: 13, marginTop: 6 }}>Drag in images, PDFs, audio or links - paste from the clipboard - or double-click to add a note.</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>Drag from a node's edge to wire connections.</div>
              </>
            ) : (
              <div style={{ fontSize: 13, marginTop: 6 }}>This board has no evidence on it yet.</div>
            )}
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
