import { memo, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// A rubber-stamp imprint pressed onto the evidence. Two shapes: a slanted rectangle
// (default) and a round official seal with the label curved around the rim. Bold
// uppercase mono ink, faded + multiply-blended so it reads as ink on what's behind.
const MONO = "'Space Mono', ui-monospace, monospace"

function StampNode({ id, data, selected }) {
  const { setNodes } = useReactFlow()
  const color = data.color || '#d0342c'
  const label = data.label || 'APPROVED'
  const circle = data.shape === 'circle'
  const arc = `arc-${id}`

  // A circle seal wants a square box; the slanted stamp wants a wide one. Snap the
  // node to the right footprint whenever the shape changes.
  useEffect(() => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== id) return n
      const w = n.style?.width, h = n.style?.height
      if (circle && w !== h) return { ...n, style: { ...n.style, width: 150, height: 150 } }
      if (!circle && w === h) return { ...n, style: { ...n.style, width: 220, height: 60 } }
      return n
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circle])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected} keepAspectRatio={circle} minWidth={circle ? 90 : 120} minHeight={circle ? 90 : 44} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div style={{ width: '100%', height: '100%', containerType: 'size', display: 'grid', placeItems: 'center' }}>
        {circle ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%', transform: 'rotate(-7deg)', opacity: 0.85, mixBlendMode: 'multiply', overflow: 'visible' }}>
            <defs>
              {/* top arc for the curved label, bottom arc for the flourish */}
              <path id={arc} d="M 14 50 A 36 36 0 0 1 86 50" fill="none" />
            </defs>
            <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="2.6" />
            <circle cx="50" cy="50" r="39" fill="none" stroke={color} strokeWidth="1.3" />
            <text fill={color} fontFamily={MONO} fontWeight="700" fontSize="11" letterSpacing="1.2">
              <textPath href={`#${arc}`} startOffset="50%" textAnchor="middle">{label}</textPath>
            </text>
            <text x="50" y="66" textAnchor="middle" fill={color} fontFamily={MONO} fontWeight="700" fontSize="22">★</text>
          </svg>
        ) : (
          <div style={{
            transform: 'rotate(-7deg)', border: `3px solid ${color}`, color, borderRadius: 7,
            padding: '5px 15px', boxShadow: `inset 0 0 0 2px ${color}`,
            fontFamily: MONO, fontWeight: 700, fontSize: 'min(24px, 40cqh)', letterSpacing: '.06em',
            textTransform: 'uppercase', opacity: 0.82, whiteSpace: 'nowrap', mixBlendMode: 'multiply', userSelect: 'none',
          }}>{label}</div>
        )}
      </div>
    </div>
  )
}

export default memo(StampNode)
