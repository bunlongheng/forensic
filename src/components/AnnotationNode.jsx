import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// A hand-drawn red marker ring for circling something on the board - a rough,
// overshooting scribble loop (not a clean ellipse). Stretches to the node box, so
// you resize it around whatever you want to call out. Center stays see-through.
const RING = 'M32,74 C26,38 66,20 108,20 C158,20 186,44 184,80 C182,112 146,128 98,126 C52,124 22,108 24,74 C25,54 42,38 74,32'

function AnnotationNode({ data, selected }) {
  const color = data.color || '#e5231b'
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected} minWidth={60} minHeight={44} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <svg viewBox="0 0 208 148" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}>
        <path
          d={RING} fill="none" stroke={color} strokeWidth={selected ? 5 : 4.2} strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: selected ? 'drop-shadow(0 0 3px var(--accent))' : 'drop-shadow(0 1px 1px rgba(0,0,0,.25))' }}
        />
      </svg>
    </div>
  )
}

export default memo(AnnotationNode)
