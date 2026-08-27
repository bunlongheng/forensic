// A unique, sharp torn BOTTOM edge per node - deterministic from the node id so the
// rip is stable across renders but different on every card. Top and sides stay
// clean; the bottom bites in with irregular, alternating sharp teeth (a real tear,
// not a soft wave).
function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function rng(seed) {
  let s = (seed || 1) >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

export function tornBottom(id, { steps = 14, amp = 9 } = {}) {
  const r = rng(hash(String(id)) + 1)
  const pts = ['0% 0%', '100% 0%']
  for (let i = 0; i <= steps; i++) {
    const x = 100 - (i / steps) * 100
    // Alternate deep and shallow bites, with jitter, for a jagged torn silhouette.
    const deep = i % 2 === 0
    const bite = deep ? amp * (0.55 + r() * 0.45) : r() * amp * 0.3
    const y = 100 - bite
    pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`)
  }
  return `polygon(${pts.join(',')})`
}

// Same idea but the tear runs down the RIGHT edge (top + left + bottom stay clean),
// like a strip ripped off the side of a pad.
export function tornRight(id, { steps = 16, amp = 8 } = {}) {
  const r = rng(hash(String(id)) + 3)
  const pts = ['0% 0%']
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * 100
    const deep = i % 2 === 0
    const bite = deep ? amp * (0.55 + r() * 0.45) : r() * amp * 0.3
    pts.push(`${(100 - bite).toFixed(1)}% ${y.toFixed(1)}%`)
  }
  pts.push('0% 100%')
  return `polygon(${pts.join(',')})`
}
