import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'

// A realistic wax seal: an irregular organic blob (never a clean circle) with a few
// drips, a domed satin gradient, and an embossed symbol pressed into the wax. The
// shape is deterministic per node id, so each seal is unique but stable.
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h) }
function rng(seed) { let s = (seed || 1) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

// Smooth closed spline (Catmull-Rom -> cubic bezier) through points.
function spline(p) {
  const n = p.length
  let d = `M ${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)} `
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `
  }
  return d + 'Z'
}

// Irregular wax blob with a couple of drips toward the bottom.
function blobPath(id) {
  const r = rng(hash(String(id)) + 5)
  const n = 13, base = 33, jit = 0.13
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    let rad = base * (1 - jit + r() * jit * 2)
    const bottom = Math.sin(a)
    if (bottom > 0.55 && r() > 0.4) rad *= 1.28 + r() * 0.4 // a drip
    pts.push([50 + Math.cos(a) * rad, 50 + Math.sin(a) * rad * (bottom > 0.55 ? 1.14 : 1)])
  }
  return spline(pts)
}

// Lighten (amt>0) or darken (amt<0) a #rrggbb toward white/black.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const m = (c) => (amt >= 0 ? Math.round(c + (255 - c) * amt) : Math.round(c * (1 + amt)))
  return '#' + [m(r), m(g), m(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function WaxSealNode({ id, data, selected }) {
  const color = data.color || '#8b1e3f'
  const symbol = data.symbol || '★'
  const p = blobPath(id)
  const lite = shade(color, 0.3), dark = shade(color, -0.36), floor = shade(color, -0.2)
  const gid = `wg-${id}`, fid = `wf-${id}`
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected} keepAspectRatio minWidth={44} minHeight={44} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <radialGradient id={gid} cx="40%" cy="32%" r="72%">
            <stop offset="0%" stopColor={lite} />
            <stop offset="56%" stopColor={color} />
            <stop offset="100%" stopColor={dark} />
          </radialGradient>
          <filter id={fid} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.6" floodColor="rgba(0,0,0,0.42)" />
          </filter>
        </defs>
        <path d={p} fill={`url(#${gid})`} filter={`url(#${fid})`} />
        <path d={p} fill="none" stroke={dark} strokeWidth="1.4" opacity="0.55" />
        <ellipse cx="42" cy="33" rx="13" ry="7.5" fill="rgba(255,255,255,0.15)" />
        {/* embossed symbol: shadow (up-left) + highlight (down-right) + recessed floor */}
        <g fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="30" textAnchor="middle">
          <text x="49.1" y="60.1" fill={dark}>{symbol}</text>
          <text x="50.9" y="61.9" fill={lite} opacity="0.6">{symbol}</text>
          <text x="50" y="61" fill={floor}>{symbol}</text>
        </g>
      </svg>
    </div>
  )
}

export default memo(WaxSealNode)
