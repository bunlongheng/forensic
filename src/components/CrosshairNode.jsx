import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// A targeting reticle you drop on a suspect / detail - two rings, a gapped cross and
// a center dot. Color is red / white / black / amber. A soft shadow keeps the white
// one visible on light paper.
function CrosshairNode({ data, selected }) {
  const color = data.color || '#e5231b'
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected} keepAspectRatio minWidth={40} minHeight={40} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', overflow: 'visible', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))' }}>
        <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <circle cx="50" cy="50" r="38" />
          <circle cx="50" cy="50" r="26" strokeWidth="1.2" opacity="0.6" />
          <path d="M50 4 V32 M50 68 V96 M4 50 H32 M68 50 H96" />
        </g>
        <circle cx="50" cy="50" r="2.6" fill={color} />
      </svg>
    </div>
  )
}

export default memo(CrosshairNode)
