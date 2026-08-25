// Fixed board decorations: a wooden embossed frame around the window and three
// picture-lamps across the top casting a warm glow. All pointer-events-off and
// window-anchored, so the corkboard still pans/zooms inside. Toggleable.
function Lamp() {
  return (
    <div style={{ position: 'relative', width: 96, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* mounting bracket */}
      <div style={{ width: 5, height: 11, background: 'linear-gradient(#3a3a3a,#161616)' }} />
      {/* dome shade with a glowing bulb at its mouth */}
      <div style={{
        width: 82, height: 30, background: 'linear-gradient(#4b3a27,#22190f)',
        borderRadius: '46% 46% 14% 14% / 82% 82% 18% 18%',
        boxShadow: '0 5px 11px rgba(0,0,0,.55), inset 0 2px 2px rgba(255,255,255,.28)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        <div style={{
          width: 34, height: 12, marginBottom: -4, borderRadius: '50%',
          background: 'radial-gradient(#fff7db, #ffd97a 68%, #f0b84a)',
          boxShadow: '0 0 16px 6px rgba(255,224,150,.75)',
        }} />
      </div>
      {/* warm conical beam spilling down onto the board */}
      <div style={{
        position: 'absolute', top: 34, width: 275, height: 370, pointerEvents: 'none',
        background: 'linear-gradient(rgba(255,235,186,0.5), rgba(255,235,186,0) 78%)',
        clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0% 100%)',
      }} />
    </div>
  )
}

export function Decorations() {
  return (
    <>
      {/* Wooden embossed frame */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4, borderRadius: 4,
        border: '30px solid #74502e',
        boxShadow: [
          'inset 0 0 0 3px rgba(0,0,0,0.5)',       // dark recess line at inner edge
          'inset 8px 8px 10px rgba(255,255,255,0.16)', // top-left raised bevel
          'inset -8px -8px 10px rgba(0,0,0,0.42)',      // bottom-right sunk bevel
          'inset 0 0 60px rgba(0,0,0,0.18)',            // subtle inner vignette
        ].join(', '),
      }} />
      {/* Three lamps across the center 33% of the top */}
      <div style={{
        position: 'absolute', top: 26, left: '33.5%', width: '33%', zIndex: 6,
        display: 'flex', justifyContent: 'space-between', pointerEvents: 'none',
      }}>
        <Lamp /><Lamp /><Lamp />
      </div>
    </>
  )
}
