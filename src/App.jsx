import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useTheme, PHONE_MAX } from './theme.js'
import { listBoards, getBoard, createBoard, deleteBoard as apiDelete, listTrash, restoreBoard, purgeBoard } from './lib/api.js'
import SignInScreen from './components/SignInScreen.jsx'
import { Toast } from './components/Toast.jsx'
import Gallery from './views/Gallery.jsx'
import Trash from './views/Trash.jsx'
// The canvas (React Flow + every node type) is by far the heaviest chunk - load it
// only when a board is actually opened, so sign-in and the gallery stay light.
const Board = lazy(() => import('./views/Board.jsx'))

// Normalize an API row into the single board shape the whole UI speaks.
// node_count/edge_count ride along verbatim: a thumbnailed list row sends
// `nodes: null` and carries its sizes in those two fields instead of two whole
// graphs per card, so dropping them is how every card came to read "0 nodes".
const normalize = (r) => ({
  id: r.id, title: r.title || 'Untitled Board',
  nodes: r.nodes || [], edges: r.edges || [], thumbnail: r.thumbnail || null,
  node_count: r.node_count, edge_count: r.edge_count,
  updatedAt: r.updated_at || r.created_at,
})

function setUrlId(id) {
  const u = new URL(window.location.href)
  if (id) u.searchParams.set('id', id)
  else u.searchParams.delete('id')
  window.history.replaceState({}, '', u)
}

// Phones and tablets (iPhone, iPad - incl. iPadOS reporting as Mac - and Android)
// are READ-ONLY: you only ever pan/zoom to read there, so all editing is disabled
// and the edit UI hidden. Keyed on the actual mobile OS, not a touch laptop.
const isTouchDevice = (() => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/i.test(ua)
  // "Request Desktop Site" spoofs a Mac UA, so also treat any real touchscreen on a
  // small screen as a phone/tablet (a big touch laptop stays editable).
  const touchSmall = (navigator.maxTouchPoints || 0) > 0 &&
    typeof window !== 'undefined' && Math.min(window.screen.width, window.screen.height) <= PHONE_MAX
  return iOS || android || touchSmall
})()


export default function App() {
  // theme is 'light'|'dark' (also React Flow's colorMode); t is the resolved palette.
  const { theme: themeMode, toggle, t } = useTheme()

  const [view, setView] = useState('gallery') // 'gallery' | 'board' | 'trash'
  const [boards, setBoards] = useState(null) // null = loading, else the array
  const [boardsError, setBoardsError] = useState('')
  const [trash, setTrash] = useState([]) // null while the Trash view is loading
  const [trashError, setTrashError] = useState('')
  const [active, setActive] = useState(null)
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  // Read-only whenever the VIEW is phone-sized (not just by device), so a narrow
  // window / mobile screen shows the lean view-only UI. Reacts live to resizing.
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= PHONE_MAX : false))
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= PHONE_MAX)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // On localhost the Google auth backend isn't wired up, so /api/auth/me is always
  // "not authenticated" - which used to leave you read-only (no +, no editing) after
  // every reload, especially when opening a board via ?id (the sign-in screen, where
  // you'd re-enable the bypass, is skipped). Treat localhost as always-editable dev
  // mode. Production (a real hostname) still requires signing in.
  const [devBypass, setDevBypass] = useState(
    () => ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname),
  )
  const [creating, setCreating] = useState(false)
  // Start in the loading state if the URL already targets a board, so we never
  // synchronously flip it inside an effect.
  const [loadingId, setLoadingId] = useState(() => Boolean(new URLSearchParams(window.location.search).get('id')))
  const [loadError, setLoadError] = useState(false)
  const [toast, setToast] = useState({ message: '', visible: false })
  // Persistent (not a toast) feedback for the sign-in screen: a denied/failed OAuth
  // redirect, and whether the /api/auth/me probe itself failed (network or 5xx) so
  // that case can be told apart from a genuine, quiet signed-out state.
  const [authMessage, setAuthMessage] = useState('')
  const [authProbeError, setAuthProbeError] = useState(false)

  const toastTimer = useRef(null)
  const showToast = useCallback((message) => {
    setToast({ message, visible: true })
    clearTimeout(toastTimer.current) // a second toast gets its full 2.4s, not the remainder of the first
    toastTimer.current = setTimeout(() => setToast((x) => ({ ...x, visible: false })), 2400)
  }, [])

  // Load the gallery. `background` is the stale-while-revalidate path taken on
  // every RETURN to the gallery: the boards already on screen stay there while
  // the new list loads and are swapped when it lands, so coming back from a
  // board no longer blanks the grid into a skeleton. Only a first load (boards
  // === null) shows it. The Trash list is fetched for its badge on the first
  // load and whenever the Trash view is opened - not on every bounce back.
  const loadBoards = useCallback((background = false) => {
    // Deferred so a loadBoards() call from inside an effect (initial mount) never
    // sets state synchronously within that effect's body.
    queueMicrotask(() => { if (!background) setBoards(null); setBoardsError('') })
    listBoards().then((rows) => setBoards(rows.map(normalize)))
      .catch(() => { setBoards((bs) => bs ?? []); setBoardsError('Could not load boards'); showToast('Could not load boards') })
    if (!background) listTrash().then((rows) => setTrash(rows.map(normalize))).catch(() => {}) // keeps the Trash badge count fresh
  }, [showToast])

  // Auth check + one-time OAuth redirect feedback. A non-2xx or a network failure
  // means the probe itself is broken, not that the owner is really signed out - so
  // it gets its own flag instead of silently falling through to the sign-in screen.
  const checkAuth = useCallback(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => { setAuthProbeError(false); if (d.authenticated) setUser(d) })
      .catch(() => setAuthProbeError(true))
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    checkAuth()
    const p = new URLSearchParams(window.location.search).get('auth')
    if (p) {
      // Deferred to a microtask so no setState runs synchronously inside the effect body.
      queueMicrotask(() => {
        if (p === 'denied') setAuthMessage('That Google account is not authorized')
        else if (p === 'error') setAuthMessage('Sign-in failed, try again')
      })
      const u = new URL(window.location.href); u.searchParams.delete('auth'); window.history.replaceState({}, '', u)
    }
  }, [checkAuth])

  useEffect(() => { if (user || devBypass) loadBoards() }, [user, devBypass, loadBoards])

  // Deep link: ?id=<board> loads a single board (public read). loadingId already
  // starts true when ?id is present, so the effect only resolves it.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    getBoard(id).then((r) => { setActive(normalize(r)); setView('board'); setLoadingId(false) })
      .catch(() => { setLoadError(true); setLoadingId(false) })
  }, [])

  // Gallery rows are a preview projection (no image bytes), so opening a board
  // always fetches the full row first.
  function openBoard(b) {
    setLoadingId(true); setUrlId(b.id)
    getBoard(b.id).then((r) => { setActive(normalize(r)); setView('board'); setLoadingId(false) })
      .catch(() => { setLoadError(true); setLoadingId(false) })
  }

  async function createNew() {
    setCreating(true)
    try {
      const row = await createBoard({ title: 'Untitled Board' })
      const b = normalize(row)
      setBoards((bs) => [b, ...(bs || [])])
      openBoard(b)
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (!reducedMotion) {
        import('canvas-confetti').then((m) => m.default({ particleCount: 90, spread: 70, origin: { y: 0.35 }, colors: ['#ff4438', '#f4f1ea'], zIndex: 9999 })).catch(() => {})
      }
    } catch { showToast('Could not create board') }
    finally { setCreating(false) }
  }

  // Delete: a board with real work (3+ nodes) goes to Trash first (recoverable);
  // a small/scratch board is removed for good so Trash never fills with junk.
  function removeBoard(b) {
    // A thumbnailed list row has no nodes array - its size rides in node_count.
    const n = b.node_count ?? b.nodes?.length ?? 0
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
    setTrash(null); setTrashError('')
    listTrash().then((rows) => setTrash(rows.map(normalize)))
      .catch(() => { setTrash([]); setTrashError('Could not load the trash'); showToast('Could not load the trash') })
  }, [showToast])
  function openTrash() { loadTrash(); setView('trash') }
  function restoreOne(b) {
    restoreBoard(b.id).then(() => { setTrash((t) => (t || []).filter((x) => x.id !== b.id)); showToast('Restored'); loadBoards(true) })
      .catch(() => showToast('Restore failed'))
  }
  function purgeOne(b) {
    if (!window.confirm(`Permanently delete "${b.title}"? This cannot be undone.`)) return
    purgeBoard(b.id).then(() => { setTrash((t) => (t || []).filter((x) => x.id !== b.id)); showToast('Deleted forever') })
      .catch(() => showToast('Delete failed'))
  }

  // Empty the whole trash. Purges are per-board on the API, so fire them together
  // and report honestly: a partial failure leaves the survivors on screen rather
  // than pretending everything went.
  const [emptying, setEmptying] = useState(false)
  function emptyTrash() {
    const rows = trash || []
    if (!rows.length || emptying) return
    if (!window.confirm(`Permanently delete all ${rows.length} board${rows.length === 1 ? '' : 's'} in the Trash? This cannot be undone.`)) return
    setEmptying(true)
    Promise.allSettled(rows.map((b) => purgeBoard(b.id).then(() => b.id)))
      .then((results) => {
        const gone = new Set(results.filter((r) => r.status === 'fulfilled').map((r) => r.value))
        setTrash((t) => (t || []).filter((x) => !gone.has(x.id)))
        const failed = rows.length - gone.size
        showToast(failed ? `Deleted ${gone.size}, ${failed} failed` : 'Trash emptied')
      })
      .finally(() => setEmptying(false))
  }

  function backToGallery() {
    setActive(null); setLoadError(false); setUrlId(null); setView('gallery'); loadBoards(true)
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
    const signedIn = Boolean(user) || devBypass
    const canEdit = signedIn && !isTouchDevice && !narrow
    // WHY the board is read-only, so it can say so instead of swallowing edits: a
    // shared ?id= link skips the sign-in gate below, so an expired session lands
    // here looking exactly like an editable board.
    const readOnly = canEdit ? null : (signedIn ? 'device' : 'auth')
    return (
      <>
        <Suspense fallback={<Splash label="Loading board…" />}>
          <Board key={active.id} board={active} canEdit={canEdit} readOnly={readOnly} theme={t} themeName={themeMode}
            onToggleTheme={toggle} onBack={backToGallery} showToast={showToast} />
        </Suspense>
        <Toast {...toast} />
      </>
    )
  }

  // ── Sign-in gate (gallery only; shared boards above stay public) ────────────
  if (!hasIdParam && !devBypass) {
    if (!authChecked) return <SignInScreen loading />
    if (!user) return <SignInScreen devBypass={() => setDevBypass(true)} error={authMessage} probeError={authProbeError} onRetry={checkAuth} />
  }

  // ── Trash ───────────────────────────────────────────────────────────────────
  if (view === 'trash') {
    return (
      <>
        <Trash boards={trash || []} loading={trash === null} error={trashError} onRetry={loadTrash} accent={t.accent} themeName={themeMode} onToggleTheme={toggle}
          onCreate={createNew} onSignOut={signOut} creating={creating}
          onBack={() => { setView('gallery'); loadBoards(true) }}
          onRestore={restoreOne} onPurge={purgeOne} onEmpty={emptyTrash} emptying={emptying} narrow={narrow} />
        <Toast {...toast} />
      </>
    )
  }

  // ── Gallery ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Gallery
        boards={boards || []} accent={t.accent} themeName={themeMode} onToggleTheme={toggle}
        onOpen={openBoard} onCreate={createNew} onDelete={removeBoard} onSignOut={signOut}
        onOpenTrash={openTrash} trashCount={(trash || []).length} creating={creating}
        loading={boards === null} error={boardsError} onRetry={() => loadBoards()} narrow={narrow}
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
      {action && <button onClick={action} style={{ marginTop: 6, padding: '10px 20px', background: 'var(--accent-fill)', color: 'var(--accent-ink)', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Back to boards</button>}
    </div>
  )
}
