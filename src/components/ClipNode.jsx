import { memo, useState, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { useEditZoom } from '../lib/useEditZoom.js'
import { Paperclip } from './Paperclip.jsx'
import { tornTopBottom } from '../lib/torn.js'

// A scrap of paper ripped from a notepad - torn top and bottom, no rounded corners,
// bold handwriting. A quick handwritten note that fits its words (auto-height).
// Single-click to write. Empty notes auto-cancel so the board never fills with blanks.
function autoGrow(el) { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }

const REST = 'drop-shadow(0 6px 12px rgba(0,0,0,.3))'

function ClipNode({ id, data, selected }) {
  const { updateNodeData, deleteElements } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.text || '')
  const ref = useRef(null)
  const { focus, restore } = useEditZoom(id)

  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); autoGrow(ref.current) } }, [editing])
  function startEdit() { setDraft(data.text || ''); setEditing(true); focus() }
  function commit() {
    setEditing(false)
    // Nothing written -> auto-cancel: drop the empty note instead of keeping a blank.
    if (draft.trim() === '') { restore(); deleteElements({ nodes: [{ id }] }); return }
    updateNodeData(id, { text: draft, autoEdit: undefined })
    restore()
  }
  // Freshly dropped (double-click on the board) notes open straight into edit mode.
  // Deferred a frame so we don't setState synchronously inside the mount effect.
  useEffect(() => {
    if (!data.autoEdit) return
    const raf = requestAnimationFrame(() => { updateNodeData(id, { autoEdit: undefined }); startEdit() })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bg = data.color || '#fbfaf6'
  const text = data.text || (editable ? 'Click to write…' : '')
  const rip = tornTopBottom(id)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <NodeHandles className="fx-handle-hidden" />
      {/* Selected feedback: a red torn "backing" that peeks out behind the paper as
          a ripped red border. Clips hide their anchor dots, so this is the only
          "you clicked me" cue. Same rip, a few px larger, sitting behind. */}
      {selected && (
        <div aria-hidden style={{
          position: 'absolute', inset: -3, zIndex: 0, background: 'var(--accent)',
          clipPath: rip, WebkitClipPath: rip, pointerEvents: 'none',
          filter: 'drop-shadow(0 0 5px var(--accent))',
        }} />
      )}
      <div
        // Single click drops the cursor in, ready to type.
        onClick={() => editable && !editing && startEdit()}
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', minHeight: 54, padding: '20px 17px', boxSizing: 'border-box',
          background: bg, color: '#1b1712',
          // Torn top + bottom, hard corners. drop-shadow (not box-shadow) so the
          // shadow follows the ripped silhouette instead of a rectangle.
          clipPath: rip, WebkitClipPath: rip,
          fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: 22, lineHeight: 1.16,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          filter: REST,
        }}
      >
        {editing ? (
          <textarea
            ref={ref} className="nodrag nowheel" value={draft} rows={1}
            onChange={(e) => { setDraft(e.target.value); autoGrow(e.target) }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); ref.current?.blur() } }}
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
