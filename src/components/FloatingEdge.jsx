import { getStraightPath, useInternalNode } from '@xyflow/react'

// A "floating" edge: instead of a fixed handle, it connects at the point on each
// node's boundary that faces the other node - so a thread always attaches at the
// nearest edge automatically, wherever the nodes sit.
function center(node) {
  const w = node.measured?.width ?? 0
  const h = node.measured?.height ?? 0
  return { x: node.internals.positionAbsolute.x + w / 2, y: node.internals.positionAbsolute.y + h / 2, w, h }
}

// The MIDDLE of whichever side of `node` faces `toward` - so a thread (and its
// pin) attaches at the centre of the top/right/bottom/left edge, never a corner.
function boundaryPoint(node, toward) {
  const { x: cx, y: cy, w, h } = center(node)
  const dx = toward.x - cx
  const dy = toward.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const exitsVertically = (h / 2) / Math.abs(dy || 1e-6) < (w / 2) / Math.abs(dx || 1e-6)
  return exitsVertically
    ? { x: cx, y: cy + (dy > 0 ? h / 2 : -h / 2) }   // bottom-middle / top-middle
    : { x: cx + (dx > 0 ? w / 2 : -w / 2), y: cy }    // right-middle / left-middle
}

// A glossy red pushpin head, drawn in SVG at the point where a thread meets a card.
function PinHead({ x, y }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <ellipse cx={x} cy={y + 6} rx={6} ry={2.5} fill="rgba(0,0,0,0.3)" />
      <circle cx={x} cy={y} r={7.5} fill="#e5231b" stroke="#7c0f08" strokeWidth={0.8} />
      <circle cx={x - 2.4} cy={y - 2.7} r={2.3} fill="rgba(255,255,255,0.78)" />
    </g>
  )
}

export function FloatingEdge({ id, source, target, style }) {
  const s = useInternalNode(source)
  const t = useInternalNode(target)
  if (!s || !t) return null
  const sc = center(s)
  const tc = center(t)
  const sp = boundaryPoint(s, tc)
  const tp = boundaryPoint(t, sc)
  const [path] = getStraightPath({ sourceX: sp.x, sourceY: sp.y, targetX: tp.x, targetY: tp.y })
  return (
    <>
      {/* Fat invisible hit area so the thin thread is easy to click/select. */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={22} className="react-flow__edge-interaction" />
      <path id={id} className="react-flow__edge-path" d={path} style={style} />
      <PinHead x={sp.x} y={sp.y} />
      <PinHead x={tp.x} y={tp.y} />
    </>
  )
}
