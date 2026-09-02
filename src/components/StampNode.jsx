import { memo, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// A rubber-stamp imprint pressed onto the evidence. Two shapes: a slanted rectangle
// (default) and a round official seal - top label, "OFFICIAL" flourish + stars round
// the bottom, side stars and a center star. Faded + multiply so it reads as ink.
const MONO = "'Space Mono', ui-monospace, monospace"
const COURIER = "'Courier New', Courier, monospace" // typewriter ink = real-stamp feel

// The center emblem, drawn monochrome in the ink color and matched to the label.
function Emblem({ label, color }) {
  switch (label) {
    case 'APPROVED': // thumbs up
      return (<><path d="M45 60 h3.2 v-7 h-3.2z" fill={color} /><path d="M48.2 53 c2 -.6 3.4 -2.6 4.2 -5 c.5 -1.4 2.4 -1 2.2 .6 l-.5 3 h3.8 c1.2 0 1.9 1 1.6 2.1 l-1.4 4.4 c-.3 1 -1 1.4 -2 1.4 h-7.9z" fill={color} /></>)
    case 'CONFIDENTIAL': // padlock
      return (<><rect x="44.5" y="53" width="11" height="8" rx="1.3" fill={color} /><path d="M46.5 53 v-1.8 a3.5 3.5 0 0 1 7 0 v1.8" fill="none" stroke={color} strokeWidth="1.7" /></>)
    case 'SECRET': // eye with a slash
      return (<><path d="M43 55 c3 -4.2 11 -4.2 14 0 c-3 4.2 -11 4.2 -14 0z" fill="none" stroke={color} strokeWidth="1.6" /><circle cx="50" cy="55" r="2.1" fill={color} /><line x1="43" y1="50" x2="57" y2="60" stroke={color} strokeWidth="1.9" /></>)
    case 'CLASSIFIED': // shield
      return (<path d="M50 47 l7 2.2 v4.6 c0 4.6 -3.6 7.5 -7 8.4 c-3.4 -.9 -7 -3.8 -7 -8.4 v-4.6z" fill={color} />)
    case 'PROJECT+': // plus
      return (<path d="M50 47.5 v13 M43.5 54 h13" stroke={color} strokeWidth="3" strokeLinecap="round" />)
    case 'PROGRESS': // circular arrow
      return (<><path d="M56.8 54 a6.8 6.8 0 1 1 -2 -4.8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" /><path d="M53.3 47 l3.4 2.3 l-3.8 1.7z" fill={color} /></>)
    case 'BLOCKED': // prohibition
      return (<><circle cx="50" cy="54" r="6.8" fill="none" stroke={color} strokeWidth="2.3" /><line x1="45.2" y1="49.2" x2="54.8" y2="58.8" stroke={color} strokeWidth="2.3" /></>)
    default:
      return (<text x="50" y="60" textAnchor="middle" fill={color} fontSize="30">★</text>)
  }
}

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
            <text fill={color} fontFamily={COURIER} fontWeight="700" fontSize="10" letterSpacing="1.2">
              <textPath href={`#${arc}-t`} startOffset="50%" textAnchor="middle">{label}</textPath>
            </text>
            <text fill={color} fontFamily={COURIER} fontWeight="700" fontSize="7.5" letterSpacing="2">
              <textPath href={`#${arc}-b`} startOffset="50%" textAnchor="middle">★ OFFICIAL ★</textPath>
            </text>
            <text x="9.5" y="53.5" textAnchor="middle" fill={color} fontSize="9">★</text>
            <text x="90.5" y="53.5" textAnchor="middle" fill={color} fontSize="9">★</text>
            <Emblem label={label} color={color} />
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
