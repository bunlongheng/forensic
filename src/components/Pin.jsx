// A glossy pushpin with a cast shadow - the thing that "holds" evidence to the
// board. Any solid color renders glossy via a white radial highlight overlay.
// Shared by note clippings and image nodes. Decorative only.
export function Pin({ size = 20, color = '#ff3b30' }) {
  const needle = Math.round(size * 0.55)
  return (
    <div style={{
      position: 'absolute', top: -Math.round(size * 0.85), left: '50%',
      transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none',
      width: size, textAlign: 'center',
    }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,.7), rgba(255,255,255,0) 44%), ${color}`,
        boxShadow: 'inset 0 -3px 4px rgba(0,0,0,.42), 0 5px 6px rgba(0,0,0,.5)',
      }} />
      <div style={{
        width: 2.5, height: needle, margin: '-1px auto 0',
        background: 'linear-gradient(#c3c7cd,#6d7278)', borderRadius: '0 0 1px 1px',
        boxShadow: '2px 3px 3px rgba(0,0,0,.4)',
      }} />
    </div>
  )
}
