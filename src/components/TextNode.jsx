import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { useEditZoom } from '../lib/useEditZoom.js'

// Floating handwriting on a small torn scrap - like a sharpie note stuck to the
// board. Double-click to write. No frame, just paper + ink.
const TORN = 'polygon(0% 5%,5% 0%,96% 3%,100% 8%,99% 93%,95% 100%,4% 97%,0% 90%)'

function TextNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.text || '')
  const ref = useRef(null)
  const { focus, restore } = useEditZoom(id)
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])
  function startEdit() { setDraft(data.text || ''); setEditing(true); focus() }
  function commit() { setEditing(false); updateNodeData(id, { text: draft }); restore() }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} minWidth={90} minHeight={48} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div
        onDoubleClick={() => editable && startEdit()}
        style={{
          width: '100%', height: '100%', background: '#f7f2e6', clipPath: TORN, WebkitClipPath: TORN,
          padding: '12px 15px', display: 'grid', boxShadow: '0 7px 16px rgba(0,0,0,.26)',
          fontFamily: "'Caveat', cursive", fontSize: 23, lineHeight: 1.12, color: '#1b1a17',
          outline: selected ? '2px solid var(--accent)' : 'none', outlineOffset: 2,
        }}
      >
        {editing ? (
          <textarea
            ref={ref} className="nodrag nowheel" value={draft}
            onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); restore() } }}
            style={{ width: '100%', height: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', color: 'inherit' }}
          />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', alignSelf: 'center' }}>
            {data.text || (editable ? 'write here…' : '')}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(TextNode)
