import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// A spotlight: a circular lit area that DIMS the rest of the board around it. The
// trick is one giant box-shadow spread out from a transparent circle - everything
// outside the circle goes dark, the circle itself stays clear so the evidence under
// it is lit. Drag the lit spot to move it; resize to widen the beam. The node sits
// above other cards (high zIndex) so the dimming covers them; the shadow is
// pointer-transparent so you can still grab the cards underneath.
function SpotlightNode({ data, selected }) {
  const dim = data.dim ?? 0.72
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected} keepAspectRatio minWidth={70} minHeight={70} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
        boxShadow: `inset 0 0 34px 12px rgba(0,0,0,${Math.min(0.9, dim + 0.1)}), 0 0 0 5000px rgba(0,0,0,${dim})`,
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
      }} />
    </div>
  )
}

export default memo(SpotlightNode)
