import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, useReactFlow,
} from '@xyflow/react'
import ImageNode from '../components/ImageNode.jsx'
import NoteNode from '../components/NoteNode.jsx'
import { FloatingEdge } from '../components/FloatingEdge.jsx'
import { Inspector } from '../components/Inspector.jsx'
import { Decorations } from '../components/Decorations.jsx'
import { ReportModal } from '../components/ReportModal.jsx'
import { NOTE_TINTS } from '../lib/constants.js'
import { updateBoard } from '../lib/api.js'
import { fileToImage } from '../lib/image.js'
import { Icon } from '../components/Icon.jsx'

const NODE_TYPES = { image: ImageNode, note: NoteNode }
const EDGE_TYPES = { floating: FloatingEdge }
let SEQ = 0
const uid = (p) => `${p}-${Date.now().toString(36)}-${(SEQ++).toString(36)}`

// Keep only the durable board shape when persisting - drop React Flow's
// transient bookkeeping (selection/drag state) and the UI-only `editable` flag.
function sanitizeNodes(nodes) {
  return nodes.map((n) => {
    const data = { ...(n.data || {}) }
    delete data.editable
    return { id: n.id, type: n.type, position: n.position, style: n.style, data }
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
  const [decor, setDecor] = useState(true) // show board frame + lamps
  const [showReport, setShowReport] = useState(false)
  const wrapRef = useRef(null)
  const fileRef = useRef(null)
  const savedSnap = useRef(null)

  // ── Persistence: debounced autosave (owner only) ──────────────────────────
  // Persist only when the DURABLE content changes. sanitize strips selection /
  // drag / hover state, so merely opening or clicking a board never re-saves and
  // never bumps its gallery order.
  const snapshot = JSON.stringify({ title, nodes: sanitizeNodes(nodes), edges: sanitizeEdges(edges) })
  useEffect(() => {
    if (!canEdit || !board.id) return
    if (savedSnap.current === null) { savedSnap.current = snapshot; return } // initial load - never save
    if (snapshot === savedSnap.current) return                              // no real change
    setSave('saving')
    const h = setTimeout(async () => {
      try {
        await updateBoard(board.id, JSON.parse(snapshot))
        savedSnap.current = snapshot
        setSave('saved')
      } catch { setSave('error') }
    }, 1100)
    return () => clearTimeout(h)
  }, [snapshot, canEdit, board.id])

  // Cmd/Ctrl+S -> force an immediate save (still debounced follow-up is harmless).
  useEffect(() => {
    if (!canEdit) return
    const onKey = async (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!board.id) return
        setSave('saving')
        try { await updateBoard(board.id, JSON.parse(snapshot)); savedSnap.current = snapshot; setSave('saved'); showToast('Board saved') }
        catch { setSave('error') }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, board.id, snapshot, showToast])

  // Auto-hide the "Saved" pill 3s after a save settles.
  useEffect(() => {
    if (save !== 'saved') return
    const t = setTimeout(() => setSave('idle'), 3000)
    return () => clearTimeout(t)
  }, [save])

  const fit = useCallback(() => fitView({ padding: 0.2, duration: 400 }), [fitView])
  useEffect(() => { const t = setTimeout(fit, 80); return () => clearTimeout(t) }, [fit])

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

  const addNote = useCallback((at) => {
    setNodes((nds) => nds.concat({
      id: uid('note'), type: 'note', position: at,
      style: { width: 200, height: 140 },
      data: { text: '', color: NOTE_TINTS[nds.length % NOTE_TINTS.length], editable: true },
    }))
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

  // Paste an image from the clipboard anywhere on the board.
  useEffect(() => {
    if (!canEdit) return
    const onPaste = (e) => {
      const items = [...(e.clipboardData?.items || [])]
      const files = items.filter((it) => it.kind === 'file' && it.type.startsWith('image/')).map((it) => it.getAsFile())
      if (files.length) { e.preventDefault(); addImageFiles(files, centerPos()) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [canEdit, addImageFiles, centerPos])

  const onConnect = useCallback((c) => setEdges((eds) => addEdge(c, eds)), [setEdges])

  const onPaneDoubleClick = useCallback((e) => {
    if (!canEdit) return
    // Only add a note on the EMPTY board - never when double-clicking on/over a
    // node (that gesture is for editing the node's caption/text).
    if (e.target.closest?.('.react-flow__node')) return
    addNote(screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }, [canEdit, addNote, screenToFlowPosition])

  // Theme edges + arrowheads live. Straight routing. When a node is selected, its
  // connections LIGHT UP (thicker, glowing, animated) and the rest dim - so you
  // can trace what an object touches at a glance.
  const selNodeId = sel && sel.kind !== 'edge' ? sel.id : null
  const styledEdges = edges.map((e) => {
    const stroke = e.data?.color || theme.accent
    const lit = selNodeId && (e.source === selNodeId || e.target === selNodeId)
    const dim = selNodeId && !lit
    return {
      ...e,
      type: 'floating', // auto-connect at the nearest point on each node's boundary
      animated: lit || e.animated,
      zIndex: 1001, // thread lies ON TOP of the pinned photos/notes (realistic string)
      style: {
        ...e.style, stroke,
        strokeWidth: lit ? 3.8 : 2.7,
        opacity: dim ? 0.25 : 1,
        // Cast shadow so the thread reads as a physical string lying on the board.
        filter: lit ? `drop-shadow(0 0 5px ${stroke})` : 'drop-shadow(0.5px 1.6px 1px rgba(0,0,0,0.42))',
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

  const saveLabel = { saving: 'Saving…', saved: 'Saved', error: 'Save failed', idle: '' }[save]

  return (
    <div ref={wrapRef} style={{ position: 'fixed', inset: 0, background: theme.canvas }}
      onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={canEdit ? onNodesChange : undefined}
        onEdgesChange={canEdit ? onEdgesChange : undefined}
        onConnect={onConnect}
        onSelectionChange={({ nodes: ns, edges: es }) => {
          const next = ns.length === 1
            ? { kind: ns[0].type === 'image' ? 'image' : 'note', id: ns[0].id }
            : es.length === 1 ? { kind: 'edge', id: es[0].id } : null
          // Return the SAME reference when unchanged so React bails out - otherwise
          // a fresh object every fire loops against the glow re-render.
          setSel((prev) => (prev?.id === next?.id && prev?.kind === next?.kind ? prev : next))
        }}
        onDoubleClick={onPaneDoubleClick}
        onMove={(_, vp) => setZoomPct(Math.round(vp.zoom * 100))}
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
        selectionOnDrag
        panOnScroll
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.6} color={theme.dot} />
        <Controls showInteractive={false} position="bottom-left" style={{ left: 42, bottom: 42 }} />
        <MiniMap
          pannable zoomable position="bottom-right"
          maskColor={themeName === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)'}
          style={{ background: theme.minimapBg, border: `2px solid ${theme.panelBorder}`, right: 42, bottom: 42 }}
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

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="fx-noexport" style={{ position: 'absolute', top: 42, left: 42, right: 42, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '7px 10px', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto' }}>
          <button onClick={onBack} title="Back to boards" style={iconBtn}><Icon name="back" /></button>
          {canEdit ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mono"
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, width: Math.min(320, Math.max(120, title.length * 9 + 20)), color: 'var(--text)' }}
            />
          ) : (
            <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
          )}
          {saveLabel && (
            <span style={{ fontSize: 11, color: save === 'error' ? 'var(--accent)' : 'var(--muted)', marginLeft: 2 }}>· {saveLabel}</span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '6px 8px', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', padding: '0 6px', minWidth: 44, textAlign: 'center' }}>{zoomPct}%</span>
          <button onClick={fit} title="Fit to view" style={iconBtn}><Icon name="fit" /></button>
          <button onClick={exportPng} title="Export PNG" style={iconBtn}><Icon name="download" /></button>
          {board.id && <button onClick={share} title="Copy share link" style={iconBtn}><Icon name="share" /></button>}
          <button onClick={() => setShowReport(true)} title="Case report" style={iconBtn}><Icon name="report" /></button>
          {canEdit && <button onClick={() => fileRef.current?.click()} title="Add image" style={iconBtn}><Icon name="image" /></button>}
          <button onClick={() => setDecor((d) => !d)} title={decor ? 'Hide frame & lamps' : 'Show frame & lamps'} style={{ ...iconBtn, color: decor ? 'var(--accent)' : 'var(--muted)' }}><Icon name="bulb" /></button>
          <button onClick={onToggleTheme} title="Toggle theme" style={iconBtn}><Icon name={themeName === 'dark' ? 'sun' : 'moon'} /></button>
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
            kind={sel.kind} data={el.data || {}}
            onNode={(patch) => updateNodeData(sel.id, patch)}
            onEdge={(patch) => setEdges((eds) => eds.map((x) => (x.id === sel.id ? { ...x, data: { ...x.data, ...patch } } : x)))}
          />
        )
      })()}

      {/* Fixed board frame + lamps (toggleable). Window-anchored, pointer-events
          off, so the corkboard still pans/zooms inside. */}
      {decor && <Decorations />}

      {showReport && <ReportModal title={title} nodes={nodes} edges={edges} onClose={() => setShowReport(false)} />}
    </div>
  )
}

const iconBtn = {
  display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 8,
  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)',
}

export default function Board(props) {
  return (
    <ReactFlowProvider>
      <BoardInner {...props} />
    </ReactFlowProvider>
  )
}
