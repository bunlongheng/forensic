import { useState } from 'react'
import { Icon } from './Icon.jsx'

// Bottom-left "+" that fans its tools out along an arc into the upper-right
// quadrant (not a vertical stack). Four tools; sticker lives in the top toolbar.
const ITEMS = [
  { key: 'text', icon: 'text', label: 'Text' },
  { key: 'clip', icon: 'clip', label: 'Clip' },
  { key: 'callout', icon: 'callout', label: 'Callout' },
  { key: 'annotation', icon: 'circle', label: 'Circle' },
  { key: 'profile', icon: 'person', label: 'Person' },
  { key: 'container', icon: 'group', label: 'Group' },
]
const R = 98 // arc radius
// Evenly spread across the 0-90 quadrant: 4 equal slices, one icon centered in each.
const ANGLES = ITEMS.map((_, i) => ((2 * i + 1) * 90) / (2 * ITEMS.length)) // 11.25, 33.75, 56.25, 78.75

export function AddMenu({ onAdd }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />}
      <div className="fx-noexport fx-fab" style={{ position: 'absolute', left: 42, bottom: 42, zIndex: 10, width: 54, height: 54 }}>
        {open && ITEMS.map((it, i) => {
          const a = (ANGLES[i] * Math.PI) / 180
          const x = Math.cos(a) * R
          const y = Math.sin(a) * R
          return (
            <button
              key={it.key} className="fx-fab-item" onClick={() => { onAdd(it.key); setOpen(false) }} title={it.label}
              style={{
                position: 'absolute', left: 4 + x, bottom: 4 + y, width: 46, height: 46, borderRadius: '50%',
                background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer',
                display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow)',
                animation: 'fx-pop .18s both', animationDelay: `${i * 0.04}s`,
              }}
            ><Icon name={it.icon} size={20} /></button>
          )
        })}
        <button
          onClick={() => setOpen((o) => !o)} title="Add to board"
          style={{
            position: 'absolute', left: 0, bottom: 0, width: 54, height: 54, borderRadius: '50%',
            background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', cursor: 'pointer',
            display: 'grid', placeItems: 'center', boxShadow: '0 8px 20px rgba(0,0,0,.35)',
            transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .22s ease',
          }}
        ><Icon name="plus" size={26} /></button>
      </div>
    </>
  )
}
