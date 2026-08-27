import { useState } from 'react'
import BoardCard from '../components/BoardCard.jsx'
import { GalleryHeader } from '../components/GalleryHeader.jsx'

// Trash: boards that were soft-deleted (3+ nodes go here instead of being
// destroyed). Same top menu as the gallery - the trash button is lit and takes
// you back. Each card can be restored to the gallery or deleted forever.
export default function Trash({ boards, accent, themeName, onToggleTheme, onCreate, onSignOut, onBack, onRestore, onPurge, creating }) {
  const [q, setQ] = useState('')
  const filtered = boards.filter((b) => !q.trim() || (b.title || '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <GalleryHeader
        themeName={themeName} onToggleTheme={onToggleTheme} onCreate={onCreate} onSignOut={onSignOut}
        onTrash={onBack} trashActive onHome={onBack} q={q} setQ={setQ} creating={creating}
      />

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Trash</h1>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{boards.length} item{boards.length === 1 ? '' : 's'}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
          Deleted boards with 3+ items land here so nothing is lost by accident. Bring one back, or remove it for good.
        </p>

        {boards.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Trash is empty.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
            {filtered.map((b) => (
              <div key={b.id} style={{ position: 'relative' }}>
                <div style={{ opacity: 0.85, pointerEvents: 'none' }}>
                  <BoardCard board={b} accent={accent} onOpen={() => {}} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => onRestore(b)} style={action(false)}>Restore</button>
                  <button onClick={() => onPurge(b)} style={action(true)}>Delete forever</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

const action = (danger) => ({
  flex: 1, padding: '8px 10px', fontSize: 12.5, fontWeight: 600, borderRadius: 9, cursor: 'pointer',
  background: danger ? 'transparent' : 'var(--accent)',
  color: danger ? 'var(--accent)' : 'var(--accent-ink)',
  border: `1px solid ${danger ? 'var(--border)' : 'transparent'}`,
})
