import { memo, useState, useRef } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// Freehand black sharpie. Drag inside to draw strokes; grab the thin edge frame to
// move the whole thing. Strokes are stored as percentage points so they scale with
// the node. A non-scaling stroke keeps the ink a constant marker weight.
function DrawingNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const paths = data.paths || []
  const [stroke, setStroke] = useState(null)
  const surf = useRef(null)

  const toPct = (e) => {
    const r = surf.current.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100]
  }
  const down = (e) => { if (!editable) return; e.stopPropagation(); surf.current.setPointerCapture?.(e.pointerId); setStroke([toPct(e)]) }
  const move = (e) => { if (stroke) setStroke((s) => [...s, toPct(e)]) }
  const up = () => { if (stroke && stroke.length > 1) updateNodeData(id, { paths: [...paths, stroke] }); setStroke(null) }
  const d = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', padding: 10 }}>
      <NodeResizer isVisible={selected && editable} minWidth={90} minHeight={70} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      {/* drag this padded frame to move; draw on the inner surface */}
      <div
        ref={surf} className="nodrag nowheel"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        style={{ width: '100%', height: '100%', cursor: editable ? 'crosshair' : 'default', borderRadius: 6 }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', display: 'block' }}>
          {[...paths, stroke].filter(Boolean).map((pts, i) => (
            <path key={i} d={d(pts)} fill="none" stroke="#141414" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
    </div>
  )
}

export default memo(DrawingNode)
