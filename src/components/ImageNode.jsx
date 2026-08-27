import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { Pin } from './Pin.jsx'
import { tornBottom } from '../lib/torn.js'
import { useEditZoom } from '../lib/useEditZoom.js'

// An "evidence" node styled as a pinned photo print: a white polaroid frame with
// the image, an OPTIONAL caption strip (off by default), a red pushpin, and
// optional grayscale + torn ("rip") effects. Caption shows exactly what you type.

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
  const gray = data.grayscale === true
  const rip = data.rip === true
  const ripClip = rip ? tornBottom(id) : 'none'
  const wrinkle = data.wrinkle === true
  const imgFilter = [gray && 'grayscale(1)', wrinkle && 'url(#fx-wrinkle)'].filter(Boolean).join(' ') || 'none'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} keepAspectRatio minWidth={90} minHeight={80} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      {data.pin === true && <Pin size={27} color={data.pinColor || '#ff3b30'} />}
      <div style={{
        width: '100%', height: '100%',
        background: '#fbfaf6', borderRadius: rip ? 0 : 3, padding: showCap ? '9px 9px 0' : 9,
        clipPath: ripClip, WebkitClipPath: ripClip,
        display: 'flex', flexDirection: 'column',
        border: `1px solid ${selected ? 'var(--accent)' : 'rgba(0,0,0,0.14)'}`,
        boxShadow: selected ? '0 14px 30px rgba(0,0,0,.42)' : '0 9px 22px rgba(0,0,0,.34)',
        filter: selected ? 'drop-shadow(0 0 2px var(--accent))' : 'none',
      }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
          <img
            src={data.src} alt={data.label || 'evidence'} draggable={false}
            style={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'contain', display: 'block', borderRadius: 1, filter: imgFilter }}
          />
          {wrinkle && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'soft-light', opacity: 0.9, borderRadius: 1,
              // Organic crumpled-paper shading (baked SVG crease-light), not a grid.
              backgroundImage: 'url("/wrinkle.svg")', backgroundSize: 'cover',
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
