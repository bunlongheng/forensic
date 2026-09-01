import { memo, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// A rubber-stamp imprint pressed onto the evidence. Two shapes: a slanted rectangle
// (default) and a round official seal - top label, "OFFICIAL" flourish + stars round
// the bottom, side stars and a center star. Faded + multiply so it reads as ink.
const MONO = "'Space Mono', ui-monospace, monospace"
const SERIF = "Georgia, 'Times New Roman', serif"

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
      <NodeResizer isVisible={selected} keepAspectRatio minWidth={circle ? 80 : 110} minHeight={circle ? 80 : 40} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div style={{ width: '100%', height: '100%', containerType: 'size', display: 'grid', placeItems: 'center' }}>
        {circle ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%', transform: 'rotate(-6deg)', opacity: 0.86, mixBlendMode: 'multiply', overflow: 'visible' }}>
            <defs>
              <path id={`${arc}-t`} d="M 15 50 A 35 35 0 0 1 85 50" fill="none" />
              <path id={`${arc}-b`} d="M 17 56 A 33 33 0 0 0 83 56" fill="none" />
            </defs>
            <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="2.1" />
            <circle cx="50" cy="50" r="38.5" fill="none" stroke={color} strokeWidth="1" />
            <text fill={color} fontFamily={SERIF} fontWeight="700" fontSize="10.5" letterSpacing="1.4">
              <textPath href={`#${arc}-t`} startOffset="50%" textAnchor="middle">{label}</textPath>
            </text>
            <text fill={color} fontFamily={SERIF} fontWeight="700" fontSize="8" letterSpacing="2">
              <textPath href={`#${arc}-b`} startOffset="50%" textAnchor="middle">★ OFFICIAL ★</textPath>
            </text>
            <text x="9.5" y="53.5" textAnchor="middle" fill={color} fontSize="9">★</text>
            <text x="90.5" y="53.5" textAnchor="middle" fill={color} fontSize="9">★</text>
            <text x="50" y="60" textAnchor="middle" fill={color} fontSize="30">★</text>
          </svg>
        ) : (
          <div style={{
            transform: 'rotate(-7deg)', border: '0.14em solid', borderColor: color, color, borderRadius: '0.32em',
            padding: '0.22em 0.66em', boxShadow: `inset 0 0 0 0.1em ${color}`,
            fontFamily: MONO, fontWeight: 700, fontSize: '34cqmin', letterSpacing: '.06em',
            textTransform: 'uppercase', opacity: 0.82, whiteSpace: 'nowrap', mixBlendMode: 'multiply', userSelect: 'none',
          }}>{label}</div>
        )}
      </div>
    </div>
  )
}

export default memo(StampNode)
