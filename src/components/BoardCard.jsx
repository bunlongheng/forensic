import { memo } from 'react'
import { relativeTime } from '../timeAgo.js'
import { Icon } from './Icon.jsx'

// A lightweight vector snapshot of a board - image nodes as thumbnails, notes as
// tinted cards, connections as red thread - scaled to fit the card. No React Flow
// instance per card, so the gallery stays fast even with many boards.
function Preview({ nodes = [], edges = [], accent }) {
  const items = nodes.slice(0, 40).map((n) => {
    const w = n.style?.width || 200
    const h = n.style?.height || 140
    return { id: n.id, x: n.position?.x || 0, y: n.position?.y || 0, w, h, type: n.type, data: n.data || {} }
  })
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

  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: 150, display: 'block', background: 'var(--panel-2)' }}>
      {edges.map((e, k) => {
        const a = byId[e.source], b = byId[e.target]
        if (!a || !b) return null
        const p = center(a), q = center(b)
        return <line key={k} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={accent} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      })}
      {items.map((i) => i.type === 'image' && i.data.src ? (
        <image key={i.id} href={i.data.src} x={i.x} y={i.y} width={i.w} height={i.h} preserveAspectRatio="xMidYMid slice" rx="6" />
      ) : (
        <rect key={i.id} x={i.x} y={i.y} width={i.w} height={i.h} rx="4" fill={i.data.color || '#fef3c7'} stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
      ))}
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
