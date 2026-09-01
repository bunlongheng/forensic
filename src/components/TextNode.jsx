import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { useEditZoom } from '../lib/useEditZoom.js'
import { tornBottom } from '../lib/torn.js'

// Floating handwriting on a scrap ripped from a notepad - clean square top, torn
// bottom edge, bold sharpie ink, no frame. Double-click to write.

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
  const rip = tornBottom(id)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} minWidth={90} minHeight={48} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div
        onDoubleClick={() => editable && startEdit()}
        style={{
          width: '100%', height: '100%', background: data.color || '#f7f2e6', clipPath: rip, WebkitClipPath: rip,
          padding: '18px 16px', display: 'grid',
          // drop-shadow (not box-shadow) so the shadow follows the ripped edge.
          // Selection glow is applied globally on the node wrapper.
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,.26))',
          fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: 23, lineHeight: 1.14, color: '#1b1a17',
        }}
      >
        {editing ? (
          <textarea
            ref={ref} className="nodrag nowheel" value={draft}
            onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); restore() } }}
            style={{ width: '100%', height: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 'inherit', color: 'inherit' }}
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
