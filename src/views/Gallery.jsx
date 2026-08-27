import { useState } from 'react'
import BoardCard from '../components/BoardCard.jsx'
import { GalleryHeader } from '../components/GalleryHeader.jsx'

// The signed-in owner's home: every saved board as a live snapshot, plus create /
// search / sign-out. New boards open straight into the canvas.
export default function Gallery({ boards, accent, themeName, onToggleTheme, onOpen, onCreate, onDelete, onSignOut, onOpenTrash, trashCount = 0, creating }) {
  const [q, setQ] = useState('')
  const filtered = boards.filter((b) => !q.trim() || (b.title || '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <GalleryHeader
        themeName={themeName} onToggleTheme={onToggleTheme} onCreate={onCreate} onSignOut={onSignOut}
        onTrash={onOpenTrash} trashCount={trashCount} trashActive={false} onHome={() => {}}
        q={q} setQ={setQ} creating={creating}
      />

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
