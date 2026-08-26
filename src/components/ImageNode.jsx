import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow, useNodeConnections } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { Pin } from './Pin.jsx'

// An "evidence" node styled as a pinned photo print: a white polaroid frame with
// the image, an OPTIONAL caption strip (off by default), a red pushpin, and
// optional grayscale + torn ("rip") effects. Caption shows exactly what you type.
const PHOTO_TORN = 'polygon(0% 0%,100% 0%,100% 93%,92% 100%,83% 95%,73% 99%,63% 95%,53% 99%,43% 95%,33% 99%,23% 96%,13% 100%,5% 96%,0% 94%)'

function ImageNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.label || '')
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  function commit() { setEditing(false); updateNodeData(id, { label: draft }) }

  const showCap = data.showCaption === true   // off unless the owner enables it
  const gray = data.grayscale === true
  const rip = data.rip === true
  // Connected cards are held by the pins at each thread end - so only show the
  // top pushpin when the card has NO connections.
  const connected = useNodeConnections({ id }).length > 0

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} keepAspectRatio minWidth={90} minHeight={80} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      {!connected && <Pin size={20} color={data.pinColor || '#ff3b30'} />}
      <div style={{
        width: '100%', height: '100%',
        background: '#fbfaf6', borderRadius: rip ? 0 : 3, padding: showCap ? '9px 9px 0' : 9,
        clipPath: rip ? PHOTO_TORN : 'none', WebkitClipPath: rip ? PHOTO_TORN : 'none',
        display: 'flex', flexDirection: 'column',
        border: `1px solid ${selected ? 'var(--accent)' : 'rgba(0,0,0,0.14)'}`,
        boxShadow: selected ? '0 14px 30px rgba(0,0,0,.42)' : '0 9px 22px rgba(0,0,0,.34)',
        filter: selected ? 'drop-shadow(0 0 2px var(--accent))' : 'none',
      }}>
        <img
          src={data.src} alt={data.label || 'evidence'} draggable={false}
          style={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'contain', display: 'block', borderRadius: 1, filter: gray ? 'grayscale(1)' : 'none' }}
        />
        {showCap && (
          <div
            className="mono nodrag"
            onDoubleClick={() => editable && (setDraft(data.label || ''), setEditing(true))}
            style={{ height: 30, flexShrink: 0, display: 'grid', placeItems: 'center', padding: '0 4px' }}
          >
            {editing ? (
              <input
                ref={inputRef} value={draft}
                onChange={(e) => setDraft(e.target.value)} onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
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
