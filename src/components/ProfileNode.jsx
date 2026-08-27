import { memo, useState, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useEditZoom } from '../lib/useEditZoom.js'

// A person on the board: a colored circle with initials (no photo) and an
// editable name under it. Double-click the name to rename.
function ProfileNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.name || '')
  const ref = useRef(null)
  const { focus, restore } = useEditZoom(id)
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])
  function startEdit() { setDraft(data.name || ''); setEditing(true); focus() }
  function commit() { setEditing(false); updateNodeData(id, { name: draft.trim() || data.name || 'Name' }); restore() }

  const name = data.name || 'Name'
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  const outline = data.color === 'outline'
  const color = outline ? '#1c1a17' : (data.color || '#2f6fed')

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: outline ? '#fbfaf6' : color, color: outline ? color : '#fff',
        display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 21, letterSpacing: '.02em',
        border: outline ? `3px solid ${color}` : '3px solid #fff',
        boxShadow: selected ? '0 0 0 2px var(--accent), 0 8px 18px rgba(0,0,0,.4)' : '0 6px 14px rgba(0,0,0,.34)',
      }}>{initials}</div>
      {editing ? (
        <input
          ref={ref} className="nodrag" value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); restore() } }}
          style={{ width: 92, textAlign: 'center', border: 'none', outline: 'none', borderRadius: 6, background: 'var(--panel)', fontSize: 12.5, fontWeight: 700, color: 'var(--text)', padding: '2px 4px' }}
        />
      ) : (
        <div
          onDoubleClick={() => editable && startEdit()}
          className="mono"
          style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', background: 'var(--panel)', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}
        >{name}</div>
      )}
    </div>
  )
}

export default memo(ProfileNode)
