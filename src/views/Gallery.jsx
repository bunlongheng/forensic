import { useState } from 'react'
import BoardCard from '../components/BoardCard.jsx'
import { GalleryHeader } from '../components/GalleryHeader.jsx'

// The signed-in owner's home: every saved board as a live snapshot, plus create /
// search / sign-out. New boards open straight into the canvas.
export default function Gallery({ boards, accent, themeName, onToggleTheme, onOpen, onCreate, onDelete, onSignOut, onOpenTrash, trashCount = 0, creating, loading = false, error = '', onRetry , narrow = false }) {
  const [q, setQ] = useState('')
  const filtered = boards.filter((b) => !q.trim() || (b.title || '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <GalleryHeader
        themeName={themeName} onToggleTheme={onToggleTheme} onCreate={onCreate} onSignOut={onSignOut}
        onTrash={onOpenTrash} trashCount={trashCount} trashActive={false} onHome={() => {}}
        q={q} setQ={setQ} creating={creating} narrow={narrow}
      />

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Your boards</h1>
          {!loading && !error && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{boards.length} total</span>}
        </div>

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="fx-skeleton" style={{ height: 195, borderRadius: 14 }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 14 }}>{error}</p>
            <button onClick={onRetry} style={{ padding: '9px 20px', background: 'var(--accent-fill)', color: 'var(--accent-ink)', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Retry</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
              {filtered.map((b) => (
                <BoardCard key={b.id} board={b} accent={accent} onOpen={onOpen} onDelete={onDelete} />
              ))}
            </div>

            {boards.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 22 }}>No boards yet - start a new one and drop your first piece of evidence.</p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
