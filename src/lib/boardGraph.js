// Pure board-graph helpers shared by the Board view and its hooks. No React and
// no DOM: every function takes plain nodes/edges and returns new values, so the
// canvas logic is unit-testable without a canvas.
import { CONTAINER_TINTS } from './constants.js'
import { nodeSpec } from './nodeRegistry.js'

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
// Postgres jsonb stores object keys in ITS own order (length, then bytes), so a
// board read back from the server stringifies differently from the identical
// board held on the client. That made the draft-vs-server comparison in
// useBoardPersistence fire on content that had not changed. Canonicalise the key
// order and the two agree.
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k])
    return out
  }
  return v
}

export function sanitizeNode(n) {
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
  const out = { id: n.id, type: n.type, position: sortDeep(n.position), style: sortDeep(style), data: sortDeep(data) }
  // Durable React Flow fields beyond the basics: a grouped child's parent (its
  // position is relative to it), explicit stacking, and any extent/expandParent.
  for (const k of ['parentId', 'zIndex', 'extent', 'expandParent']) if (n[k] != null) out[k] = n[k]
  return out
}

export const sanitizeNodes = (nodes) => nodes.map(sanitizeNode)

export function sanitizeEdge(e) {
  const c = { ...e }
  delete c.selected
  return sortDeep(c)
}

export const sanitizeEdges = (edges) => edges.map(sanitizeEdge)

export function withEditable(nodes, editable) {
  return nodes.map((n) => ({ ...n, data: { ...n.data, editable } }))
}

// Per-item snapshot cache, keyed on the node/edge OBJECT. Boards carry base64
// image data, so re-stringifying the whole board on every touch (a click, a hover,
// a measure) burned megabytes of JSON per interaction - that was the single biggest
// source of the lag. React Flow replaces only the objects it actually changed, so
// re-stringify only those and reuse the rest. WeakMap keys, so nothing is retained.
// The width/height guard covers the case where a resize lands on the same object.
const NODE_JSON = new WeakMap()
const EDGE_JSON = new WeakMap()

function nodeJson(n) {
  const w = n.width ?? n.measured?.width
  const h = n.height ?? n.measured?.height
  const hit = NODE_JSON.get(n)
  if (hit && hit.w === w && hit.h === h) return hit.json
  const json = JSON.stringify(sanitizeNode(n))
  NODE_JSON.set(n, { json, w, h })
  return json
}

function edgeJson(e) {
  let json = EDGE_JSON.get(e)
  if (json === undefined) { json = JSON.stringify(sanitizeEdge(e)); EDGE_JSON.set(e, json) }
  return json
}

// One-entry memo of the assembled string. The per-item cache above kills the
// stringify walk, but joining a few MB of parts back together is itself expensive,
// and a mere selection change hands us a brand-new nodes ARRAY of unchanged parts.
// Comparing the parts by reference is O(n) pointer checks, so an interaction that
// changed nothing durable now costs nothing at all.
let LAST = { title: null, nodes: [], edges: [], out: '' }
const samePairs = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

// The durable, comparable form of a board. Identical content => identical string,
// which is what autosave, drafts and undo all key on. Byte-for-byte the same output
// as JSON.stringify over the sanitized board - just assembled from cached parts.
export function boardSnapshot({ title, nodes, edges }) {
  const t = title || 'Untitled Board'
  const np = (nodes || []).map(nodeJson)
  const ep = (edges || []).map(edgeJson)
  if (t === LAST.title && samePairs(np, LAST.nodes) && samePairs(ep, LAST.edges)) return LAST.out
  const out = `{"title":${JSON.stringify(t)},"nodes":[${np.join(',')}],"edges":[${ep.join(',')}]}`
  LAST = { title: t, nodes: np, edges: ep, out }
  return out
}

export const nodeW = (n) => (typeof n.style?.width === 'number' ? n.style.width : (n.measured?.width || n.width || 150))
export const nodeH = (n) => (typeof n.style?.height === 'number' ? n.style.height : (n.measured?.height || n.height || 90))

// Default size + data for each object type - looked up in the node registry, the
// single source of truth for what a new object of a given type is. Named types
// (profile, container, sticker) pick their next value from what's already on the
// board, so the current nodes go in. Re-exported under the board layer's older
// name rather than wrapped, so there is no second function to keep in step.
export { nodeSpec as newNodeSpec }

// Drop one of the FAB object types at `at`. Containers slide to the BACK of the
// stack (they group visually and must sit under the evidence); everything else
// lands on top where you added it.
export function addNode(nds, type, at, extra, exact = false) {
  const spec = nodeSpec(type, nds)
  if (!spec) return nds
  // Cascade each new object so they never land in one stack (which buries them).
  // `exact` turns that off: when the owner picked the spot (the CMD cursor ring)
  // the node belongs on it, not 100px down-right of it.
  const off = exact ? 0 : (nds.length % 8) * 28
  const node = { id: uid(type), type, position: { x: at.x + off, y: at.y + off }, ...spec }
  if (extra) node.data = { ...node.data, ...extra }
  if (type === 'container') { node.position = { x: at.x - 160, y: at.y - 120 }; node.zIndex = 0; return [node, ...nds] }
  return nds.concat(node)
}

export const duplicateNode = (src) => ({
  ...src, id: uid(src.type), selected: false,
  position: { x: src.position.x + 30, y: src.position.y + 30 }, data: { ...src.data },
})

// Which nodes travel when `ids` are copied or cut: the picked ones PLUS every
// descendant, because a group whose children stayed behind is not a group.
export function withDescendants(nds, ids) {
  const take = new Set(ids)
  let grew = true
  while (grew) {
    grew = false
    for (const n of nds) {
      if (!take.has(n.id) && n.parentId && take.has(n.parentId)) { take.add(n.id); grew = true }
    }
  }
  return nds.filter((n) => take.has(n.id))
}

// Clone a selection onto a board - the same board or a different one. Every id is
// remapped, and parent links and edges are rewritten to the NEW ids so a pasted
// group still moves as one and stays wired exactly as it was cut.
//
// `at` is where the selection's top-left corner lands (the cursor, normally), so
// the set keeps its internal layout instead of scattering. Children are positioned
// relative to their parent, so only the top-level nodes are shifted.
export function cloneSubgraph(nodes, edges = [], at = null) {
  if (!nodes.length) return { nodes: [], edges: [] }
  const idMap = new Map(nodes.map((n) => [n.id, uid(n.type)]))
  const tops = nodes.filter((n) => !n.parentId || !idMap.has(n.parentId))
  const minX = Math.min(...tops.map((n) => n.position.x))
  const minY = Math.min(...tops.map((n) => n.position.y))
  const dx = at ? at.x - minX : 30
  const dy = at ? at.y - minY : 30

  const cloned = nodes.map((n) => {
    const parentCopied = n.parentId && idMap.has(n.parentId)
    return {
      ...n,
      id: idMap.get(n.id),
      selected: false,
      // A child's position is relative to its parent, so it must NOT be shifted -
      // only the top-level nodes move to the paste point.
      position: parentCopied ? { ...n.position } : { x: n.position.x + dx, y: n.position.y + dy },
      ...(parentCopied ? { parentId: idMap.get(n.parentId) } : {}),
      // A node whose parent did NOT come along is no longer a child of anything.
      ...(n.parentId && !parentCopied ? { parentId: undefined, extent: undefined, expandParent: undefined } : {}),
      data: { ...n.data },
    }
  })
  // Only edges with BOTH ends in the selection survive - a thread to a node that
  // stayed behind has nothing to point at on the new board.
  const clonedEdges = edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({
      ...e,
      id: uid('edge'),
      source: idMap.get(e.source),
      target: idMap.get(e.target),
      selected: false,
    }))
  return { nodes: cloned, edges: clonedEdges }
}

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
  // Rounded on purpose. Positions are fractional at any zoom other than 100%, and
  // React Flow re-measures the rendered container with an INTEGER offsetWidth - so
  // a fractional box came back a different size on the next frame, which recorded
  // a phantom undo entry (eating the redo tail) and triggered a save on mere open.
  const minX = Math.round(Math.min(...sel.map((n) => n.position.x)) - pad)
  const minY = Math.round(Math.min(...sel.map((n) => n.position.y)) - pad)
  const maxX = Math.round(Math.max(...sel.map((n) => n.position.x + nodeW(n))) + pad)
  const maxY = Math.round(Math.max(...sel.map((n) => n.position.y + nodeH(n))) + pad)
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
// A selected CHILD counts as selecting its group - clicking a photo inside a group
// selects the photo, not the container, so without this Cmd+G would look dead.
export function ungroupNodes(nds) {
  const byId = new Map(nds.map((n) => [n.id, n]))
  const groups = nds.filter((n) => n.selected && n.type === 'container')
  for (const n of nds) {
    if (!n.selected || !n.parentId) continue
    const p = byId.get(n.parentId)
    if (p?.type === 'container' && !groups.includes(p)) groups.push(p)
  }
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

// The size React Flow is actually rendering a node at, with a sane fallback for
// a node that has not been measured yet.
export const nodeSize = (n) => ({
  w: n.measured?.width ?? n.width ?? n.style?.width ?? 200,
  h: n.measured?.height ?? n.height ?? n.style?.height ?? 140,
})

// SHIFT-drag snap: align a node's center on X or Y with the node(s) it's wired
// to, so the thread runs perfectly horizontal or vertical. Returns the snapped
// position, or null when nothing is within range.
export function snapToConnected(node, nodes, edges, SNAP = 34) {
  const conn = new Set()
  edges.forEach((ed) => { if (ed.source === node.id) conn.add(ed.target); if (ed.target === node.id) conn.add(ed.source) })
  if (!conn.size) return null
  const d = nodeSize(node)
  const cx = node.position.x + d.w / 2
  const cy = node.position.y + d.h / 2
  let nx = node.position.x, ny = node.position.y, bestX = SNAP, bestY = SNAP
  for (const n of nodes) {
    if (!conn.has(n.id)) continue
    const nd = nodeSize(n)
    const dx = Math.abs(cx - (n.position.x + nd.w / 2))
    const dy = Math.abs(cy - (n.position.y + nd.h / 2))
    if (dx < bestX) { bestX = dx; nx = n.position.x + nd.w / 2 - d.w / 2 }
    if (dy < bestY) { bestY = dy; ny = n.position.y + nd.h / 2 - d.h / 2 }
  }
  return nx !== node.position.x || ny !== node.position.y ? { x: nx, y: ny } : null
}

// Drag-time line-up target: the nearest OTHER photo, reported as the height to
// match and the top edge to sit on - so a row of evidence prints lines up at one
// height instead of a ragged staircase. Width follows the dragged photo's OWN
// aspect ratio so nothing is squashed. `same: true` means the heights already
// agree and only the top edge needs aligning. Returns null when nothing is close.
// Grouped children are skipped: their position is relative to the parent, so the
// distance maths (and the on-screen ghost) would not line up.
export function matchHeightHint(node, nodes, RADIUS = 900, TOL = 3) {
  if (node.type !== 'image' || node.parentId) return null
  const d = nodeSize(node)
  if (!d.h) return null
  const cx = node.position.x + d.w / 2
  const cy = node.position.y + d.h / 2
  let best = null, bestDist = RADIUS
  for (const n of nodes) {
    if (n.id === node.id || n.type !== 'image' || n.parentId) continue
    const s = nodeSize(n)
    const dist = Math.hypot(cx - (n.position.x + s.w / 2), cy - (n.position.y + s.h / 2))
    if (dist < bestDist) { bestDist = dist; best = { ...s, y: n.position.y } }
  }
  if (!best) return null
  // `y` is the neighbour's TOP edge, so the caller can line the two up on it.
  const out = { y: best.y, h: Math.round(best.h), w: Math.round(d.w * (best.h / d.h)) }
  return Math.abs(best.h - d.h) <= TOL ? { ...out, w: Math.round(d.w), h: Math.round(d.h), same: true } : out
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
