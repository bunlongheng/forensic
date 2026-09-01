import { useState } from 'react'
import { Icon } from './Icon.jsx'
import { STAMP_LABELS } from '../lib/constants.js'

// Bottom-left "+" that fans its tools out along an arc into the upper-right quadrant.
// A tool with `choices` doesn't add straight away - it opens a small chooser first
// (present options before adding), e.g. Stamp -> which stamp.
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
  { key: 'container', icon: 'group', label: 'Group' },
]
const R = 172 // arc radius - wide enough that the smaller buttons never overlap
const ANGLES = ITEMS.map((_, i) => ((2 * i + 1) * 90) / (2 * ITEMS.length))

export function AddMenu({ onAdd, onAddImage }) {
  const [open, setOpen] = useState(false)
  const [chooser, setChooser] = useState(null) // an ITEMS entry whose choices are showing

  function close() { setOpen(false); setChooser(null) }
  function pick(item) {
    if (item.choices) { setChooser(item); return } // show options first
    onAdd(item.key); close()
  }
  function choose(c) {
    close()
    if (c.action === 'image') { onAddImage?.(); return } // Photo -> file picker
    onAdd(c.key || chooser.key, c.extra)
  }

  return (
    <>
      {(open || chooser) && <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />}

      {/* Chooser card - the "which one?" step before a tool is added. */}
      {chooser && (
        <div className="fx-noexport nowheel" style={{
          position: 'absolute', left: 42, bottom: 104, zIndex: 11, width: 148,
          maxHeight: '58vh', overflowY: 'auto',
          background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 11,
          padding: 6, boxShadow: 'var(--shadow)', animation: 'fx-pop .16s both',
        }}>
          <div className="mono" style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', padding: '1px 6px 4px' }}>
            {chooser.label.toUpperCase()}
          </div>
          {chooser.choices.map((c) => (
            <button key={c.label} onClick={() => choose(c)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', marginTop: 2,
                borderRadius: 7, border: '1px solid var(--border)', background: 'var(--panel-2)',
                color: 'var(--text)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              }}>{c.label}</button>
          ))}
        </div>
      )}

      <div className="fx-noexport fx-fab" style={{ position: 'absolute', left: 42, bottom: 42, zIndex: 10, width: 54, height: 54 }}>
        {open && !chooser && ITEMS.map((it, i) => {
          const a = (ANGLES[i] * Math.PI) / 180
          const x = Math.cos(a) * R
          const y = Math.sin(a) * R
          return (
            <button
              key={it.key} className="fx-fab-item" onClick={() => pick(it)} title={it.label}
              style={{
                position: 'absolute', left: 8 + x, bottom: 8 + y, width: 38, height: 38, borderRadius: '50%',
                background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer',
                display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow)',
                animation: 'fx-pop .18s both', animationDelay: `${i * 0.04}s`,
              }}
            ><Icon name={it.icon} size={17} /></button>
          )
        })}
        <button
          onClick={() => (chooser ? setChooser(null) : setOpen((o) => !o))} title="Add to board"
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
