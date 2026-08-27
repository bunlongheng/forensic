import { memo } from 'react'
import { relativeTime } from '../timeAgo.js'
import { Icon } from './Icon.jsx'

// Render one node the way it actually looks on the board (a small vector stand-in
// per type) so the card snapshot matches reality - not every node as a sticky.
function nodeEl(i) {
  const { id, x, y, w, h, type, data } = i
  const cx = x + w / 2, cy = y + h / 2
  if (type === 'image' && data.src) {
    return <image key={id} href={data.src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
  }
  if (type === 'profile') {
    const name = data.name || 'N'
    const init = name.split(/\s+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || '?'
    const r = Math.min(w, h) / 2
    const outline = data.color === 'outline'
    const col = outline ? '#1c1a17' : (data.color || '#2f6fed')
    return <g key={id}>
      <circle cx={cx} cy={y + r} r={r} fill={outline ? '#fbfaf6' : col} stroke={outline ? col : '#fff'} strokeWidth="3" />
      <text x={cx} y={y + r} fill={outline ? col : '#fff'} fontSize={r * 0.85} fontWeight="700" textAnchor="middle" dominantBaseline="central">{init}</text>
    </g>
  }
  if (type === 'sticker') {
    return <g key={id}>
      <rect x={x} y={y} width={w} height={h} rx={w * 0.22} fill="#fff" stroke="rgba(0,0,0,0.1)" strokeWidth="2" />
      <text x={cx} y={cy} fontSize={Math.min(w, h) * 0.6} textAnchor="middle" dominantBaseline="central">{data.emoji || '⭐'}</text>
    </g>
  }
  if (type === 'container') {
    return <rect key={id} x={x} y={y} width={w} height={h} rx="14" fill={`${data.color || '#6b7280'}18`} stroke={data.color || '#6b7280'} strokeWidth="2" strokeDasharray="9 6" />
  }
  if (type === 'annotation') {
    return <ellipse key={id} cx={cx} cy={cy} rx={(w / 2) * 0.92} ry={(h / 2) * 0.92} fill="none" stroke={data.color || '#e5231b'} strokeWidth="5" />
  }
  if (type === 'drawing') {
    return <g key={id}>{(data.paths || []).map((pts, pi) => (
      <path key={pi} fill="none" stroke="#141414" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
        d={pts.map((p, j) => (j ? 'L' : 'M') + (x + (p[0] / 100) * w).toFixed(1) + ',' + (y + (p[1] / 100) * h).toFixed(1)).join(' ')} />
    ))}</g>
  }
  if (type === 'clip') {
    return <g key={id}>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={data.color || '#fbfaf6'} stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
      <path d={`M${x + 24} ${y + 26} V${y - 8} a8 8 0 0 1 16 0 V${y + 20}`} fill="none" stroke="#9aa1a8" strokeWidth="4" strokeLinecap="round" />
    </g>
  }
  if (type === 'callout') {
    return <g key={id}>
      <rect x={x} y={y} width={w} height={h} rx="4" fill={data.color || '#fff3bf'} stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
      <rect x={x - 2} y={y - 5} width={w * 0.3} height="11" fill="rgba(255,255,255,0.85)" transform={`rotate(-22 ${x} ${y})`} />
      <rect x={x + w * 0.7 + 2} y={y - 5} width={w * 0.3} height="11" fill="rgba(255,255,255,0.85)" transform={`rotate(22 ${x + w} ${y})`} />
      <text x={cx} y={cy} fontSize={h * 0.3} fontWeight="800" textAnchor="middle" dominantBaseline="central" fill="#1a1712">{(data.text || '!').slice(0, 14)}</text>
    </g>
  }
  // note / text - paper cards (cream for plain paper, the tint for stickies)
  const fill = type === 'text' ? '#f7f2e6' : (data.variant === 'sticky' ? (data.color || '#fef3c7') : '#f2ece0')
  return <rect key={id} x={x} y={y} width={w} height={h} rx="4" fill={fill} stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
}

// A lightweight vector snapshot of a board scaled to fit the card - each node
// drawn as itself, connections as red thread. No React Flow instance per card, so
// the gallery stays fast even with many boards.
function Preview({ nodes = [], edges = [], accent }) {
  const items = nodes.slice(0, 60).map((n) => ({
    id: n.id, x: n.position?.x || 0, y: n.position?.y || 0,
    w: n.style?.width || 200, h: n.style?.height || 140, type: n.type, data: n.data || {},
  }))
  if (!items.length) {
    return <div style={{ height: 150, background: 'var(--panel-2)', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 26 }}>🧵</div>
  }
  const minX = Math.min(...items.map((i) => i.x))
  const minY = Math.min(...items.map((i) => i.y))
  const maxX = Math.max(...items.map((i) => i.x + i.w))
  const maxY = Math.max(...items.map((i) => i.y + i.h))
  const pad = 40
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  const byId = Object.fromEntries(items.map((i) => [i.id, i]))
  const center = (i) => ({ x: i.x + i.w / 2, y: i.y + i.h / 2 })
  // Containers sit behind everything, then thread, then the rest on top.
  const containers = items.filter((i) => i.type === 'container')
  const rest = items.filter((i) => i.type !== 'container')

  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: 150, display: 'block', background: 'var(--panel-2)' }}>
      {containers.map(nodeEl)}
      {edges.map((e, k) => {
        const a = byId[e.source], b = byId[e.target]
        if (!a || !b) return null
        const p = center(a), q = center(b)
        return <line key={k} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={accent} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      })}
      {rest.map(nodeEl)}
    </svg>
  )
}

function BoardCard({ board, accent, onOpen, onDelete }) {
  const nodes = board.nodes || []
  const edges = board.edges || []
  return (
    <div
      onClick={() => onOpen(board)}
      style={{
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
        overflow: 'hidden', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
        transition: 'transform .14s ease, box-shadow .14s ease', animation: 'fx-rise .4s both',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
    >
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <Preview nodes={nodes} edges={edges} accent={accent} />
      </div>
      <div style={{ padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{board.title}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
            {nodes.length} node{nodes.length === 1 ? '' : 's'} · {edges.length} link{edges.length === 1 ? '' : 's'} · {relativeTime(board.updatedAt)}
          </div>
        </div>
        <button
          title="Delete board"
          onClick={(e) => { e.stopPropagation(); onDelete(board) }}
          style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}
        ><Icon name="trash" size={15} /></button>
      </div>
    </div>
  )
}

export default memo(BoardCard)
