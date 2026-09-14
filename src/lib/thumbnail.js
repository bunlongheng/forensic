// The gallery card is a real snapshot of the board: the actual rendered canvas,
// shrunk to fit. Not a redrawing of it - an earlier version hand-painted a
// stand-in per node type and the stamps, text and photos all sat slightly wrong.
//
// This is React Flow's own export recipe. We hand html-to-image the viewport
// element together with an OVERRIDE transform computed to fit every node in the
// frame. The override only applies inside the capture, so the owner's real zoom
// and pan are never touched and nothing on screen jumps.

// Matches the gallery strip's aspect (roughly 390x150). The card paints the image
// with object-fit:cover, so capturing at the SAME shape means the crop takes
// nothing off the board.
const W = 520
const H = 200
const SCALE = 2        // capture at 2x so the card stays sharp on retina
const PAD = 0.06       // fraction of the frame kept as breathing room

// Returns a data: URL, or null when there is nothing worth showing (empty board,
// canvas not mounted, or the browser refused the export).
export async function makeThumbnail(nodes = [], canvasColor = '#e0cfa6') {
  if (!nodes.length) return null
  const el = document.querySelector('.react-flow__viewport')
  if (!el) return null

  const [{ toCanvas }, { getNodesBounds, getViewportForBounds }] = await Promise.all([
    import('html-to-image'),
    import('@xyflow/react'),
  ])

  const w = W * SCALE
  const h = H * SCALE
  // A grouped child's `position` is RELATIVE to its container, and the standalone
  // getNodesBounds has no lookup to resolve that - it read (26, 26) for a node
  // actually sitting at (2026, 1526), so a grouped board framed as a speck in the
  // corner. Flatten to absolute coordinates first.
  const at = new Map(nodes.map((n) => [n.id, n.position || { x: 0, y: 0 }]))
  const absolute = (n) => {
    let { x, y } = n.position || { x: 0, y: 0 }
    for (let p = n.parentId, hops = 0; p && hops < 10; hops++) {
      const pp = at.get(p)
      if (!pp) break
      x += pp.x; y += pp.y
      p = nodes.find((m) => m.id === p)?.parentId
    }
    return { ...n, position: { x, y }, parentId: undefined }
  }
  const bounds = getNodesBounds(nodes.map(absolute))
  if (!bounds || !bounds.width || !bounds.height) return null
  // minZoom 0.01 so a sprawling board still fits; maxZoom 2 so a single small
  // node does not fill the whole card at absurd magnification.
  const vp = getViewportForBounds(bounds, w, h, 0.01, 2, PAD)
  if (!vp) return null

  try {
    const canvas = await toCanvas(el, {
      backgroundColor: canvasColor,
      width: w,
      height: h,
      pixelRatio: 1, // already capturing at SCALE via width/height
      // Skip the chrome that is not part of the board itself.
      filter: (n) => !n.classList?.contains('react-flow__minimap')
        && !n.classList?.contains('react-flow__controls')
        && !n.classList?.contains('fx-noexport'),
      style: {
        width: `${w}px`,
        height: `${h}px`,
        transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
      },
    })
    // WebP is roughly a third the size of PNG here; some engines ignore it and
    // hand back another type, so fall back to jpeg rather than ship a huge PNG.
    let out = canvas.toDataURL('image/webp', 0.72)
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.78)
    return out.length > 380_000 ? canvas.toDataURL('image/jpeg', 0.6) : out
  } catch { return null } // tainted canvas / export disabled / node detached
}
