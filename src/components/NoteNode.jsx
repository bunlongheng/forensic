import { memo } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { Pin } from './Pin.jsx'
import { Paperclip } from './Paperclip.jsx'
import { tornBottom, hash } from '../lib/torn.js'
import { useInlineEdit } from '../hooks/useInlineEdit.js'

// A case-note. Three paper styles (set from the inspector, or a sensible default):
//   torn   - cream newsprint with a ragged BOTTOM edge (top + sides clean)
//   clean  - cream newsprint, straight edges
//   sticky - a colored sticky card
// Held by a pushpin (color configurable), tilted slightly. First line = headline.
const CREAM = ['#f4efe1', '#efe7d4', '#f7f2e7', '#eee6d2']

function NoteNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const { editing, draft, setDraft, ref, rootRef, startEdit, commit, cancel } =
    useInlineEdit(id, data.text, (text) => updateNodeData(id, { text }), { editable })

  const h = hash(id)
  const variant = data.variant || (h % 3 === 0 ? 'torn' : 'clean')
  const sticky = variant === 'sticky'
  const clean = variant === 'clean'
  // "Paper" (clean) sits perfectly straight and is held by a clip; sticky/torn keep
  // the slight pinned tilt.
  const rot = clean ? 0 : ((h % 7) - 3) * 0.85
  const pinColor = data.pinColor || '#ff3b30'
  const bg = sticky ? (data.color || '#fef3c7') : CREAM[h % CREAM.length]

  const text = data.text || (editable ? 'Double-click to write…' : '')
  const [headline, ...rest] = text.split('\n')
  const body = rest.join('\n')

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} minWidth={130} minHeight={80} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      {/* Paper is held by a clip; the pinned styles keep their optional pushpin. */}
      {clean ? <Paperclip /> : (data.pin === true && <Pin size={27} color={pinColor} />)}
      <div
        onDoubleClick={() => editable && startEdit()}
        style={{
          width: '100%', height: '100%', transform: `rotate(${rot}deg)`, transformOrigin: '50% 0%',
          background: sticky ? bg : `linear-gradient(180deg, ${bg}, ${bg} 60%, #e7dec9)`,
          clipPath: variant === 'torn' ? tornBottom(id) : 'none', WebkitClipPath: variant === 'torn' ? tornBottom(id) : 'none',
          borderRadius: variant === 'torn' ? 0 : 4,
          padding: '15px 15px 17px', overflow: 'hidden', color: '#2a241c',
          fontFamily: "Georgia, 'Times New Roman', serif",
          boxShadow: '0 8px 20px rgba(0,0,0,.32)',
        }}
      >
        {editing ? (
          <textarea
            ref={ref} className="nodrag nowheel"
            value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
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
