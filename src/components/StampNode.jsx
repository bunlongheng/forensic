import { memo } from 'react'
import { NodeHandles } from './nodeHandles.jsx'

// A rubber-stamp imprint: bold uppercase text inside a matching double border,
// tilted and faded like real ink pressed onto the evidence. The label is one of
// APPROVED / CONFIDENTIAL / SECRET / HIDDEN; ink color is set in the inspector.
// multiply blend makes it read as ink sitting ON whatever is behind it.
function StampNode({ data }) {
  const color = data.color || '#d0342c'
  const label = data.label || 'APPROVED'
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      <NodeHandles />
      <div style={{
        transform: 'rotate(-7deg)', border: `3px solid ${color}`, color, borderRadius: 7,
        padding: '5px 15px', boxShadow: `inset 0 0 0 2px ${color}`,
        fontFamily: "'Space Mono', ui-monospace, monospace", fontWeight: 700,
        fontSize: 24, letterSpacing: '.06em', textTransform: 'uppercase',
        opacity: 0.82, whiteSpace: 'nowrap', mixBlendMode: 'multiply', userSelect: 'none',
      }}>{label}</div>
    </div>
  )
}

export default memo(StampNode)
