import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// A numbered evidence marker - a glossy round badge (crime-scene tent number) you
// drop on clues to sequence them 1, 2, 3... Number + color set in the inspector;
// text scales with the badge via container-query units so resizing just works.
function MarkerNode({ data, selected }) {
  const color = data.color || '#8b1e3f'
  const num = data.number ?? 1
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected} keepAspectRatio minWidth={34} minHeight={34} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div style={{ width: '100%', height: '100%', containerType: 'size', display: 'grid', placeItems: 'center' }}>
        <div style={{
          width: '96cqmin', height: '96cqmin', borderRadius: '50%',
          background: `radial-gradient(circle at 36% 28%, rgba(255,255,255,0.42), rgba(255,255,255,0) 46%), ${color}`,
          border: '1.5px solid rgba(255,255,255,0.28)',
          boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.42)',
          display: 'grid', placeItems: 'center', color: '#fff',
        }}>
          <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: '48cqmin', lineHeight: 1, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{num}</span>
        </div>
      </div>
    </div>
  )
}

export default memo(MarkerNode)
