import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { useEditZoom } from '../lib/useEditZoom.js'
import { tornBottom } from '../lib/torn.js'

// Two looks, switched in the inspector. Double-click to write either way.
//   'rip' (default, and what every existing board uses) - floating handwriting on a
//         scrap ripped from a notepad: clean square top, torn bottom, sharpie ink.
//   'ink' - no paper at all: bare ransom-note lettering straight on the board.
// The two carry separate colours (`color` = paper tint, `ink` = ink colour) so
// flipping between styles never leaves you with cream text on cork.

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

  const ink = data.variant === 'ink'
  const rip = ink ? 'none' : tornBottom(id)
  const skin = ink
    // Default ink follows the board, not a fixed black: the dark cork is #241a10,
    // where black lettering is invisible (contrast ~1.1:1). An explicit swatch
    // choice always wins.
    ? { background: 'transparent', padding: 0, fontFamily: 'var(--font-ransom)', fontWeight: 400, fontSize: 34, lineHeight: 1.05, letterSpacing: '.01em', color: data.ink || 'var(--fx-ink)' }
    : {
        background: data.color || '#f7f2e6', padding: '18px 16px',
        // drop-shadow (not box-shadow) so the shadow follows the ripped edge.
        // Selection glow is applied globally on the node wrapper.
        filter: 'drop-shadow(0 6px 12px rgba(0,0,0,.26))',
        fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: 23, lineHeight: 1.14, color: '#1b1a17',
      }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} minWidth={90} minHeight={44} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div
        onDoubleClick={() => editable && startEdit()}
        style={{ width: '100%', height: '100%', display: 'grid', clipPath: rip, WebkitClipPath: rip, ...skin }}
      >
        {editing ? (
          <textarea
            ref={ref} className="nodrag nowheel" value={draft}
            onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); restore() } }}
            style={{ width: '100%', height: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', lineHeight: 'inherit', color: 'inherit' }}
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
