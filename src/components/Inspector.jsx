import { openAttachment, KIND_LABEL, prettySize } from '../lib/attach.js'
import { WAX_COLORS, NOTE_TINTS, BRIGHT_TINTS, TEXT_STYLES, INK_COLORS, PIN_COLORS, THREAD_COLORS, PAPER_TYPES, PROFILE_COLORS, CONTAINER_TINTS, STICKER_EMOJIS, STAMP_COLORS, STAMP_LABELS, CROSSHAIR_COLORS } from '../lib/constants.js'
import { NODE_REGISTRY } from '../lib/nodeRegistry.js'

// Human names for the hex swatches above, so a screen reader hears "Butter
// yellow" instead of "Color #fef3c7". Keyed by lowercase hex; falls back to the
// hex itself for anything not named here.
const COLOR_NAMES = {
  '#fef3c7': 'Butter yellow', '#fca5a5': 'Blush red', '#dbeafe': 'Sky blue',
  '#dcfce7': 'Mint green', '#fce7f3': 'Petal pink', '#e0e7ff': 'Periwinkle', '#f3f0e8': 'Cream',
  '#ffffff': 'White', '#ffe600': 'Yellow', '#ff9500': 'Orange', '#ff3b30': 'Red',
  '#ff2d95': 'Pink', '#a259ff': 'Purple', '#0a84ff': 'Blue', '#30d158': 'Green',
  '#111111': 'Black', '#d0342c': 'Crimson', '#1f5c8b': 'Steel blue', '#1f9d55': 'Forest green',
  '#b8860b': 'Goldenrod', '#2f6fed': 'Blue', '#22c55e': 'Green', '#f5a623': 'Amber',
  '#a45cff': 'Violet', '#111827': 'Charcoal', '#e5231b': 'Red', '#db2777': 'Magenta',
  '#0ea5e9': 'Cyan', '#6b7280': 'Slate gray', '#8b1e3f': 'Wine', '#7a1220': 'Dark maroon',
  '#a02c2c': 'Brick red', '#5b3a1a': 'Umber', '#1f3a5c': 'Navy', '#2f5d3f': 'Pine green',
  '#f5c518': 'Gold', '#1a1a1a': 'Black', '#2563eb': 'Royal blue', '#3a2a1a': 'Brown',
  '#fbfaf6': 'Off white',
}
const nameFor = (hex) => COLOR_NAMES[hex.toLowerCase()] || hex

function segBtn(active) {
  return {
    padding: '6px 15px', fontSize: 12.5, fontWeight: 600, borderRadius: 9, cursor: 'pointer',
    background: active ? 'var(--accent-fill)' : 'var(--panel-2)',
    color: active ? 'var(--accent-ink)' : 'var(--text)', border: '1px solid var(--border)',
  }
}

function Swatch({ color, active, onClick, ring, name }) {
  const label = name || nameFor(color)
  return (
    <button onClick={onClick} title={label} aria-label={label} aria-pressed={Boolean(active)} style={{
      width: 20, height: 20, borderRadius: ring ? '50%' : 6, cursor: 'pointer', padding: 0,
      background: color, flexShrink: 0,
      border: active ? '2px solid var(--text)' : '1px solid var(--border)',
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

// A single-line labeled text input - used for the 4 kinds that just need to name
// something (person, group, stamp label).
function TextField({ label, value, onChange, placeholder, maxLength }) {
  return (
    <div style={{ marginTop: 9 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.01em', color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      <input
        value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} aria-label={label}
        style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
      />
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
        role="switch" aria-checked={value} aria-label={label} title={value ? 'On' : 'Off'} onClick={() => onChange(!value)}
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

// ── Per-type panels ─────────────────────────────────────────────────────────
// One render function per panel key. The registry says WHICH key a node type
// opens (NODE_REGISTRY[type].inspector); the map below says what that key draws,
// so a new type needs a line there and a panel here - never a new branch in
// Inspector. These are plain functions, not components, so the panel stays part
// of Inspector's own render exactly as the inline branches were: no extra
// component boundary, no state of its own. Each takes only the props it needs.

function notePanel({ data, onNode, pin }) {
  const variant = data?.variant || 'clean'
  return (
    <>
      <PinControl data={data} onNode={onNode} pin={pin} />
      <Row label="Paper">
        {PAPER_TYPES.map((p) => (
          <button key={p.key} onClick={() => onNode({ variant: p.key })} aria-pressed={variant === p.key} style={segBtn(variant === p.key)}>{p.label}</button>
        ))}
      </Row>
      <Row label="Sticky color">
        {NOTE_TINTS.map((c) => (
          <Swatch key={c} color={c} active={variant === 'sticky' && data?.color === c} onClick={() => onNode({ variant: 'sticky', color: c })} />
        ))}
      </Row>
    </>
  )
}

function imagePanel({ data, onNode, pin }) {
  const style = data?.style || (data?.wrinkle ? 'wrinkle' : data?.grayscale ? 'newspaper' : 'original')
  return (
    <>
      <PinControl data={data} onNode={onNode} pin={pin} />
      <Row label="Style">
        {[['original', 'Original'], ['wrinkle', 'Wrinkle'], ['newspaper', 'Newspaper'], ['puzzle', 'Puzzle']].map(([k, l]) => (
          <button key={k} onClick={() => onNode({ style: k, grayscale: undefined, wrinkle: undefined })} aria-pressed={style === k} style={segBtn(style === k)}>{l}</button>
        ))}
      </Row>
      <Toggle label="Caption" value={data?.showCaption === true} onChange={(v) => onNode({ showCaption: v })} />
      <Toggle label="Rip effect" value={data?.rip === true} onChange={(v) => onNode({ rip: v })} />
    </>
  )
}

function edgePanel({ data, onEdge }) {
  return (
    <Row label="Thread color">
      {THREAD_COLORS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#e5231b') === c} onClick={() => onEdge({ color: c })} />)}
    </Row>
  )
}

function profilePanel({ data, onNode }) {
  return (
    <>
      <TextField label="Name" value={data?.name} onChange={(v) => onNode({ name: v })} placeholder="Name" />
      <Row label="Avatar color">
        {PROFILE_COLORS.map((c) => <Swatch key={c} color={c} ring active={(data?.color || '#2f6fed') === c} onClick={() => onNode({ color: c })} />)}
        {/* Border-only: an outlined badge with no fill */}
        <button onClick={() => onNode({ color: 'outline' })} title="Border only" aria-pressed={data?.color === 'outline'} style={{
          width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'var(--panel)',
          border: data?.color === 'outline' ? '2px solid var(--text)' : '2px solid var(--muted)',
          boxShadow: data?.color === 'outline' ? '0 0 0 2px var(--panel), 0 0 0 3px var(--accent)' : 'none',
        }} />
      </Row>
    </>
  )
}

function stickerPanel({ data, onNode }) {
  return (
    <Row label="Emoji">
      {STICKER_EMOJIS.map((em) => (
        <button key={em} onClick={() => onNode({ emoji: em })} title={em} aria-pressed={(data?.emoji || '⭐') === em}
          style={{ width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 17, lineHeight: 1, background: (data?.emoji || '⭐') === em ? 'var(--accent)' : 'var(--panel-2)', border: '1px solid var(--border)' }}>{em}</button>
      ))}
    </Row>
  )
}

function containerPanel({ data, onNode, onUngroup }) {
  return (
    <>
      <TextField label="Title" value={data?.title} onChange={(v) => onNode({ title: v })} placeholder="Section" />
      <Row label="Group color">
        {CONTAINER_TINTS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#6b7280') === c} onClick={() => onNode({ color: c })} />)}
      </Row>
      {onUngroup && <Row label="Group"><button onClick={onUngroup} style={segBtn(false)}>Ungroup</button></Row>}
    </>
  )
}

function annotationPanel({ data, onNode }) {
  return (
    <>
      <Row label="Ink color">
        {['#e5231b', '#f5a623', '#22c55e', '#2f6fed', '#a45cff', '#111827'].map((c) => <Swatch key={c} color={c} active={(data?.color || '#e5231b') === c} onClick={() => onNode({ color: c })} />)}
      </Row>
      <Toggle label="Send to back" value={data?.back === true} onChange={(v) => onNode({ back: v })} />
      {/* Lock keeps it from moving - and drops it behind everything so you can
          work on whatever it's circling. */}
      <Toggle label="Lock" value={data?.locked === true} onChange={(v) => onNode(v ? { locked: true, back: true } : { locked: false })} />
    </>
  )
}

function drawingPanel({ onNode }) {
  return (
    <Row label="Sketch">
      <button onClick={() => onNode({ paths: [] })} style={segBtn(false)}>Clear strokes</button>
    </Row>
  )
}

function textPanel({ data, onNode }) {
  return (
    <>
      <Row label="Style">
        {TEXT_STYLES.map((t) => (
          <button key={t.key} onClick={() => onNode({ variant: t.key })} aria-pressed={(data?.variant || 'rip') === t.key} style={segBtn((data?.variant || 'rip') === t.key)}>{t.label}</button>
        ))}
      </Row>
      {data?.variant === 'ink' ? (
        <Row label="Ink color">
          {INK_COLORS.map((c) => <Swatch key={c} color={c} active={(data?.ink || '#111111') === c} onClick={() => onNode({ ink: c })} />)}
        </Row>
      ) : (
        <Row label="Paper color">
          {BRIGHT_TINTS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#f7f2e6') === c} onClick={() => onNode({ color: c })} />)}
        </Row>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
        {data?.variant === 'ink'
          ? 'Bare lettering straight on the board - no paper behind it.'
          : 'A scrap ripped off a notepad. Double-click to write.'}
      </div>
    </>
  )
}

function calloutPanel({ data, onNode }) {
  return (
    <>
      <Row label="Paper color">
        {NOTE_TINTS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#fff3bf') === c} onClick={() => onNode({ color: c })} />)}
      </Row>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Double-click to shout your headline.</div>
    </>
  )
}

function clipPanel({ data, onNode }) {
  return (
    <>
      <Toggle label="Paperclip" value={data?.paperclip !== false} onChange={(v) => onNode({ paperclip: v })} />
      <Row label="Paper color">
        {['#fbfaf6', ...NOTE_TINTS].map((c) => <Swatch key={c} color={c} active={(data?.color || '#fbfaf6') === c} onClick={() => onNode({ color: c })} />)}
      </Row>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Double-click the paper to write.</div>
    </>
  )
}

function stampPanel({ data, onNode }) {
  return (
    <>
      <Row label="Shape">
        {[['rect', 'Slanted'], ['circle', 'Circle']].map(([k, l]) => (
          <button key={k} onClick={() => onNode({ shape: k })} aria-pressed={(data?.shape || 'rect') === k} style={segBtn((data?.shape || 'rect') === k)}>{l}</button>
        ))}
      </Row>
      <Row label="Stamp">
        {STAMP_LABELS.map((l) => (
          <button key={l} onClick={() => onNode({ label: l })} aria-pressed={(data?.label || 'APPROVED') === l} style={segBtn((data?.label || 'APPROVED') === l)}>{l}</button>
        ))}
      </Row>
      <Row label="Ink color">
        {STAMP_COLORS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#d0342c') === c} onClick={() => onNode({ color: c })} />)}
      </Row>
    </>
  )
}

function redactionPanel({ data, onNode }) {
  return (
    <>
      <Row label="Bar color">
        {['#111111', '#ffffff', '#3a2a1a'].map((c) => <Swatch key={c} color={c} active={(data?.color || '#111111') === c} onClick={() => onNode({ color: c })} />)}
      </Row>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Drag a corner to stretch the bar over anything.</div>
    </>
  )
}

function waxPanel({ data, onNode }) {
  return (
    <>
      <TextField label="Emboss (letter or symbol)" value={data?.symbol} onChange={(v) => onNode({ symbol: v })} placeholder="★" maxLength={2} />
      <Row label="Wax color">
        {WAX_COLORS.map((c) => <Swatch key={c} color={c} ring active={(data?.color || '#8b1e3f') === c} onClick={() => onNode({ color: c })} />)}
      </Row>
    </>
  )
}

function filePanel({ data, onNode, pin }) {
  return (
    <>
      <PinControl data={data} onNode={onNode} pin={pin} />
      <TextField label="Label" value={data?.label ?? data?.name ?? ''} onChange={(v) => onNode({ label: v })} placeholder="Exhibit name" maxLength={120} />
      <div style={{ marginTop: 10 }}>
        <button onClick={() => openAttachment(data)} style={{ ...segBtn(false), width: '100%', padding: '8px 15px' }}>Open in new tab</button>
      </div>
      <div style={{ marginTop: 9, fontSize: 12, color: 'var(--muted)', wordBreak: 'break-all' }}>
        {data?.url || `${data?.name || ''}${data?.size ? ` - ${prettySize(data.size)}` : ''}`}
      </div>
    </>
  )
}

function crosshairPanel({ data, onNode }) {
  return (
    <Row label="Reticle color">
      {CROSSHAIR_COLORS.map((c) => <Swatch key={c} color={c} active={(data?.color || '#e5231b') === c} onClick={() => onNode({ color: c })} />)}
    </Row>
  )
}

const PANELS = {
  note: notePanel, image: imagePanel, profile: profilePanel, sticker: stickerPanel,
  container: containerPanel, annotation: annotationPanel, drawing: drawingPanel,
  text: textPanel, callout: calloutPanel, clip: clipPanel, stamp: stampPanel,
  redaction: redactionPanel, wax: waxPanel, file: filePanel, crosshair: crosshairPanel,
}

// An edge is not a node type, so it has no registry entry - it is the one kind
// named here directly.
const panelFor = (kind) => (kind === 'edge' ? edgePanel : PANELS[NODE_REGISTRY[kind]?.inspector] || null)
const titleFor = (kind, data) => {
  if (kind === 'edge') return 'Thread'
  // The exhibit card names itself after what it holds (PDF, Audio, Link...).
  if (kind === 'file') return KIND_LABEL[data?.kind] || 'File'
  return NODE_REGISTRY[kind]?.label || 'Item'
}

// Right-side properties panel for the selected node or edge - matches the toolbar
// chip styling, sized larger for comfortable editing.
export function Inspector({ kind, data, onNode, onEdge, onArrange, onUngroup, width = 264 }) {
  const panel = panelFor(kind)

  return (
    <div className="fx-noexport" style={{
      position: 'absolute', top: 96, right: 42, width, zIndex: 'var(--z-chrome)',
      background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '12px 14px 14px', boxShadow: 'var(--shadow)',
    }}>
      <div className="mono" style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '.02em' }}>{titleFor(kind, data)}</div>

      {kind !== 'edge' && onArrange && (
        <Row label="Arrange">
          <button onClick={() => onArrange('front')} style={segBtn(false)}>To front</button>
          <button onClick={() => onArrange('back')} style={segBtn(false)}>To back</button>
        </Row>
      )}

      {panel && panel({ data, onNode, onEdge, onUngroup, pin: data?.pinColor || '#ff3b30' })}
    </div>
  )
}
