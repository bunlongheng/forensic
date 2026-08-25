import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow, useNodeConnections } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { Pin } from './Pin.jsx'

// A case-note. Three paper styles (set from the inspector, or a sensible default):
//   torn   - cream newsprint with a ragged BOTTOM edge (top + sides clean)
//   clean  - cream newsprint, straight edges
//   sticky - a colored sticky card
// Held by a pushpin (color configurable), tilted slightly. First line = headline.
const CREAM = ['#f4efe1', '#efe7d4', '#f7f2e7', '#eee6d2']
// Ragged BOTTOM edge only - top + sides stay clean, like a sheet torn along the bottom.
const BOTTOM_TORN = 'polygon(0% 0%,100% 0%,100% 93%,92% 100%,83% 95%,73% 99%,63% 95%,53% 99%,43% 95%,33% 99%,23% 96%,13% 100%,5% 96%,0% 94%)'

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h) }

function NoteNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.text || '')
  const ref = useRef(null)

  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])
  function commit() { setEditing(false); updateNodeData(id, { text: draft }) }

  const h = hash(id)
  const rot = ((h % 7) - 3) * 0.85
  const variant = data.variant || (h % 3 === 0 ? 'torn' : 'clean') // default: mostly clean, some torn
  const pinColor = data.pinColor || '#ff3b30'
  const sticky = variant === 'sticky'
  const bg = sticky ? (data.color || '#fef3c7') : CREAM[h % CREAM.length]
  const connected = useNodeConnections({ id }).length > 0 // top pin only when unconnected

  const text = data.text || (editable ? 'Double-click to write…' : '')
  const [headline, ...rest] = text.split('\n')
  const body = rest.join('\n')

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} minWidth={130} minHeight={80} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      {!connected && <Pin size={20} color={pinColor} />}
      <div
        onDoubleClick={() => editable && (setDraft(data.text || ''), setEditing(true))}
        style={{
          width: '100%', height: '100%', transform: `rotate(${rot}deg)`, transformOrigin: '50% 0%',
          background: sticky ? bg : `linear-gradient(180deg, ${bg}, ${bg} 60%, #e7dec9)`,
          clipPath: variant === 'torn' ? BOTTOM_TORN : 'none', WebkitClipPath: variant === 'torn' ? BOTTOM_TORN : 'none',
          borderRadius: variant === 'torn' ? 0 : 4,
          padding: '15px 15px 17px', overflow: 'hidden', color: '#2a241c',
          fontFamily: "Georgia, 'Times New Roman', serif",
          boxShadow: selected ? '0 14px 30px rgba(0,0,0,.4)' : '0 8px 20px rgba(0,0,0,.32)',
          filter: selected ? 'drop-shadow(0 0 2px var(--accent))' : 'none',
        }}
      >
        {editing ? (
          <textarea
            ref={ref} className="nodrag nowheel"
            value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
            style={{ width: '100%', height: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.45, color: '#2a241c' }}
          />
        ) : (
          <div style={{ height: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.18, marginBottom: body ? 6 : 0, borderBottom: body ? '1px solid rgba(0,0,0,.28)' : 'none', paddingBottom: body ? 5 : 0 }}>
              {headline}
            </div>
            {body && <div style={{ fontSize: 12, lineHeight: 1.42, textAlign: 'justify', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#3a332a' }}>{body}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(NoteNode)
