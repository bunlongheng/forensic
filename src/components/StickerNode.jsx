import { memo } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { STICKER_EMOJIS } from '../lib/constants.js'

// An emoji sticker: the emoji on a white rounded chip with a die-cut white border,
// like a real vinyl sticker. Double-click cycles to the next emoji (or pick one in
// the inspector). Scales with the node via container-query units.
function StickerNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const emoji = data.emoji || '⭐'
  function cycle() {
    if (!editable) return
    const i = STICKER_EMOJIS.indexOf(emoji)
    updateNodeData(id, { emoji: STICKER_EMOJIS[(i + 1) % STICKER_EMOJIS.length] })
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected} keepAspectRatio minWidth={44} minHeight={44} lineClassName="line" handleClassName="handle" />
      <div
        onDoubleClick={cycle}
        style={{
          width: '100%', height: '100%', containerType: 'size', display: 'grid', placeItems: 'center',
          background: '#fff', borderRadius: '24%', border: '4px solid #fff',
          boxShadow: '0 5px 13px rgba(0,0,0,.3)',
        }}
      >
        <span style={{ fontSize: '62cqmin', lineHeight: 1, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.18))' }}>{emoji}</span>
      </div>
    </div>
  )
}

export default memo(StickerNode)
