import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// An "evidence" node: a pinned photo with an optional case-file caption. Keeps
// its aspect ratio on resize; caption edits inline on double-click (owner only).
function ImageNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.label || '')
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    updateNodeData(id, { label: draft.trim() })
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer
        isVisible={selected && editable}
        keepAspectRatio
        minWidth={70}
        minHeight={50}
        lineClassName="line"
        handleClassName="handle"
      />
      <NodeHandles />

      {/* Evidence pin */}
      <div style={{
        position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
        width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.5)', zIndex: 2,
      }} />

      <div style={{
        width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden',
        background: 'var(--node-bg, #191d25)', border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--node-border, #2b323d)'}`,
        boxShadow: selected ? '0 10px 30px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.28)',
        display: 'flex', flexDirection: 'column',
      }}>
        <img
          src={data.src}
          alt={data.label || 'evidence'}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', flex: 1, minHeight: 0 }}
        />
        {(data.label || editing) && !editing && (
          <div
            className="mono"
            onDoubleClick={() => editable && (setDraft(data.label || ''), setEditing(true))}
            style={{
              padding: '5px 8px', fontSize: 10, letterSpacing: '.03em', fontWeight: 700,
              textTransform: 'uppercase', color: 'var(--node-cap, #cfd4db)',
              background: 'var(--node-cap-bg, rgba(0,0,0,0.55))', borderTop: '1px solid rgba(255,255,255,0.06)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {data.label}
          </div>
        )}
        {editing && (
          <input
            ref={inputRef}
            className="mono nodrag"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            placeholder="Label this evidence"
            style={{
              padding: '5px 8px', fontSize: 10, letterSpacing: '.03em', fontWeight: 700,
              textTransform: 'uppercase', border: 'none', outline: 'none',
              background: 'var(--node-cap-bg, rgba(0,0,0,0.65))', color: '#fff', width: '100%',
            }}
          />
        )}
      </div>

      {/* Invisible affordance so a caption-less image can still gain a caption. */}
      {editable && !data.label && !editing && selected && (
        <button
          className="nodrag"
          onClick={() => (setDraft(''), setEditing(true))}
          style={{
            position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
          }}
        >+ label</button>
      )}
    </div>
  )
}

export default memo(ImageNode)
