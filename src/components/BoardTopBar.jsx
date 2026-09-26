import { useStore } from '@xyflow/react'
import { Icon } from './Icon.jsx'

const SAVE_LABEL = {
  saving: 'Saving…', saved: 'Saved', error: 'Offline · safe on this device', idle: '',
  toolarge: 'Too large to sync - shrink or remove images', unauth: 'Signed out - sign in again to save',
  failed: 'Save failed - will retry on the next change',
}
const SAVE_ERROR_STATES = new Set(['error', 'toolarge', 'unauth', 'failed'])

const iconBtn = {
  display: 'grid', placeItems: 'center', width: 27, height: 27, borderRadius: 7,
  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)',
}

const pillBtn = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 999,
  background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)',
  cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
}

// Live zoom %, read straight from the React Flow store. Kept as its own component
// on purpose: the viewport changes on EVERY frame of a pan/zoom, and holding that
// number in Board state re-rendered the whole board (canvas, toolbar, inspector,
// add-menu) 60x a second. Only this <span> re-renders now.
const selectZoomPct = (s) => Math.round(s.transform[2] * 100)

function ZoomPct() {
  const pct = useStore(selectZoomPct)
  return <span className="mono fx-mobile-hide" style={{ fontSize: 10.5, color: 'var(--muted)', padding: '0 5px', minWidth: 40, textAlign: 'center' }}>{pct}%</span>
}

// The floating chrome over the canvas: title + save pill on the left, the tool
// cluster on the right. `toolbarRef` is measured by the Board so the inspector
// lines up with the toolbar's width.
export function BoardTopBar({
  canEdit, readOnly, title, onTitle, save, onBack, toolbarRef,
  undo, redo, canUndo, canRedo, onFit, onExport, onShare, onReport,
  onAddTool, onAddImage, onAddSticker, onToggleTheme, themeName,
}) {
  const saveLabel = SAVE_LABEL[save]
  const dim = (on) => ({ ...iconBtn, opacity: on ? 1 : 0.35, cursor: on ? 'pointer' : 'default' })
  return (
    <div className="fx-noexport fx-topbar" style={{ position: 'absolute', top: 42, left: 42, right: 42, zIndex: 'var(--z-chrome)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 8px', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto' }}>
        <button onClick={onBack} title="Back to boards" style={iconBtn}><Icon name="back" size={16} /></button>
        {canEdit ? (
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            aria-label="Board title"
            maxLength={200}
            className="mono fx-mobile-hide"
            style={{
              background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text)',
              flex: `0 1 ${Math.min(320, Math.max(120, title.length * 9 + 20))}px`, minWidth: 40, maxWidth: '100%',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          />
        ) : (
          <span className="mono fx-mobile-hide" style={{ fontSize: 13, fontWeight: 700, minWidth: 0, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        )}
        {saveLabel && (
          save === 'unauth' ? (
            <a href="/api/auth/login" className="mono fx-mobile-hide" style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 2, flexShrink: 0, textDecoration: 'underline' }}>· {saveLabel}</a>
          ) : (
            <span className="fx-mobile-hide" style={{ fontSize: 11, color: SAVE_ERROR_STATES.has(save) ? 'var(--accent)' : 'var(--muted)', marginLeft: 2, flexShrink: 0 }}>· {saveLabel}</span>
          )
        )}
      </div>
      {/* A read-only board is otherwise indistinguishable from an editable one -
          the session just expired, or you are on a phone - and every edit dies
          silently. Say which, and offer the way back in. */}
      {readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 10px', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto' }}>
          <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--muted)' }}>READ-ONLY</span>
          {readOnly === 'auth'
            ? <a href="/api/auth/login" className="mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--accent)' }}>SIGN IN TO EDIT</a>
            : <span className="mono fx-mobile-hide" style={{ fontSize: 10.5, color: 'var(--muted)' }}>desktop only</span>}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div ref={toolbarRef} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 6px', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto' }}>
        {canEdit && (
          <button
            onClick={onAddTool} title="Add to board"
            style={{ ...iconBtn, width: 27, height: 27, background: 'var(--accent)', color: 'var(--accent-ink)', marginRight: 3 }}
          ><Icon name="plus" size={17} /></button>
        )}
        <ZoomPct />
        {canEdit && <button onClick={undo} disabled={!canUndo} title="Undo (Cmd/Ctrl+Z)" style={dim(canUndo)}><Icon name="undo" size={16} /></button>}
        {canEdit && <button onClick={redo} disabled={!canRedo} title="Redo (Cmd/Ctrl+Shift+Z)" style={dim(canRedo)}><Icon name="redo" size={16} /></button>}
        <button onClick={onFit} title="Fit to view" style={iconBtn}><Icon name="fit" size={16} /></button>
        <button onClick={onExport} title="Export PNG" style={iconBtn}><Icon name="download" size={16} /></button>
        {onShare && <button onClick={onShare} title="Copy share link" style={iconBtn}><Icon name="share" size={16} /></button>}
        <button onClick={onReport} title="Case report" style={iconBtn}><Icon name="report" size={16} /></button>
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
      position: 'absolute', top: 96, left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--z-chrome)',
      display: 'flex', alignItems: 'center', gap: 6, padding: 5, borderRadius: 999,
      background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
    }}>
      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '0 6px' }}>{count} selected</span>
      <button onClick={onChain} style={pillBtn} title="Thread them into one path">Chain</button>
      <button onClick={onFan} style={pillBtn} title="Thread the biggest asset out to the rest">Fan</button>
      <button onClick={onGroup} style={{ ...pillBtn, background: 'var(--accent-fill)', color: 'var(--accent-ink)', border: 'none' }}><Icon name="group" size={14} /> Group</button>
    </div>
  )
}
