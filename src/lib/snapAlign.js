// CMD/Ctrl + drag snap-align. Hold the modifier while dragging and the node
// latches onto the closest edge or center line of another node, so photos and
// notes line up in real rows and columns instead of near-misses. The canvas
// paints a guide on exactly the line returned here, so you can see where it is
// about to land before you let go.
import { nodeSize } from './boardGraph.js'

export const SNAP_THRESHOLD = 10 // board units - how close before it latches

const rectOf = (n) => ({ x: n.position.x, y: n.position.y, ...nodeSize(n) })

// The 3 lines a node can align on per axis: leading edge, center, trailing edge.
const linesX = (r) => [r.x, r.x + r.w / 2, r.x + r.w]
const linesY = (r) => [r.y, r.y + r.h / 2, r.y + r.h]

// dragged: the node at its un-snapped drag position. others: every other node.
// Returns the corrected position plus the guides to draw (0, 1 or 2 of them).
export function snapAlign(dragged, others, threshold = SNAP_THRESHOLD) {
  const d = rectOf(dragged)
  const best = { x: null, y: null }

  for (const other of others) {
    // Grouped children live in parent-relative coordinates, so they never share
    // a coordinate space with a top-level node - aligning to one would be wrong.
    if (other.id === dragged.id || !other.position || other.parentId) continue
    const r = rectOf(other)
    for (const [axis, mine, theirs] of [['x', linesX(d), linesX(r)], ['y', linesY(d), linesY(r)]]) {
      for (const a of mine) {
        for (const b of theirs) {
          const delta = b - a
          if (Math.abs(delta) > threshold) continue
          if (!best[axis] || Math.abs(delta) < Math.abs(best[axis].delta)) best[axis] = { delta, at: b, other: r }
        }
      }
    }
  }

  const position = { x: d.x + (best.x?.delta ?? 0), y: d.y + (best.y?.delta ?? 0) }

  // A guide spans from the far edge of one node to the far edge of the other, so
  // the line visibly connects the two things being aligned.
  const snapped = { ...d, ...position }
  const guides = []
  if (best.x) {
    const o = best.x.other
    guides.push({ axis: 'x', at: best.x.at, from: Math.min(snapped.y, o.y), to: Math.max(snapped.y + snapped.h, o.y + o.h) })
  }
  if (best.y) {
    const o = best.y.other
    guides.push({ axis: 'y', at: best.y.at, from: Math.min(snapped.x, o.x), to: Math.max(snapped.x + snapped.w, o.x + o.w) })
  }
  return { position, guides }
}
