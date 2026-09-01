import { useState, useRef } from 'react'
import { Icon } from './Icon.jsx'
import { STAMP_LABELS } from '../lib/constants.js'

// A floating tool KNOB: a round hub at bottom-center. Tap it and the tools bloom
// into a full ring around it; drag the ring to spin it like a knob. A tool with
// `choices` opens a small chooser first (present options before adding).
const ITEMS = [
  { key: 'text', icon: 'text', label: 'Text' },
  { key: 'callout', icon: 'callout', label: 'Callout' },
  { key: 'annotation', icon: 'circle', label: 'Circle' },
  { key: 'person', icon: 'person', label: 'Person', choices: [
    { label: 'Profile card', key: 'profile' },
    { label: 'Photo', action: 'image' },
  ] },
  { key: 'stamp', icon: 'stamp', label: 'Stamp', choices: STAMP_LABELS.map((l) => ({ label: l, key: 'stamp', extra: { label: l } })) },
  { key: 'redaction', icon: 'redact', label: 'Redact' },
  { key: 'marker', icon: 'marker', label: 'Marker' },
  { key: 'wax', icon: 'wax', label: 'Wax seal' },
  { key: 'crosshair', icon: 'crosshair', label: 'Crosshair' },
  { key: 'spotlight', icon: 'spotlight', label: 'Spotlight' },
  { key: 'container', icon: 'group', label: 'Group' },
]
const R = 112 // ring radius
const N = ITEMS.length

export function AddMenu({ onAdd, onAddImage }) {
  const [open, setOpen] = useState(false)
  const [chooser, setChooser] = useState(null)
  const [rot, setRot] = useState(0)      // ring rotation (degrees)
  const hubRef = useRef(null)
  const drag = useRef(null)

  function close() { setOpen(false); setChooser(null) }
  function pick(item) { if (item.choices) { setChooser(item); return } onAdd(item.key); close() }
  function choose(c) {
    close()
    if (c.action === 'image') { onAddImage?.(); return }
    onAdd(c.key || chooser.key, c.extra)
  }

  // Drag anywhere on the ring band to spin the knob.
  function onRingDown(e) {
    const r = hubRef.current.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const a0 = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI
    drag.current = { a0, rot0: rot, moved: false }
    const move = (ev) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI
      drag.current.moved = true
      setRot(drag.current.rot0 + (a - drag.current.a0))
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const item = { position: 'absolute', width: 38, height: 38, borderRadius: '50%', zIndex: 2,
    background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer',
    display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow)' }

  return (
    <>
      {(open || chooser) && <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />}

      {/* Chooser card - the "which one?" step, centered above the knob. */}
      {chooser && (
        <div className="fx-noexport nowheel" style={{
          position: 'absolute', left: '50%', bottom: 190, transform: 'translateX(-50%)', zIndex: 11, width: 150,
          maxHeight: '52vh', overflowY: 'auto',
          background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 11,
          padding: 6, boxShadow: 'var(--shadow)', animation: 'fx-pop .16s both',
        }}>
          <div className="mono" style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', padding: '1px 6px 4px' }}>
            {chooser.label.toUpperCase()}
          </div>
          {chooser.choices.map((c) => (
            <button key={c.label} onClick={() => choose(c)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: chooser.key === 'stamp' ? 'center' : 'flex-start',
                width: '100%', padding: chooser.key === 'stamp' ? '7px 6px' : '5px 8px', marginTop: 2,
                borderRadius: 7, border: '1px solid var(--border)', background: 'var(--panel-2)',
                color: 'var(--text)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              }}>
              {chooser.key === 'stamp'
                ? <span style={{
                    display: 'inline-block', transform: 'rotate(-3deg)',
                    border: '2px solid #d0342c', boxShadow: 'inset 0 0 0 1.2px #d0342c', borderRadius: 4,
                    color: '#d0342c', padding: '2px 7px', fontFamily: "'Space Mono', ui-monospace, monospace",
                    fontWeight: 700, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.9,
                  }}>{c.label}</span>
                : c.label}
            </button>
          ))}
        </div>
      )}

      <div
        ref={hubRef}
        className="fx-noexport"
        style={{
          position: 'absolute', left: 'calc(118px + env(safe-area-inset-left))', bottom: 'calc(150px + env(safe-area-inset-bottom))',
          zIndex: 10, width: 60, height: 60,
        }}
      >
        {open && !chooser && (
          <>
            {/* draggable ring band (spin the knob) - a circle behind the buttons */}
            <div
              onPointerDown={onRingDown}
              style={{
                position: 'absolute', left: 30 - (R + 22), top: 30 - (R + 22), width: (R + 22) * 2, height: (R + 22) * 2,
                borderRadius: '50%', clipPath: 'circle(50%)', zIndex: 0, cursor: 'grab',
              }}
            />
            {ITEMS.map((it, i) => {
              const a = ((i / N) * 360 + rot - 90) * Math.PI / 180
              const x = Math.cos(a) * R, y = Math.sin(a) * R
              return (
                <button
                  key={it.key} className="fx-fab-item" title={it.label}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => { if (!drag.current?.moved) pick(it) }}
                  style={{
                    ...item, left: 30 + x - 19, top: 30 + y - 19,
                    '--tx': `${x}px`, '--ty': `${y}px`,
                    animation: 'fx-bloom .42s cubic-bezier(.22,.9,.28,1.12) both',
                    animationDelay: `${i * 0.035}s`,
                  }}
                ><Icon name={it.icon} size={16} /></button>
              )
            })}
          </>
        )}
        <button
          onClick={() => (chooser ? setChooser(null) : setOpen((o) => !o))} title="Add to board"
          style={{
            position: 'absolute', left: 2, top: 2, width: 56, height: 56, borderRadius: '50%', zIndex: 3,
            background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', cursor: 'pointer',
            display: 'grid', placeItems: 'center', boxShadow: '0 8px 20px rgba(0,0,0,.35)',
            transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .22s ease',
          }}
        ><Icon name="plus" size={26} /></button>
      </div>
    </>
  )
}
