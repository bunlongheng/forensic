import { ViewportPortal } from '@xyflow/react'

// The guide lines shown while CMD-dragging: they mark the alignment the node has
// latched onto, so you can see where it lands before releasing. Drawn through
// ViewportPortal, so the coordinates are BOARD coordinates and the lines pan and
// zoom with the canvas instead of needing screen-space maths.

const PAD = 14 // overshoot both nodes a little so it reads as a guide, not a border

export function SnapGuides({ guides = [], color }) {
  if (!guides.length) return null
  return (
    <ViewportPortal>
      {guides.map((g) => (
        <div
          key={`${g.axis}-${g.at}`}
          className="fx-noexport fx-snap-guide"
          style={{
            position: 'absolute', pointerEvents: 'none', zIndex: 5,
            background: color, boxShadow: `0 0 6px ${color}`,
            ...(g.axis === 'x'
              ? { left: g.at, top: g.from - PAD, width: 1.5, height: g.to - g.from + PAD * 2 }
              : { left: g.from - PAD, top: g.at, height: 1.5, width: g.to - g.from + PAD * 2 }),
          }}
        />
      ))}
    </ViewportPortal>
  )
}
