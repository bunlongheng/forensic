// Pure board-graph helpers shared by the Board view and its hooks. No React and
// no DOM: every function takes plain nodes/edges and returns new values, so the
// canvas logic is unit-testable without a canvas.
import { PROFILE_NAMES, PROFILE_COLORS, STICKER_EMOJIS, CONTAINER_TINTS } from './constants.js'

// Written to the system clipboard on Cmd/Ctrl+C of a node, so a following Cmd/Ctrl+V
// reliably fires a 'paste' event (which we use to duplicate the node) without ever
// shadowing a real image paste.
export const NODE_COPY_MARKER = 'forensic-node-copy'
let SEQ = 0
export const uid = (p) => `${p}-${Date.now().toString(36)}-${(SEQ++).toString(36)}`

// Keep only the durable board shape when persisting - drop React Flow's
// transient bookkeeping (selection/drag state) and the UI-only `editable` flag.
// Crucial: NodeResizer writes the new size to n.width/n.height (NOT n.style), so
// fold the current rendered size back into style - otherwise a resize is never
// saved and the node snaps back to its original size on reload.
export function sanitizeNodes(nodes) {
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

export function sanitizeEdges(edges) {
  return edges.map((e) => {
    const c = { ...e }
    delete c.selected
    return c
  })
}

export function withEditable(nodes, editable) {
  return nodes.map((n) => ({ ...n, data: { ...n.data, editable } }))
}

// The durable, comparable form of a board. Identical content => identical string,
// which is what autosave, drafts and undo all key on.
export const boardSnapshot = ({ title, nodes, edges }) =>
  JSON.stringify({ title: title || 'Untitled Board', nodes: sanitizeNodes(nodes || []), edges: sanitizeEdges(edges || []) })

export const nodeW = (n) => (typeof n.style?.width === 'number' ? n.style.width : (n.measured?.width || n.width || 150))
export const nodeH = (n) => (typeof n.style?.height === 'number' ? n.style.height : (n.measured?.height || n.height || 90))

// Default size + data for each FAB object type. Numbered/named types (marker,
// profile, container, sticker) pick their next value from what's already on the board.
export function newNodeSpec(type, nds) {
  const count = (t) => nds.filter((n) => n.type === t).length
  switch (type) {
    case 'text': return { style: { width: 180, height: 90 }, data: { text: '', editable: true } }
    case 'clip': return { style: { width: 210 }, data: { text: '', color: '#fbfaf6', editable: true } } // no height - auto-fits
    case 'callout': return { style: { width: 240, height: 120 }, data: { text: 'Important!!!', color: '#fff3bf', editable: true } }
    case 'stamp': return { style: { width: 220, height: 60 }, data: { label: 'APPROVED', color: '#d0342c', editable: true } }
    case 'redaction': return { style: { width: 170, height: 26 }, data: { color: '#111111', editable: true } }
    case 'marker': return { style: { width: 52, height: 52 }, data: { number: count('marker') + 1, color: '#8b1e3f', editable: true } }
    case 'wax': return { style: { width: 84, height: 84 }, data: { symbol: '★', color: '#8b1e3f', editable: true } }
    case 'crosshair': return { style: { width: 90, height: 90 }, data: { color: '#e5231b', editable: true } }
    case 'spotlight': return { style: { width: 220, height: 220 }, data: { dim: 0.72, editable: true }, zIndex: 50 }
    case 'annotation': return { style: { width: 190, height: 130 }, data: { color: '#e5231b', editable: true } }
    case 'drawing': return { style: { width: 220, height: 160 }, data: { paths: [], editable: true } }
    case 'sticker': return { style: { width: 76, height: 76 }, data: { emoji: STICKER_EMOJIS[nds.length % STICKER_EMOJIS.length], editable: true } }
    case 'profile': {
      const i = count('profile')
      return { style: { width: 96, height: 96 }, data: { name: PROFILE_NAMES[i % PROFILE_NAMES.length], color: PROFILE_COLORS[i % PROFILE_COLORS.length], editable: true } }
    }
    case 'container': return { style: { width: 320, height: 240 }, data: { title: 'Section', color: CONTAINER_TINTS[count('container') % CONTAINER_TINTS.length], editable: true } }
    default: return null
  }
}

// Drop one of the FAB object types at `at`. Containers slide to the BACK of the
// stack (they group visually and must sit under the evidence); everything else
// lands on top where you added it.
export function addNode(nds, type, at, extra) {
  const spec = newNodeSpec(type, nds)
  if (!spec) return nds
  // Cascade each new object so they never land in one stack (which buries them).
  const off = (nds.length % 8) * 28
  const node = { id: uid(type), type, position: { x: at.x + off, y: at.y + off }, ...spec }
  if (extra) node.data = { ...node.data, ...extra }
  if (type === 'container') { node.position = { x: at.x - 160, y: at.y - 120 }; node.zIndex = 0; return [node, ...nds] }
  return nds.concat(node)
}

export const duplicateNode = (src) => ({
  ...src, id: uid(src.type), selected: false,
  position: { x: src.position.x + 30, y: src.position.y + 30 }, data: { ...src.data },
})

// Send a node to the very front or back by bumping its zIndex past all others.
export function arrangeZ(nds, nodeId, dir) {
  const zs = nds.map((n) => n.zIndex ?? 0)
  const z = dir === 'front' ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1
  return nds.map((n) => (n.id === nodeId ? { ...n, zIndex: z } : n))
}

// Group the selected top-level nodes: wrap them in a container and reparent them
// to it (positions become relative) so the whole set moves as one.
export function groupNodes(nds) {
  const sel = nds.filter((n) => n.selected && n.type !== 'container' && !n.parentId)
  if (sel.length < 2) return nds
  const pad = 26
  const minX = Math.min(...sel.map((n) => n.position.x)) - pad
  const minY = Math.min(...sel.map((n) => n.position.y)) - pad
  const maxX = Math.max(...sel.map((n) => n.position.x + nodeW(n))) + pad
  const maxY = Math.max(...sel.map((n) => n.position.y + nodeH(n))) + pad
  const gid = uid('container')
  const group = {
    id: gid, type: 'container', position: { x: minX, y: minY }, zIndex: 0, selected: true,
    style: { width: maxX - minX, height: maxY - minY },
    data: { title: 'Group', color: CONTAINER_TINTS[0], editable: true },
  }
  const ids = new Set(sel.map((n) => n.id))
  const rest = nds.map((n) => (ids.has(n.id)
    ? { ...n, parentId: gid, position: { x: n.position.x - minX, y: n.position.y - minY }, selected: false }
    : n))
  return [group, ...rest]
}

// Ungroup selected container(s): free their children back to absolute positions.
export function ungroupNodes(nds) {
  const groups = nds.filter((n) => n.selected && n.type === 'container')
  if (!groups.length) return nds
  const gids = new Set(groups.map((g) => g.id))
  const gpos = Object.fromEntries(groups.map((g) => [g.id, g.position]))
  return nds
    .filter((n) => !gids.has(n.id))
    .map((n) => (n.parentId && gids.has(n.parentId)
      ? { ...n, parentId: undefined, position: { x: n.position.x + gpos[n.parentId].x, y: n.position.y + gpos[n.parentId].y }, selected: false }
      : n))
}

// Auto-thread pairs for the selected assets. 'chain' weaves a clean nearest-neighbour
// path through them (great for a row/column); 'fan' wires the biggest asset (the hub)
// out to all the others (great for a doc + its supporting evidence).
export function threadPairs(sel, mode) {
  if (sel.length < 2) return []
  const ctr = (n) => ({ x: n.position.x + nodeW(n) / 2, y: n.position.y + nodeH(n) / 2 })
  if (mode === 'fan') {
    const hub = sel.reduce((a, b) => (nodeW(a) * nodeH(a) >= nodeW(b) * nodeH(b) ? a : b))
    return sel.filter((n) => n.id !== hub.id).map((n) => [hub.id, n.id])
  }
  const pairs = []
  const rem = [...sel]
  let cur = rem.reduce((a, b) => (ctr(a).y < ctr(b).y ? a : b)) // start at the topmost
  rem.splice(rem.indexOf(cur), 1)
  while (rem.length) {
    const c = ctr(cur)
    let bi = 0, bd = Infinity
    rem.forEach((n, i) => { const d = (ctr(n).x - c.x) ** 2 + (ctr(n).y - c.y) ** 2; if (d < bd) { bd = d; bi = i } })
    const nxt = rem.splice(bi, 1)[0]
    pairs.push([cur.id, nxt.id]); cur = nxt
  }
  return pairs
}

// Add the given [source, target] pairs as edges, skipping any already wired (either direction).
export function addThreads(eds, pairs) {
  const add = pairs
    .filter(([s, t]) => !eds.some((e) => (e.source === s && e.target === t) || (e.source === t && e.target === s)))
    .map(([s, t]) => ({ id: uid('e'), source: s, target: t }))
  return add.length ? eds.concat(add) : eds
}

// SHIFT-drag snap: align a node's center on X or Y with the node(s) it's wired
// to, so the thread runs perfectly horizontal or vertical. Returns the snapped
// position, or null when nothing is within range.
export function snapToConnected(node, nodes, edges, SNAP = 34) {
  const conn = new Set()
  edges.forEach((ed) => { if (ed.source === node.id) conn.add(ed.target); if (ed.target === node.id) conn.add(ed.source) })
  if (!conn.size) return null
  const dim = (n) => ({ w: n.measured?.width ?? n.width ?? n.style?.width ?? 200, h: n.measured?.height ?? n.height ?? n.style?.height ?? 140 })
  const d = dim(node)
  const cx = node.position.x + d.w / 2
  const cy = node.position.y + d.h / 2
  let nx = node.position.x, ny = node.position.y, bestX = SNAP, bestY = SNAP
  for (const n of nodes) {
    if (!conn.has(n.id)) continue
    const nd = dim(n)
    const dx = Math.abs(cx - (n.position.x + nd.w / 2))
    const dy = Math.abs(cy - (n.position.y + nd.h / 2))
    if (dx < bestX) { bestX = dx; nx = n.position.x + nd.w / 2 - d.w / 2 }
    if (dy < bestY) { bestY = dy; ny = n.position.y + nd.h / 2 - d.h / 2 }
  }
  return nx !== node.position.x || ny !== node.position.y ? { x: nx, y: ny } : null
}

// Apply per-node lock (not draggable) and send-to-back (renders behind others).
// Locked stays selectable so you can still open it and unlock.
export function styleNodes(nodes) {
  return nodes.map((n) => {
    const locked = n.data?.locked === true
    const back = n.data?.back === true
    if (!locked && !back) return n
    return { ...n, draggable: locked ? false : undefined, zIndex: back ? -1 : n.zIndex }
  })
}

// Theme edges live. Straight routing. When a node is selected, its connections
// LIGHT UP (thicker + glowing) - but every OTHER thread stays fully solid (never
// dimmed), so the board always reads clearly.
export function styleEdges(edges, sel, accent) {
  const selNodeId = sel && sel.kind !== 'edge' ? sel.id : null
  return edges.map((e) => {
    const stroke = e.data?.color || accent
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
}
