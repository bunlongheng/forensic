import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { useEditZoom } from '../lib/useEditZoom.js'

// A grouping frame that sits BEHIND the evidence (added at the back of the stack)
// to visually cluster objects into sections. Translucent tinted panel, dashed
// edge, editable title in the top-left. Purely visual - it doesn't own children.
function ContainerNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.title || '')
  const ref = useRef(null)
  const { focus, restore } = useEditZoom(id)
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])
  function startEdit() { setDraft(data.title || ''); setEditing(true); focus() }
  function commit() { setEditing(false); updateNodeData(id, { title: draft }); restore() }

  const color = data.color || '#6b7280'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} minWidth={180} minHeight={130} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div style={{
        width: '100%', height: '100%', borderRadius: 16, border: `2px dashed ${color}`,
        background: `${color}12`,
      }}>
        <div
          className="mono nodrag"
          onDoubleClick={() => editable && startEdit()}
          style={{ display: 'inline-block', margin: 10, padding: '3px 10px', borderRadius: 8, background: color, color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '.03em' }}
        >
          {editing ? (
            <input
              ref={ref} value={draft}
              onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); restore() } }}
              style={{ border: 'none', outline: 'none', background: 'transparent', color: '#fff', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', width: Math.max(60, (draft.length + 1) * 8) }}
            />
          ) : (data.title || 'Section')}
        </div>
      </div>
    </div>
  )
}

export default memo(ContainerNode)
