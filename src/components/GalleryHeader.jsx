import { useState } from 'react'
import { Icon } from './Icon.jsx'

// The one top menu shared by the boards gallery and the Trash view, so both read
// identically. The trash button doubles as the toggle: it shows a red count
// badge on the gallery, and lights up (active) while you're inside Trash.
const ghost = {
  display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10,
  background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer',
}

export function GalleryHeader({ themeName, onToggleTheme, onCreate, onSignOut, onTrash, trashCount = 0, trashActive, onHome, q, setQ, creating, narrow = false }) {
  // Phones get a search ICON that expands into the full row on tap - a permanent
  // input ate more width than the brand and pushed the buttons off-screen.
  const [searchOpen, setSearchOpen] = useState(false)
  // "New board" is deliberately hidden: Cmd/Ctrl+click the brand to reveal it.
  const [showAdd, setShowAdd] = useState(false)
  const searching = narrow && searchOpen

  const closeSearch = () => { setSearchOpen(false); setQ('') }
  const onBrand = (e) => {
    if (e.metaKey || e.ctrlKey) { e.preventDefault(); setShowAdd((v) => !v); return }
    onHome()
  }

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'calc(14px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) 14px calc(20px + env(safe-area-inset-left))', display: 'flex', alignItems: 'center', gap: narrow ? 8 : 14 }}>
        {!searching && (
          <button onClick={onBrand} title="Your boards" style={{ display: 'flex', alignItems: 'center', gap: narrow ? 10 : 14, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text)', marginRight: 'auto', minWidth: 0, overflow: 'hidden' }}>
            <img src="/icon-192.png" alt="" width={narrow ? 40 : 34} height={narrow ? 40 : 34} style={{ borderRadius: 9, flexShrink: 0 }} />
            <span style={{ textAlign: 'left', minWidth: 0, overflow: 'hidden' }}>
              <span className="mono" style={{ display: 'block', fontSize: 18, fontWeight: 700, letterSpacing: '.14em', whiteSpace: 'nowrap' }}>FORENSIC</span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Wire the evidence</span>
            </span>
          </button>
        )}

        {narrow && !searchOpen ? (
          <button onClick={() => setSearchOpen(true)} title="Search" style={ghost}><Icon name="search" size={17} /></button>
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', ...(searching ? { flex: 1 } : {}) }}>
            <span style={{ position: 'absolute', left: 10, color: 'var(--muted)', pointerEvents: 'none', display: 'grid' }}><Icon name="search" size={15} /></span>
            <input
              autoFocus={searching}
              value={q} onChange={(e) => setQ(e.target.value)} placeholder={trashActive ? 'Search trash' : 'Search boards'}
              style={{ padding: '9px 12px 9px 32px', width: searching ? '100%' : 200, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16, outline: 'none' }}
            />
          </div>
        )}

        {searching ? (
          <button onClick={closeSearch} title="Close search" style={ghost}><Icon name="back" size={17} /></button>
        ) : (
          <>
            {showAdd && (
              <button onClick={onCreate} disabled={creating} title="New board"
                style={{ ...ghost, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', cursor: creating ? 'wait' : 'pointer' }}>
                <Icon name="plus" size={20} />
              </button>
            )}
            <button onClick={onTrash} title={trashActive ? 'Back to boards' : 'Trash'}
              style={{ ...ghost, position: 'relative', ...(trashActive ? { background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' } : {}) }}>
              <Icon name="trash" />
              {!trashActive && trashCount > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: '#e5231b', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'grid', placeItems: 'center', border: '2px solid var(--bg)', lineHeight: 1 }}>{trashCount > 9 ? '9+' : trashCount}</span>
              )}
            </button>
            <button onClick={onToggleTheme} title="Toggle theme" style={ghost}><Icon name={themeName === 'dark' ? 'sun' : 'moon'} /></button>
            <button onClick={onSignOut} title="Sign out" style={ghost}><Icon name="logout" /></button>
          </>
        )}
      </div>
    </header>
  )
}
