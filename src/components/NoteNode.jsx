import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { NOTE_TINTS } from '../lib/constants.js'

// A case-note: an editable typewriter card. Doubles as the free-text primitive
// for annotating connections between evidence.
function NoteNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.text || '')
  const ref = useRef(null)

  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])

  function commit() {
    setEditing(false)
    updateNodeData(id, { text: draft })
  }

  const tint = data.color || NOTE_TINTS[0]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} minWidth={110} minHeight={70} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div
        onDoubleClick={() => editable && (setDraft(data.text || ''), setEditing(true))}
        style={{
          width: '100%', height: '100%', borderRadius: 4,
          background: tint, color: '#26211a',
          border: `1.5px solid ${selected ? 'var(--accent)' : 'rgba(0,0,0,0.12)'}`,
          boxShadow: selected ? '0 12px 30px rgba(0,0,0,0.32)' : '0 6px 18px rgba(0,0,0,0.22)',
          padding: '12px 13px', overflow: 'hidden', display: 'flex',
        }}
      >
        {editing ? (
          <textarea
            ref={ref}
            className="mono nodrag nowheel"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
            style={{
              width: '100%', height: '100%', resize: 'none', border: 'none', outline: 'none',
              background: 'transparent', fontSize: 13, lineHeight: 1.5, color: '#26211a',
            }}
          />
        ) : (
          <div className="mono" style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', width: '100%' }}>
            {data.text || (editable ? 'Double-click to write…' : '')}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(NoteNode)
