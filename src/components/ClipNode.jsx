import { memo, useState, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { useEditZoom } from '../lib/useEditZoom.js'
import { Paperclip } from './Paperclip.jsx'
import { tornTopBottom } from '../lib/torn.js'

// A scrap of paper ripped from a notepad - torn top and bottom, no rounded corners,
// bold handwriting. A quick handwritten note that fits its words (auto-height).
// Triple-click to write; it zooms in and grows line by line.
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
  const rip = tornTopBottom(id)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <NodeHandles className="fx-handle-hidden" />
      <div
        // Triple-tap opens it: zooms in, drops the cursor, ready to type.
        onClick={onTap}
        style={{
          width: '100%', minHeight: 54, padding: '20px 17px', boxSizing: 'border-box',
          background: bg, color: '#1b1712',
          // Torn top + bottom, hard corners. drop-shadow (not box-shadow) so the
          // shadow follows the ripped silhouette instead of a rectangle.
          clipPath: rip, WebkitClipPath: rip,
          fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: 22, lineHeight: 1.16,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          filter: selected
            ? 'drop-shadow(0 10px 16px rgba(0,0,0,.36)) drop-shadow(0 0 2px var(--accent))'
            : 'drop-shadow(0 6px 12px rgba(0,0,0,.3))',
        }}
      >
        {editing ? (
          <textarea
            ref={ref} className="nodrag nowheel" value={draft} rows={1}
            onChange={(e) => { setDraft(e.target.value); autoGrow(e.target) }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); restore() } }}
            style={{ width: '100%', resize: 'none', overflow: 'hidden', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 'inherit', color: 'inherit', display: 'block' }}
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
