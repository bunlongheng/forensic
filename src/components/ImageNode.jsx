import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { Pin } from './Pin.jsx'
import { tornBottom } from '../lib/torn.js'
import { useEditZoom } from '../lib/useEditZoom.js'

// An "evidence" node styled as a pinned photo print: a white frame, the image, an
// OPTIONAL caption strip, a red pushpin, an optional torn ("rip") edge, and a photo
// STYLE - original, crumpled wrinkle paper, newsprint B&W, or a jigsaw puzzle look.

// A tiling jigsaw grid (tabs bump inward so the pattern repeats without clipping).
const PZ = 52
const PUZZLE_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${PZ}' height='${PZ}'>` +
  `<g fill='none' stroke='rgba(0,0,0,0.42)' stroke-width='1.3'>` +
  `<path d='M${PZ} 0 V${PZ * 0.38} C ${PZ - 8} ${PZ * 0.38}, ${PZ - 8} ${PZ * 0.62}, ${PZ} ${PZ * 0.62} V${PZ}'/>` +
  `<path d='M0 ${PZ} H${PZ * 0.38} C ${PZ * 0.38} ${PZ - 8}, ${PZ * 0.62} ${PZ - 8}, ${PZ * 0.62} ${PZ} H${PZ}'/></g>` +
  `<g fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='1' transform='translate(0.6,1)'>` +
  `<path d='M${PZ} 0 V${PZ * 0.38} C ${PZ - 8} ${PZ * 0.38}, ${PZ - 8} ${PZ * 0.62}, ${PZ} ${PZ * 0.62} V${PZ}'/>` +
  `<path d='M0 ${PZ} H${PZ * 0.38} C ${PZ * 0.38} ${PZ - 8}, ${PZ * 0.62} ${PZ - 8}, ${PZ * 0.62} ${PZ} H${PZ}'/></g></svg>`,
)

function ImageNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.label || '')
  const inputRef = useRef(null)
  const { focus, restore } = useEditZoom(id)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  function startEdit() { setDraft(data.label || ''); setEditing(true); focus() }
  function commit() { setEditing(false); updateNodeData(id, { label: draft }); restore() }

  const showCap = data.showCaption === true   // off unless the owner enables it
  const rip = data.rip === true
  const ripClip = rip ? tornBottom(id) : 'none'
  // Photo style: original | wrinkle | newspaper | puzzle. (data.grayscale/.wrinkle
  // from older boards still map to their style so nothing breaks.)
  const style = data.style || (data.wrinkle ? 'wrinkle' : data.grayscale ? 'newspaper' : 'original')
  const imgFilter = style === 'newspaper' ? 'grayscale(1) contrast(1.45) brightness(1.08)'
    : style === 'wrinkle' ? 'url(#fx-wrinkle)'
    : 'none'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} keepAspectRatio minWidth={90} minHeight={80} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      {data.pin === true && <Pin size={27} color={data.pinColor || '#ff3b30'} />}
      <div style={{
        width: '100%', height: '100%',
        background: '#fbfaf6', borderRadius: rip ? 0 : 3, padding: showCap ? '8px 8px 0' : 0,
        clipPath: ripClip, WebkitClipPath: ripClip,
        display: 'flex', flexDirection: 'column',
        border: '1px solid rgba(0,0,0,0.14)',
        boxShadow: '0 9px 22px rgba(0,0,0,.34)',
      }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
          <img
            src={data.src} alt={data.label || 'evidence'} draggable={false}
            style={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'contain', display: 'block', borderRadius: 1, filter: imgFilter }}
          />
          {style === 'wrinkle' && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'soft-light', opacity: 0.9, borderRadius: 1,
              // Organic crumpled-paper shading (baked SVG crease-light), not a grid.
              backgroundImage: 'url("/wrinkle.svg")', backgroundSize: 'cover',
            }} />
          )}
          {style === 'newspaper' && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'multiply', opacity: 0.2, borderRadius: 1,
              // Halftone newsprint dots.
              backgroundImage: 'radial-gradient(rgba(0,0,0,0.75) 22%, transparent 24%)', backgroundSize: '4px 4px',
            }} />
          )}
          {style === 'puzzle' && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 1,
              backgroundImage: `url("${PUZZLE_URI}")`, backgroundSize: `${PZ}px ${PZ}px`,
            }} />
          )}
        </div>
        {showCap && (
          <div
            className="mono nodrag"
            onDoubleClick={() => editable && startEdit()}
            style={{ height: 30, flexShrink: 0, display: 'grid', placeItems: 'center', padding: '0 4px' }}
          >
            {editing ? (
              <input
                ref={inputRef} value={draft}
                onChange={(e) => setDraft(e.target.value)} onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); restore() } }}
                placeholder="Caption"
                style={{ width: '100%', textAlign: 'center', border: 'none', outline: 'none', background: 'transparent', fontSize: 11, fontWeight: 700, color: '#16130f' }}
              />
            ) : (
              <span style={{
                fontSize: 11, fontWeight: 700, color: data.label ? '#16130f' : '#a9a196',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              }}>
                {data.label || (editable ? 'add caption' : '')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(ImageNode)
