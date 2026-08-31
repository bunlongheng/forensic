import { useState, useEffect, useCallback } from 'react'
import { useTheme } from './theme.js'
import { listBoards, getBoard, createBoard, deleteBoard as apiDelete, listTrash, restoreBoard, purgeBoard } from './lib/api.js'
import SignInScreen from './components/SignInScreen.jsx'
import { Toast } from './components/Toast.jsx'
import Gallery from './views/Gallery.jsx'
import Trash from './views/Trash.jsx'
import Board from './views/Board.jsx'

// Normalize an API row into the single board shape the whole UI speaks.
const normalize = (r) => ({
  id: r.id, title: r.title || 'Untitled Board',
  nodes: r.nodes || [], edges: r.edges || [], updatedAt: r.updated_at || r.created_at,
})

function setUrlId(id) {
  const u = new URL(window.location.href)
  if (id) u.searchParams.set('id', id)
  else u.searchParams.delete('id')
  window.history.replaceState({}, '', u)
}

// Touch devices (iPhone, iPad - incl. iPadOS reporting as Mac - and any coarse-
// pointer phone/tablet) are READ-ONLY on the board canvas: you only ever pan and
// zoom to read there, so selecting, dragging and editing nodes are all disabled to
// stop accidental changes. Desktop (fine pointer) stays fully editable.
const isTouchDevice = (() => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const coarse = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
  return iOS || coarse
})()

export default function App() {
  // theme is 'light'|'dark' (also React Flow's colorMode); t is the resolved palette.
  const { theme: themeMode, toggle, t } = useTheme()

  const [view, setView] = useState('gallery') // 'gallery' | 'board' | 'trash'
  const [boards, setBoards] = useState([])
  const [trash, setTrash] = useState([])
  const [active, setActive] = useState(null)
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [devBypass, setDevBypass] = useState(false)
  const [creating, setCreating] = useState(false)
  // Start in the loading state if the URL already targets a board, so we never
  // synchronously flip it inside an effect.
  const [loadingId, setLoadingId] = useState(() => Boolean(new URLSearchParams(window.location.search).get('id')))
  const [loadError, setLoadError] = useState(false)
  const [toast, setToast] = useState({ message: '', visible: false })

  const showToast = useCallback((message) => {
    setToast({ message, visible: true })
    setTimeout(() => setToast((x) => ({ ...x, visible: false })), 2400)
  }, [])

  const loadBoards = useCallback(() => {
    listBoards().then((rows) => setBoards(rows.map(normalize))).catch(() => setBoards([]))
    listTrash().then((rows) => setTrash(rows.map(normalize))).catch(() => {}) // keeps the Trash badge count fresh
  }, [])

  // Auth check + one-time OAuth redirect feedback. Toasts are deferred to a
  // microtask so no setState runs synchronously inside the effect body.
  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => { if (d.authenticated) setUser(d) }).catch(() => {}).finally(() => setAuthChecked(true))
    const p = new URLSearchParams(window.location.search).get('auth')
    if (p) {
      queueMicrotask(() => {
        if (p === 'denied') showToast('That Google account is not authorized')
        else if (p === 'error') showToast('Sign-in failed, try again')
      })
      const u = new URL(window.location.href); u.searchParams.delete('auth'); window.history.replaceState({}, '', u)
    }
  }, [showToast])

  useEffect(() => { if (user || devBypass) loadBoards() }, [user, devBypass, loadBoards])

  // Deep link: ?id=<board> loads a single board (public read). loadingId already
  // starts true when ?id is present, so the effect only resolves it.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    getBoard(id).then((r) => { setActive(normalize(r)); setView('board'); setLoadingId(false) })
      .catch(() => { setLoadError(true); setLoadingId(false) })
  }, [])

  function openBoard(b) { setActive(b); setView('board'); setUrlId(b.id) }

  async function createNew() {
    setCreating(true)
    try {
      const row = await createBoard({ title: 'Untitled Board' })
      const b = normalize(row)
      setBoards((bs) => [b, ...bs])
      openBoard(b)
      import('canvas-confetti').then((m) => m.default({ particleCount: 90, spread: 70, origin: { y: 0.35 }, colors: ['#ff4438', '#f4f1ea'], zIndex: 9999 })).catch(() => {})
    } catch { showToast('Could not create board') }
    finally { setCreating(false) }
  }

  // Delete: a board with real work (3+ nodes) goes to Trash first (recoverable);
  // a small/scratch board is removed for good so Trash never fills with junk.
  function removeBoard(b) {
    const n = (b.nodes || []).length
    const msg = n >= 3
      ? `Move "${b.title}" to Trash? You can restore it later.`
      : `Delete "${b.title}"? It has ${n} item${n === 1 ? '' : 's'}, so it won't go to Trash.`
    if (!window.confirm(msg)) return
    apiDelete(b.id).then((r) => {
      setBoards((bs) => bs.filter((x) => x.id !== b.id))
      showToast(r?.trashed ? 'Moved to Trash' : 'Board deleted')
    }).catch(() => showToast('Delete failed'))
  }

  const loadTrash = useCallback(() => {
    listTrash().then((rows) => setTrash(rows.map(normalize))).catch(() => setTrash([]))
  }, [])
  function openTrash() { loadTrash(); setView('trash') }
  function restoreOne(b) {
    restoreBoard(b.id).then(() => { setTrash((t) => t.filter((x) => x.id !== b.id)); showToast('Restored'); loadBoards() })
      .catch(() => showToast('Restore failed'))
  }
  function purgeOne(b) {
    if (!window.confirm(`Permanently delete "${b.title}"? This cannot be undone.`)) return
    purgeBoard(b.id).then(() => { setTrash((t) => t.filter((x) => x.id !== b.id)); showToast('Deleted forever') })
      .catch(() => showToast('Delete failed'))
  }

  function backToGallery() {
    setActive(null); setLoadError(false); setUrlId(null); setView('gallery'); loadBoards()
  }

  function signOut() {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => { setUser(null); setBoards([]); showToast('Signed out') }).catch(() => showToast('Sign out failed'))
  }

  const hasIdParam = Boolean(new URLSearchParams(window.location.search).get('id'))

  // ── Deep-link loading / error ───────────────────────────────────────────────
  if (loadingId) return <Splash label="Loading board…" />
  if (loadError) return <Splash label="Board not found" sub="It may have been deleted or the link is invalid." action={backToGallery} />

  // ── Board view (public for shared links; editable for the signed-in owner) ──
  if (view === 'board' && active) {
    if (!authChecked) return <Splash label="Loading board…" />
    const canEdit = (Boolean(user) || devBypass) && !isTouchDevice
    return (
      <>
        <Board key={active.id} board={active} canEdit={canEdit} theme={t} themeName={themeMode}
          onToggleTheme={toggle} onBack={backToGallery} showToast={showToast} />
        <Toast {...toast} />
      </>
    )
  }

  // ── Sign-in gate (gallery only; shared boards above stay public) ────────────
  if (!hasIdParam && !devBypass) {
    if (!authChecked) return <SignInScreen loading />
    if (!user) return <SignInScreen devBypass={() => setDevBypass(true)} />
  }

  // ── Trash ───────────────────────────────────────────────────────────────────
  if (view === 'trash') {
    return (
      <>
        <Trash boards={trash} accent={t.accent} themeName={themeMode} onToggleTheme={toggle}
          onCreate={createNew} onSignOut={signOut} creating={creating}
          onBack={() => { setView('gallery'); loadBoards() }}
          onRestore={restoreOne} onPurge={purgeOne} />
        <Toast {...toast} />
      </>
    )
  }

  // ── Gallery ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Gallery
        boards={boards} accent={t.accent} themeName={themeMode} onToggleTheme={toggle}
        onOpen={openBoard} onCreate={createNew} onDelete={removeBoard} onSignOut={signOut}
        onOpenTrash={openTrash} trashCount={trash.length} creating={creating}
      />
      <Toast {...toast} />
    </>
  )
}

function Splash({ label, sub, action }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      {!action && <div style={{ width: 38, height: 38, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'fx-spin .8s linear infinite' }} />}
      <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{sub}</div>}
      {action && <button onClick={action} style={{ marginTop: 6, padding: '10px 20px', background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Back to boards</button>}
    </div>
  )
}
