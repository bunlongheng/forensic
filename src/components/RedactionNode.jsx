import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// A censor bar - drag it over text or a photo to redact it. Marker-black by default
// with a white-out option. Resize to any strip length. Faint ink streak so it reads
// as a real marker/pen swipe, not a flat rectangle.
function RedactionNode({ data, selected }) {
  const color = data.color || '#111111'
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected} minWidth={40} minHeight={12} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div style={{
        width: '100%', height: '100%', background: color, borderRadius: 2,
        backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(0,0,0,0.10) 45%, rgba(255,255,255,0.05))',
        boxShadow: '0 1px 3px rgba(0,0,0,.35)',
      }} />
    </div>
  )
}

export default memo(RedactionNode)
