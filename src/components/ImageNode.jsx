import { memo, useState, useRef, useEffect } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { NodeHandles } from './nodeHandles.jsx'
import { Pin } from './Pin.jsx'
import { tornBottom } from '../lib/torn.js'
import { useEditZoom } from '../lib/useEditZoom.js'

// An "evidence" node styled as a pinned photo print: a white frame, the image, an
// OPTIONAL caption strip, a red pushpin, an optional torn ("rip") edge, and a photo
// STYLE - original, crumpled wrinkle paper, newsprint B&W, or a jigsaw puzzle look.

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h) }
function rng(seed) { let s = (seed || 1) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

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
  const lines = [], holes = []
  for (let gy = 0; gy < cy; gy++) for (let gx = 0; gx < cx; gx++) {
    const px = gx * PZ, py = gy * PZ
    if (gx < cx - 1) lines.push(jigEdge(px + PZ, py, false))
    if (gy < cy - 1) lines.push(jigEdge(px, py + PZ, true))
    if (r() < 0.26) holes.push({ x: px + 3, y: py + 3 })
  }
  return { lines, holes }
}

function ImageNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const editable = data.editable !== false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.label || '')
  const inputRef = useRef(null)
  const { focus, restore } = useEditZoom(id)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  function startEdit() { setDraft(data.label || ''); setEditing(true); focus() }
  function commit() { setEditing(false); updateNodeData(id, { label: draft }); restore() }

  const showCap = data.showCaption === true   // off unless the owner enables it
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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
                  <rect x={h.x} y={h.y} width={PZ - 6} height={PZ - 6} rx="6" fill="rgba(28,20,12,0.82)" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
                  <rect x={h.x + 2} y={h.y + 2} width={PZ - 10} height={PZ - 10} rx="5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
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
                onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); restore() } }}
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
