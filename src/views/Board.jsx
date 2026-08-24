import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, useReactFlow, MarkerType,
} from '@xyflow/react'
import ImageNode from '../components/ImageNode.jsx'
import NoteNode from '../components/NoteNode.jsx'
import { NOTE_TINTS } from '../lib/constants.js'
import { updateBoard } from '../lib/api.js'
import { fileToImage } from '../lib/image.js'
import { Icon } from '../components/Icon.jsx'

const NODE_TYPES = { image: ImageNode, note: NoteNode }
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
  const { screenToFlowPosition, fitView } = useReactFlow()
  const wrapRef = useRef(null)
  const fileRef = useRef(null)
  const firstSave = useRef(true)

  // ── Persistence: debounced autosave (owner only) ──────────────────────────
  useEffect(() => {
    if (!canEdit || !board.id) return
    if (firstSave.current) { firstSave.current = false; return }
    setSave('saving')
    const h = setTimeout(async () => {
      try {
        await updateBoard(board.id, { title, nodes: sanitizeNodes(nodes), edges: sanitizeEdges(edges) })
        setSave('saved')
      } catch { setSave('error') }
    }, 1100)
    return () => clearTimeout(h)
  }, [nodes, edges, title, canEdit, board.id])

  // Cmd/Ctrl+S -> force an immediate save (still debounced follow-up is harmless).
  useEffect(() => {
    if (!canEdit) return
    const onKey = async (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!board.id) return
        setSave('saving')
        try { await updateBoard(board.id, { title, nodes: sanitizeNodes(nodes), edges: sanitizeEdges(edges) }); setSave('saved'); showToast('Board saved') }
        catch { setSave('error') }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, board.id, title, nodes, edges, showToast])

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
    addNote(screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }, [canEdit, addNote, screenToFlowPosition])

  // Theme edges + arrowheads live (color follows the current palette).
  const styledEdges = edges.map((e) => ({
    ...e,
    style: { stroke: theme.accent, strokeWidth: 2.4, ...e.style },
    markerEnd: { type: MarkerType.ArrowClosed, color: theme.accent, width: 18, height: 18 },
  }))

  function exportPng() {
    const el = wrapRef.current?.querySelector('.react-flow__viewport')?.parentElement
    if (!el) return
    import('html-to-image').then(({ toPng }) =>
      toPng(el, { backgroundColor: theme.canvas, pixelRatio: 2, filter: (n) => !n.classList?.contains('react-flow__minimap') && !n.classList?.contains('react-flow__controls') })
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
        onNodesChange={canEdit ? onNodesChange : undefined}
        onEdgesChange={canEdit ? onEdgesChange : undefined}
        onConnect={onConnect}
        onDoubleClick={onPaneDoubleClick}
        onMove={(_, vp) => setZoomPct(Math.round(vp.zoom * 100))}
        colorMode={themeName}
        connectionMode="loose"
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
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable zoomable position="bottom-right"
          maskColor={themeName === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)'}
          style={{ background: theme.minimapBg, border: `1px solid ${theme.panelBorder}` }}
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
      <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '7px 10px', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto' }}>
          <button onClick={onBack} title="Back to boards" style={iconBtn}><Icon name="back" /></button>
          <img src="/icon.png" alt="" width={22} height={22} style={{ borderRadius: 6 }} />
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
          <button onClick={onToggleTheme} title="Toggle theme" style={iconBtn}><Icon name={themeName === 'dark' ? 'sun' : 'moon'} /></button>
        </div>
      </div>

      {/* ── Insert dock ─────────────────────────────────────────────────────── */}
      {canEdit && (
        <div style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 6, boxShadow: 'var(--shadow)' }}>
          <button onClick={() => fileRef.current?.click()} style={dockBtn}><Icon name="image" /> Image</button>
          <button onClick={() => addNote(centerPos())} style={dockBtn}><Icon name="note" /> Note</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => { if (e.target.files?.length) addImageFiles(e.target.files, centerPos()); e.target.value = '' }} />
        </div>
      )}
    </div>
  )
}

const iconBtn = {
  display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 8,
  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)',
}
const dockBtn = {
  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10,
  background: 'var(--panel-2)', border: '1px solid var(--border)', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, color: 'var(--text)',
}

export default function Board(props) {
  return (
    <ReactFlowProvider>
      <BoardInner {...props} />
    </ReactFlowProvider>
  )
}
