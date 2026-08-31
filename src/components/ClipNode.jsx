import { memo, useState, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { useEditZoom } from '../lib/useEditZoom.js'
import { Paperclip } from './Paperclip.jsx'

// A slip of paper held by a real metal paperclip - a quick handwritten note that
// fits its words (auto-height). Triple-click to write; it zooms in and grows line
// by line. Kept separate from the sticky note and the sticker.
function autoGrow(el) { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }

function ClipNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.text || '')
  const ref = useRef(null)
  const { focus, restore } = useEditZoom(id)

  const taps = useRef([])
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); autoGrow(ref.current) } }, [editing])
  function startEdit() { setDraft(data.text || ''); setEditing(true); focus() }
  function commit() { setEditing(false); updateNodeData(id, { text: draft }); restore() }
  // Count taps ourselves - e.detail never reaches 3 on touch.
  function onTap(e) {
    if (!editable) return
    const t = e.timeStamp
    taps.current = taps.current.filter((x) => t - x < 600)
    taps.current.push(t)
    if (taps.current.length >= 3) { taps.current = []; startEdit() }
  }

  const bg = data.color || '#fbfaf6'
  const text = data.text || (editable ? 'Triple-click to write…' : '')

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <NodeHandles className="fx-handle-hidden" />
      <div
        // Triple-tap opens it: zooms in, drops the cursor, ready to type.
        onClick={onTap}
        style={{
          width: '100%', minHeight: 46, padding: '14px 15px', boxSizing: 'border-box',
          background: bg, borderRadius: 3, color: '#211d17',
          fontFamily: "'Caveat', cursive", fontSize: 21, lineHeight: 1.18,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          boxShadow: selected ? '0 12px 26px rgba(0,0,0,.4)' : '0 7px 18px rgba(0,0,0,.3)',
          outline: selected ? '2px solid var(--accent)' : 'none', outlineOffset: 2,
        }}
      >
        {editing ? (
          <textarea
            ref={ref} className="nodrag nowheel" value={draft} rows={1}
            onChange={(e) => { setDraft(e.target.value); autoGrow(e.target) }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); restore() } }}
            style={{ width: '100%', resize: 'none', overflow: 'hidden', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', color: 'inherit', display: 'block' }}
          />
        ) : (
          <div style={{ color: data.text ? '#211d17' : '#9a9078' }}>{text}</div>
        )}
      </div>
      {data.paperclip !== false && <Paperclip />}
    </div>
  )
}

export default memo(ClipNode)
