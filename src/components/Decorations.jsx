// Fixed board decoration: a wooden embossed frame around the window. Pointer-
// events-off and window-anchored, so the corkboard still pans/zooms inside.
export function Decorations() {
  return (
    <div className="fx-frame" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4, borderRadius: 4,
      border: '30px solid #74502e',
      boxShadow: [
        'inset 0 0 0 3px rgba(0,0,0,0.5)',       // dark recess line at inner edge
        'inset 8px 8px 10px rgba(255,255,255,0.16)', // top-left raised bevel
        'inset -8px -8px 10px rgba(0,0,0,0.42)',      // bottom-right sunk bevel
        'inset 0 0 60px rgba(0,0,0,0.18)',            // subtle inner vignette
      ].join(', '),
    }} />
  )
}
