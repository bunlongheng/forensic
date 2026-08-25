import { useState } from 'react'
import BoardCard from '../components/BoardCard.jsx'
import { Icon } from '../components/Icon.jsx'

// The signed-in owner's home: every saved board as a live snapshot, plus create /
// search / sign-out. New boards open straight into the canvas.
export default function Gallery({ boards, accent, themeName, onToggleTheme, onOpen, onCreate, onDelete, onSignOut, creating }) {
  const [q, setQ] = useState('')
  const filtered = boards.filter((b) => !q.trim() || (b.title || '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/icon.png" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
          <div style={{ marginRight: 'auto' }}>
            <div className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.14em' }}>FORENSIC</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Wire the evidence together</div>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 10, color: 'var(--muted)', pointerEvents: 'none', display: 'grid' }}><Icon name="search" size={15} /></span>
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search boards"
              style={{ padding: '9px 12px 9px 32px', width: 200, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none' }}
            />
          </div>
          <button onClick={onCreate} disabled={creating} title="New board"
            style={{ ...ghost, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', cursor: creating ? 'wait' : 'pointer' }}>
            <Icon name="plus" size={20} />
          </button>
          <button onClick={onToggleTheme} title="Toggle theme" style={ghost}><Icon name={themeName === 'dark' ? 'sun' : 'moon'} /></button>
          <button onClick={onSignOut} title="Sign out" style={ghost}><Icon name="logout" /></button>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Your boards</h1>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{boards.length} total</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
          {filtered.map((b) => (
            <BoardCard key={b.id} board={b} accent={accent} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </div>

        {boards.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 22 }}>No boards yet - start a new one and drop your first piece of evidence.</p>
        )}
      </main>
    </div>
  )
}

const ghost = {
  display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10,
  background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer',
}
