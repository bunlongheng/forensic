// Fixed board decoration: a wooden embossed frame around the window, plus an aged
// case-file atmosphere inside it (fine film grain + a warm vignette). All pointer-
// events-off and window-anchored, so the corkboard still pans/zooms underneath.

// A tiny tiling grain tile (fractal noise) - gives the flat canvas a paper tooth.
const GRAIN = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix type='saturate' values='0'/></filter>" +
  "<rect width='100%' height='100%' filter='url(#n)'/></svg>",
)

export function Decorations() {
  return (
    <>
      {/* Aged paper: warm vignette + grain, tucked just inside the wooden frame. */}
      <div className="fx-frame" style={{
        position: 'absolute', inset: 30, pointerEvents: 'none', zIndex: 3,
        background: 'radial-gradient(125% 120% at 50% 38%, rgba(255,246,225,0.10) 0%, transparent 46%, rgba(74,52,28,0.30) 100%)',
      }} />
      <div className="fx-frame" style={{
        position: 'absolute', inset: 30, pointerEvents: 'none', zIndex: 3,
        backgroundImage: `url("${GRAIN}")`, backgroundSize: '140px 140px',
        mixBlendMode: 'multiply', opacity: 0.06,
      }} />
      {/* Wooden embossed frame. */}
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
    </>
  )
}
