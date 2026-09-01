import { Icon } from './Icon.jsx'

// The one top menu shared by the boards gallery and the Trash view, so both read
// identically. The trash button doubles as the toggle: it shows a red count
// badge on the gallery, and lights up (active) while you're inside Trash.
const ghost = {
  display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10,
  background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer',
}

export function GalleryHeader({ themeName, onToggleTheme, onCreate, onSignOut, onTrash, trashCount = 0, trashActive, onHome, q, setQ, creating }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'calc(14px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) 14px calc(20px + env(safe-area-inset-left))', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onHome} title="Your boards" style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text)', marginRight: 'auto' }}>
          <img src="/icon.png" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
          <span style={{ textAlign: 'left' }}>
            <span className="mono" style={{ display: 'block', fontSize: 18, fontWeight: 700, letterSpacing: '.14em' }}>FORENSIC</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Wire the evidence together</span>
          </span>
        </button>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 10, color: 'var(--muted)', pointerEvents: 'none', display: 'grid' }}><Icon name="search" size={15} /></span>
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder={trashActive ? 'Search trash' : 'Search boards'}
            style={{ padding: '9px 12px 9px 32px', width: 200, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none' }}
          />
        </div>
        <button onClick={onCreate} disabled={creating} title="New board"
          style={{ ...ghost, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', cursor: creating ? 'wait' : 'pointer' }}>
          <Icon name="plus" size={20} />
        </button>
        <button onClick={onTrash} title={trashActive ? 'Back to boards' : 'Trash'}
          style={{ ...ghost, position: 'relative', ...(trashActive ? { background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' } : {}) }}>
          <Icon name="trash" />
          {!trashActive && trashCount > 0 && (
            <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: '#e5231b', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'grid', placeItems: 'center', border: '2px solid var(--bg)', lineHeight: 1 }}>{trashCount > 9 ? '9+' : trashCount}</span>
          )}
        </button>
        <button onClick={onToggleTheme} title="Toggle theme" style={ghost}><Icon name={themeName === 'dark' ? 'sun' : 'moon'} /></button>
        <button onClick={onSignOut} title="Sign out" style={ghost}><Icon name="logout" /></button>
      </div>
    </header>
  )
}
