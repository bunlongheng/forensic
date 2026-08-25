import { NOTE_TINTS, PIN_COLORS, THREAD_COLORS, PAPER_TYPES } from '../lib/constants.js'

function segBtn(active) {
  return {
    padding: '6px 15px', fontSize: 12.5, fontWeight: 600, borderRadius: 9, cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--panel-2)',
    color: active ? 'var(--accent-ink)' : 'var(--text)', border: '1px solid var(--border)',
  }
}

function Swatch({ color, active, onClick, ring }) {
  return (
    <button onClick={onClick} title={color} style={{
      width: 24, height: 24, borderRadius: ring ? '50%' : 6, cursor: 'pointer', padding: 0,
      background: color, flexShrink: 0,
      border: active ? '2px solid var(--text)' : '1px solid rgba(0,0,0,0.2)',
      boxShadow: active ? '0 0 0 2px var(--panel), 0 0 0 3px var(--accent)' : 'none',
    }} />
  )
}

function Row({ label, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <Row label={label}>
      {[['On', true], ['Off', false]].map(([lbl, val]) => (
        <button key={lbl} onClick={() => onChange(val)} style={segBtn(value === val)}>{lbl}</button>
      ))}
    </Row>
  )
}

// Right-side properties panel for the selected node or edge - matches the toolbar
// chip styling, sized larger for comfortable editing.
export function Inspector({ kind, data, onNode, onEdge }) {
  const title = kind === 'edge' ? 'Thread' : kind === 'image' ? 'Photo' : 'Note'
  const variant = data?.variant || (kind === 'note' ? 'clean' : undefined)
  const pin = data?.pinColor || '#ff3b30'

  return (
    <div className="fx-noexport" style={{
      position: 'absolute', top: 96, right: 42, width: 264, zIndex: 10,
      background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16,
      padding: '16px 18px 20px', boxShadow: 'var(--shadow)',
    }}>
      <div className="mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{title}</div>

      {kind === 'note' && (
        <>
          <Row label="Paper">
            {PAPER_TYPES.map((p) => (
              <button key={p.key} onClick={() => onNode({ variant: p.key })} style={segBtn(variant === p.key)}>{p.label}</button>
            ))}
          </Row>
          <Row label="Sticky color">
            {NOTE_TINTS.map((c) => (
              <Swatch key={c} color={c} active={variant === 'sticky' && data?.color === c} onClick={() => onNode({ variant: 'sticky', color: c })} />
            ))}
          </Row>
          <Row label="Pin">
            {PIN_COLORS.map((c) => <Swatch key={c} color={c} ring active={pin === c} onClick={() => onNode({ pinColor: c })} />)}
          </Row>
        </>
      )}

      {kind === 'image' && (
        <>
          <Toggle label="Caption" value={data?.showCaption === true} onChange={(v) => onNode({ showCaption: v })} />
          <Toggle label="Grayscale" value={data?.grayscale === true} onChange={(v) => onNode({ grayscale: v })} />
          <Toggle label="Rip effect" value={data?.rip === true} onChange={(v) => onNode({ rip: v })} />
          <Row label="Pin">
            {PIN_COLORS.map((c) => <Swatch key={c} color={c} ring active={pin === c} onClick={() => onNode({ pinColor: c })} />)}
          </Row>
        </>
      )}

      {kind === 'edge' && (
        <Row label="Thread color">
          {THREAD_COLORS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#e5231b') === c} onClick={() => onEdge({ color: c })} />)}
        </Row>
      )}
    </div>
  )
}
