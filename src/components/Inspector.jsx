import { NOTE_TINTS, BRIGHT_TINTS, PIN_COLORS, THREAD_COLORS, PAPER_TYPES, PROFILE_COLORS, CONTAINER_TINTS, STICKER_EMOJIS, STAMP_COLORS, STAMP_LABELS } from '../lib/constants.js'

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
      width: 20, height: 20, borderRadius: ring ? '50%' : 6, cursor: 'pointer', padding: 0,
      background: color, flexShrink: 0,
      border: active ? '2px solid var(--text)' : '1px solid rgba(0,0,0,0.2)',
      boxShadow: active ? '0 0 0 2px var(--panel), 0 0 0 3px var(--accent)' : 'none',
    }} />
  )
}

function Row({ label, children }) {
  return (
    <div style={{ marginTop: 9 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.01em', color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{children}</div>
    </div>
  )
}

// iOS-style toggle: one aligned row - label on the left, sliding switch on the
// right - so every option lines up to the same width down the panel.
function Toggle({ label, value, onChange }) {
  return (
    <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.01em', color: 'var(--muted)' }}>{label}</span>
      <button
        role="switch" aria-checked={value} title={value ? 'On' : 'Off'} onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0,
          background: value ? 'var(--accent)' : 'var(--panel-2)',
          boxShadow: value ? 'none' : 'inset 0 0 0 1px var(--border)', transition: 'background .15s ease',
        }}
      >
        <span style={{
          display: 'block', width: 16, height: 16, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.35)', transition: 'transform .15s ease',
          transform: value ? 'translateX(16px)' : 'translateX(0)',
        }} />
      </button>
    </div>
  )
}

// Pin is opt-in: off by default, add one when you want it, then pick its color.
function PinControl({ data, onNode, pin }) {
  return (
    <>
      <Toggle label="Pin" value={data?.pin === true} onChange={(v) => onNode({ pin: v })} />
      {data?.pin === true && (
        <Row label="Pin color">
          {PIN_COLORS.map((c) => <Swatch key={c} color={c} ring active={pin === c} onClick={() => onNode({ pinColor: c })} />)}
        </Row>
      )}
    </>
  )
}

// Right-side properties panel for the selected node or edge - matches the toolbar
// chip styling, sized larger for comfortable editing.
export function Inspector({ kind, data, onNode, onEdge, width = 264 }) {
  const title = { edge: 'Thread', image: 'Photo', note: 'Note', text: 'Text', profile: 'Person', sticker: 'Sticker', container: 'Group', annotation: 'Circle', drawing: 'Drawing', callout: 'Callout', clip: 'Clip', stamp: 'Stamp' }[kind] || 'Item'
  const variant = data?.variant || (kind === 'note' ? 'clean' : undefined)
  const pin = data?.pinColor || '#ff3b30'

  return (
    <div className="fx-noexport" style={{
      position: 'absolute', top: 96, right: 42, width, zIndex: 10,
      background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '12px 14px 14px', boxShadow: 'var(--shadow)',
    }}>
      <div className="mono" style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '.02em' }}>{title}</div>

      {kind === 'note' && (
        <>
          <PinControl data={data} onNode={onNode} pin={pin} />
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
        </>
      )}

      {kind === 'image' && (
        <>
          <PinControl data={data} onNode={onNode} pin={pin} />
          <Toggle label="Caption" value={data?.showCaption === true} onChange={(v) => onNode({ showCaption: v })} />
          <Toggle label="Grayscale" value={data?.grayscale === true} onChange={(v) => onNode({ grayscale: v })} />
          <Toggle label="Rip effect" value={data?.rip === true} onChange={(v) => onNode({ rip: v })} />
          <Toggle label="Wrinkle" value={data?.wrinkle === true} onChange={(v) => onNode({ wrinkle: v })} />
        </>
      )}

      {kind === 'edge' && (
        <Row label="Thread color">
          {THREAD_COLORS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#e5231b') === c} onClick={() => onEdge({ color: c })} />)}
        </Row>
      )}

      {kind === 'profile' && (
        <>
          <div style={{ marginTop: 9 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.01em', color: 'var(--muted)', marginBottom: 5 }}>Name</div>
            <input
              value={data?.name || ''} onChange={(e) => onNode({ name: e.target.value })} placeholder="Name"
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
            />
          </div>
          <Row label="Avatar color">
            {PROFILE_COLORS.map((c) => <Swatch key={c} color={c} ring active={(data?.color || '#2f6fed') === c} onClick={() => onNode({ color: c })} />)}
            {/* Border-only: an outlined badge with no fill */}
            <button onClick={() => onNode({ color: 'outline' })} title="Border only" style={{
              width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'var(--panel)',
              border: data?.color === 'outline' ? '2px solid var(--text)' : '2px solid var(--muted)',
              boxShadow: data?.color === 'outline' ? '0 0 0 2px var(--panel), 0 0 0 3px var(--accent)' : 'none',
            }} />
          </Row>
        </>
      )}

      {kind === 'sticker' && (
        <Row label="Emoji">
          {STICKER_EMOJIS.map((em) => (
            <button key={em} onClick={() => onNode({ emoji: em })} title={em}
              style={{ width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 17, lineHeight: 1, background: (data?.emoji || '⭐') === em ? 'var(--accent)' : 'var(--panel-2)', border: '1px solid var(--border)' }}>{em}</button>
          ))}
        </Row>
      )}

      {kind === 'container' && (
        <>
          <div style={{ marginTop: 9 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.01em', color: 'var(--muted)', marginBottom: 5 }}>Title</div>
            <input
              value={data?.title || ''} onChange={(e) => onNode({ title: e.target.value })} placeholder="Section"
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <Row label="Group color">
            {CONTAINER_TINTS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#6b7280') === c} onClick={() => onNode({ color: c })} />)}
          </Row>
        </>
      )}

      {kind === 'annotation' && (
        <>
          <Row label="Ink color">
            {['#e5231b', '#f5a623', '#22c55e', '#2f6fed', '#a45cff', '#111827'].map((c) => <Swatch key={c} color={c} active={(data?.color || '#e5231b') === c} onClick={() => onNode({ color: c })} />)}
          </Row>
          <Toggle label="Send to back" value={data?.back === true} onChange={(v) => onNode({ back: v })} />
          {/* Lock keeps it from moving - and drops it behind everything so you can
              work on whatever it's circling. */}
          <Toggle label="Lock" value={data?.locked === true} onChange={(v) => onNode(v ? { locked: true, back: true } : { locked: false })} />
        </>
      )}

      {kind === 'drawing' && (
        <Row label="Sketch">
          <button onClick={() => onNode({ paths: [] })} style={segBtn(false)}>Clear strokes</button>
        </Row>
      )}

      {kind === 'text' && (
        <>
          <Row label="Paper color">
            {BRIGHT_TINTS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#f7f2e6') === c} onClick={() => onNode({ color: c })} />)}
          </Row>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Double-click the scrap to write.</div>
        </>
      )}

      {kind === 'callout' && (
        <>
          <Row label="Paper color">
            {NOTE_TINTS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#fff3bf') === c} onClick={() => onNode({ color: c })} />)}
          </Row>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Double-click to shout your headline.</div>
        </>
      )}

      {kind === 'clip' && (
        <>
          <Toggle label="Paperclip" value={data?.paperclip !== false} onChange={(v) => onNode({ paperclip: v })} />
          <Row label="Paper color">
            {['#fbfaf6', ...NOTE_TINTS].map((c) => <Swatch key={c} color={c} active={(data?.color || '#fbfaf6') === c} onClick={() => onNode({ color: c })} />)}
          </Row>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Double-click the paper to write.</div>
        </>
      )}

      {kind === 'stamp' && (
        <>
          <Row label="Stamp">
            {STAMP_LABELS.map((l) => (
              <button key={l} onClick={() => onNode({ label: l })} style={segBtn((data?.label || 'APPROVED') === l)}>{l}</button>
            ))}
          </Row>
          <Row label="Ink color">
            {STAMP_COLORS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#d0342c') === c} onClick={() => onNode({ color: c })} />)}
          </Row>
        </>
      )}
    </div>
  )
}
