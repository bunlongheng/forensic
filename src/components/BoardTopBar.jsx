import { Icon } from './Icon.jsx'

const SAVE_LABEL = {
  saving: 'Saving…', saved: 'Saved', error: 'Offline · safe on this device', idle: '',
  toolarge: 'Too large to sync - shrink or remove images', unauth: 'Signed out - sign in again to save',
}
const SAVE_ERROR_STATES = new Set(['error', 'toolarge', 'unauth'])

const iconBtn = {
  display: 'grid', placeItems: 'center', width: 27, height: 27, borderRadius: 7,
  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)',
}

const pillBtn = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 999,
  background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)',
  cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
}

// The floating chrome over the canvas: title + save pill on the left, the tool
// cluster on the right. `toolbarRef` is measured by the Board so the inspector
// lines up with the toolbar's width.
export function BoardTopBar({
  canEdit, title, onTitle, save, zoomPct, onBack, toolbarRef,
  undo, redo, canUndo, canRedo, onFit, onExport, onShare, onReport,
  onAddImage, onAddSticker, onToggleTheme, themeName,
}) {
  const saveLabel = SAVE_LABEL[save]
  const dim = (on) => ({ ...iconBtn, opacity: on ? 1 : 0.35, cursor: on ? 'pointer' : 'default' })
  return (
    <div className="fx-noexport fx-topbar" style={{ position: 'absolute', top: 42, left: 42, right: 42, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 8px', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto' }}>
        <button onClick={onBack} title="Back to boards" style={iconBtn}><Icon name="back" size={16} /></button>
        {canEdit ? (
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            aria-label="Board title"
            className="mono fx-mobile-hide"
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, width: Math.min(320, Math.max(120, title.length * 9 + 20)), color: 'var(--text)' }}
          />
        ) : (
          <span className="mono fx-mobile-hide" style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        )}
        {saveLabel && (
          <span className="fx-mobile-hide" style={{ fontSize: 11, color: SAVE_ERROR_STATES.has(save) ? 'var(--accent)' : 'var(--muted)', marginLeft: 2 }}>· {saveLabel}</span>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <div ref={toolbarRef} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 6px', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto' }}>
        <span className="mono fx-mobile-hide" style={{ fontSize: 10.5, color: 'var(--muted)', padding: '0 5px', minWidth: 40, textAlign: 'center' }}>{zoomPct}%</span>
        {canEdit && <button onClick={undo} disabled={!canUndo} title="Undo (Cmd/Ctrl+Z)" style={dim(canUndo)}><Icon name="undo" size={16} /></button>}
        {canEdit && <button onClick={redo} disabled={!canRedo} title="Redo (Cmd/Ctrl+Shift+Z)" style={dim(canRedo)}><Icon name="redo" size={16} /></button>}
        <button onClick={onFit} title="Fit to view" style={iconBtn}><Icon name="fit" size={16} /></button>
        <button onClick={onExport} title="Export PNG" style={iconBtn}><Icon name="download" size={16} /></button>
        {onShare && <button onClick={onShare} title="Copy share link" style={iconBtn}><Icon name="share" size={16} /></button>}
        {canEdit && <button onClick={onReport} title="Case report" style={iconBtn}><Icon name="report" size={16} /></button>}
        {canEdit && <button onClick={onAddImage} title="Add image" style={iconBtn}><Icon name="image" size={16} /></button>}
        {canEdit && <button onClick={onAddSticker} title="Add sticker" style={iconBtn}><Icon name="sticker" size={16} /></button>}
        <button onClick={onToggleTheme} title="Toggle theme" style={iconBtn}><Icon name={themeName === 'dark' ? 'sun' : 'moon'} size={16} /></button>
      </div>
    </div>
  )
}

// Floating actions when several nodes are multi-selected.
export function MultiSelectBar({ count, onChain, onFan, onGroup }) {
  return (
    <div className="fx-noexport" style={{
      position: 'absolute', top: 96, left: '50%', transform: 'translateX(-50%)', zIndex: 11,
      display: 'flex', alignItems: 'center', gap: 6, padding: 5, borderRadius: 999,
      background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
    }}>
      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '0 6px' }}>{count} selected</span>
      <button onClick={onChain} style={pillBtn} title="Thread them into one path">Chain</button>
      <button onClick={onFan} style={pillBtn} title="Thread the biggest asset out to the rest">Fan</button>
      <button onClick={onGroup} style={{ ...pillBtn, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' }}><Icon name="group" size={14} /> Group</button>
    </div>
  )
}
