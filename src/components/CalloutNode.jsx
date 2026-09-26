import { memo } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { useInlineEdit } from '../hooks/useInlineEdit.js'

// A loud call-out: a colored paper taped to the board at both top corners, with
// big marker text you type ("Important!!!", "Watch out!", "Missing??"). Double-
// click to edit. Meant to shout - short punchy headings, not paragraphs.
function Tape({ side }) {
  const left = side === 'left'
  return (
    <div style={{
      position: 'absolute', top: -9, [left ? 'left' : 'right']: -8,
      width: 58, height: 22, background: 'rgba(255,255,255,0.8)',
      transform: `rotate(${left ? -26 : 26}deg)`,
      boxShadow: '0 1px 4px rgba(0,0,0,.22)',
      borderLeft: '1px solid rgba(0,0,0,0.04)', borderRight: '1px solid rgba(0,0,0,0.04)',
      backdropFilter: 'saturate(0.9)',
    }} />
  )
}

function CalloutNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const { editing, draft, setDraft, ref, rootRef, startEdit, commit, cancel } =
    useInlineEdit(id, data.text, (text) => updateNodeData(id, { text }), { editable })

  const bg = data.color || '#fff3bf'
  const textStyle = {
    textAlign: 'center', fontWeight: 700, fontSize: 40, lineHeight: 1.02, color: '#1a1712',
    fontFamily: "'Caveat', ui-rounded, 'Segoe UI', sans-serif", wordBreak: 'break-word',
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} minWidth={150} minHeight={84} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div
        onDoubleClick={() => editable && startEdit()}
        style={{
          width: '100%', height: '100%', background: bg, borderRadius: 4, display: 'grid', placeItems: 'center',
          padding: '18px 20px 16px', overflow: 'hidden',
          boxShadow: '0 9px 22px rgba(0,0,0,.34)',
        }}
      >
        {editing ? (
          <textarea
            ref={ref} className="nodrag nowheel" value={draft}
            onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
            style={{ ...textStyle, width: '100%', height: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent' }}
          />
        ) : (
          <div style={textStyle}>{data.text || (editable ? 'Important!!!' : '')}</div>
        )}
      </div>
      <Tape side="left" />
      <Tape side="right" />
    </div>
  )
}

export default memo(CalloutNode)
