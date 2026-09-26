import { memo, useEffect, useRef } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { Pin } from './Pin.jsx'
import { tornBottom, hash, rng } from '../lib/torn.js'
import { useInlineEdit } from '../hooks/useInlineEdit.js'

// An "evidence" node styled as a pinned photo print: a white frame, the image, an
// OPTIONAL caption strip, a red pushpin, an optional torn ("rip") edge, and a photo
// STYLE - original, crumpled wrinkle paper, newsprint B&W, or a jigsaw puzzle look.

// Newspaper look: two columns of gray "text" bars (varying lengths). In a 300x200
// box, stretched over the photo with multiply so it reads as a printed article.
function newsBars(id) {
  const r = rng(hash(id) + 3)
  const cols = [{ x: 8, w: 128 }, { x: 152, w: 128 }]
  const bars = []
  for (const col of cols) {
    for (let y = 10; y < 192; y += 7.6) bars.push({ x: col.x, y: +y.toFixed(1), w: +(col.w * (0.5 + r() * 0.5)).toFixed(1) })
  }
  return bars
}

// Puzzle look: a jigsaw grid where ~25% of pieces are "missing" (recessed holes),
// so it reads as a half-solved puzzle. Deterministic per id. 300x200 box.
const PZ = 50
function jigEdge(x, y, horiz) {
  const s = PZ, m = 8
  return horiz
    ? `M${x} ${y} h${s * 0.38} c0 -${m} ${s * 0.24} -${m} ${s * 0.24} 0 h${s * 0.38}`
    : `M${x} ${y} v${s * 0.38} c-${m} 0 -${m} ${s * 0.24} 0 ${s * 0.24} v${s * 0.38}`
}
function puzzle(id) {
  const r = rng(hash(id) + 9)
  const cx = Math.ceil(300 / PZ), cy = Math.ceil(200 / PZ)
  const lines = [], cells = []
  for (let gy = 0; gy < cy; gy++) for (let gx = 0; gx < cx; gx++) {
    const px = gx * PZ, py = gy * PZ
    if (gx < cx - 1) lines.push(jigEdge(px + PZ, py, false))
    if (gy < cy - 1) lines.push(jigEdge(px, py + PZ, true))
    cells.push({ x: px + 3, y: py + 3 })
  }
  // exactly 2 missing pieces, picked deterministically
  const holes = []
  for (let k = 0; k < 2 && cells.length; k++) holes.push(cells.splice(Math.floor(r() * cells.length), 1)[0])
  return { lines, holes }
}

function ImageNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const { editing, draft, setDraft, ref: inputRef, rootRef, startEdit, commit, cancel } =
    useInlineEdit(id, data.label, (label) => updateNodeData(id, { label }), { editable, select: false })

  const showCap = data.showCaption === true   // off unless the owner enables it

  // Flicking Caption ON is a request to WRITE one, so go straight there: zoom to
  // the photo and open the field for typing. Otherwise the owner has to flip the
  // switch, hunt for the photo on the board, and double-click the strip. Only on
  // the off -> on transition, and only when there is no caption yet, so re-showing
  // an existing caption just shows it.
  const wasShowing = useRef(showCap)
  useEffect(() => {
    if (showCap && !wasShowing.current && editable && !data.label) startEdit()
    wasShowing.current = showCap
    // startEdit is stable enough here; re-running on anything else would re-open
    // the field while the owner is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCap])
  const rip = data.rip === true
  const ripClip = rip ? tornBottom(id) : 'none'
  // Photo style: original | wrinkle | newspaper | puzzle. (data.grayscale/.wrinkle
  // from older boards still map to their style so nothing breaks.)
  const style = data.style || (data.wrinkle ? 'wrinkle' : data.grayscale ? 'newspaper' : 'original')
  const imgFilter = style === 'newspaper' ? 'grayscale(1) contrast(1.35) brightness(1.05) sepia(0.12)'
    : style === 'wrinkle' ? 'url(#fx-wrinkle)'
    : 'none'
  const news = style === 'newspaper' ? newsBars(id) : null
  const puz = style === 'puzzle' ? puzzle(id) : null

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected && editable} keepAspectRatio minWidth={90} minHeight={80} lineClassName="line" handleClassName="handle" />
      <NodeHandles />
      {data.pin === true && <Pin size={27} color={data.pinColor || '#ff3b30'} />}
      <div style={{
        width: '100%', height: '100%',
        background: '#fbfaf6', borderRadius: rip ? 0 : 3, padding: showCap ? '8px 8px 0' : 0,
        clipPath: ripClip, WebkitClipPath: ripClip,
        display: 'flex', flexDirection: 'column',
        border: '1px solid rgba(0,0,0,0.14)',
        boxShadow: '0 9px 22px rgba(0,0,0,.34)',
      }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
          <img
            src={data.src} alt={data.label || 'evidence'} draggable={false}
            style={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'contain', display: 'block', borderRadius: 1, filter: imgFilter }}
          />
          {style === 'wrinkle' && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'soft-light', opacity: 0.9, borderRadius: 1,
              // Organic crumpled-paper shading (baked SVG crease-light), not a grid.
              backgroundImage: 'url("/wrinkle.svg")', backgroundSize: 'cover',
            }} />
          )}
          {news && (
            <svg viewBox="0 0 300 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'multiply' }}>
              {news.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height="3.4" rx="1.5" fill="rgba(45,45,45,0.5)" />)}
            </svg>
          )}
          {puz && (
            <svg viewBox="0 0 300 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {puz.holes.map((h, i) => (
                <g key={`h${i}`}>
                  <rect x={h.x} y={h.y} width={PZ - 6} height={PZ - 6} rx="6" fill="#faf7f0" stroke="rgba(0,0,0,0.16)" strokeWidth="1" />
                  <rect x={h.x + 1.5} y={h.y + 1.5} width={PZ - 9} height={PZ - 9} rx="5" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1.5" />
                </g>
              ))}
              {puz.lines.map((d, i) => <path key={`l${i}`} d={d} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.2" />)}
            </svg>
          )}
        </div>
        {showCap && (
          <div
            className="mono nodrag"
            onDoubleClick={() => editable && startEdit()}
            style={{ height: 30, flexShrink: 0, display: 'grid', placeItems: 'center', padding: '0 4px' }}
          >
            {editing ? (
              <input
                ref={inputRef} value={draft}
                onChange={(e) => setDraft(e.target.value)} onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
                placeholder="Caption"
                style={{ width: '100%', textAlign: 'center', border: 'none', outline: 'none', background: 'transparent', fontSize: 11, fontWeight: 700, color: '#16130f' }}
              />
            ) : (
              <span style={{
                fontSize: 11, fontWeight: 700, color: data.label ? '#16130f' : '#a9a196',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              }}>
                {data.label || (editable ? 'add caption' : '')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(ImageNode)
