// Signed-out landing. The decorative motif is Forensic's own thing: a web of
// evidence pins that wires itself together with red thread on load, then drifts.
// Self-contained (strict CSP blocks CDN fonts), aria-hidden decoration,
// prefers-reduced-motion safe.
const PINS = [
  { x: 180, y: 150, hub: true }, { x: 420, y: 90 }, { x: 700, y: 130 },
  { x: 980, y: 100 }, { x: 300, y: 380 }, { x: 560, y: 320 },
  { x: 820, y: 400 }, { x: 1050, y: 340 }, { x: 200, y: 600 },
  { x: 520, y: 600 }, { x: 780, y: 640 }, { x: 1020, y: 590 },
]
const THREADS = [
  [0, 1], [0, 4], [1, 5], [5, 2], [2, 6], [2, 3], [3, 7], [4, 8],
  [5, 9], [6, 10], [6, 7], [7, 11], [9, 10], [4, 5],
]

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

export default function SignInScreen({ devBypass, loading }) {
  const W = 1200, H = 760
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'radial-gradient(130% 130% at 50% -10%, #1b1f27 0%, #12151b 55%, #0a0c10 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`
        @keyframes fxDraw { from { stroke-dashoffset: 720; } to { stroke-dashoffset: 0; } }
        @keyframes fxPop  { from { opacity: 0; transform: scale(.55); } to { opacity: 1; transform: scale(1); } }
        @keyframes fxDrift { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-12px,0); } }
        @keyframes fxCard { from { opacity: 0; transform: translateY(20px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .fx-thread { stroke-dasharray: 720; animation: fxDraw 1.2s ease forwards; }
        .fx-pin { transform-box: fill-box; transform-origin: center; animation: fxPop .5s cubic-bezier(.2,.8,.2,1) both; }
        .fx-scene { animation: fxDrift 10s ease-in-out infinite; }
        .fx-card { animation: fxCard .6s cubic-bezier(.2,.8,.2,1) both; }
        .fx-btn { transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease; }
        .fx-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 30px rgba(0,0,0,.4); border-color: #3a4150; }
        @media (prefers-reduced-motion: reduce) {
          .fx-thread,.fx-pin,.fx-scene,.fx-card { animation: none !important; stroke-dashoffset: 0 !important; opacity: 1 !important; }
        }
      `}</style>

      <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <g className="fx-scene">
          {THREADS.map(([a, b], i) => (
            <line key={i} className="fx-thread" x1={PINS[a].x} y1={PINS[a].y} x2={PINS[b].x} y2={PINS[b].y}
              stroke="#ff4438" strokeWidth="2.5" strokeLinecap="round" opacity="0.55"
              style={{ animationDelay: `${0.1 + i * 0.06}s` }} />
          ))}
          {PINS.map((p, i) => (
            <g key={i} className="fx-pin" style={{ animationDelay: `${0.4 + i * 0.06}s` }}>
              <circle cx={p.x} cy={p.y} r={p.hub ? 16 : 11} fill="#f4f1ea" />
              <circle cx={p.x} cy={p.y} r={p.hub ? 7 : 4.5} fill={p.hub ? '#ff4438' : '#2b313d'} />
            </g>
          ))}
        </g>
      </svg>

      {!loading && (
        <div className="fx-card" style={{ position: 'relative', width: 384, maxWidth: 'calc(100vw - 32px)', background: 'rgba(20,23,29,0.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderRadius: 22, padding: '40px 36px 30px', boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <img src="/icon.png" alt="Forensic" width={64} height={64} style={{ display: 'block', margin: '0 auto 18px', borderRadius: 16, boxShadow: '0 10px 26px rgba(0,0,0,0.5)' }} />
          <h1 className="mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.16em', color: '#f4f1ea', margin: 0 }}>FORENSIC</h1>
          <div style={{ width: 40, height: 4, borderRadius: 3, background: '#ff4438', margin: '12px auto 16px' }} />
          <p style={{ fontSize: 13.5, color: '#9aa2ad', margin: '0 0 26px', lineHeight: 1.55 }}>
            An infinite board for pinning evidence<br />and wiring the connections.
          </p>
          <a href="/api/auth/login" className="fx-btn"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', boxSizing: 'border-box', padding: '12px 0', fontSize: 14, fontWeight: 600, borderRadius: 12, background: '#1f242d', color: '#e7e9ec', border: '1px solid #2b313d', cursor: 'pointer', textDecoration: 'none' }}>
            <GoogleG /> Continue with Google
          </a>
          <p style={{ fontSize: 11.5, color: '#6b727d', margin: '18px 0 0' }}>Owner access only. Shared boards stay public to view.</p>
          {import.meta.env.DEV && (
            <button onClick={devBypass} style={{ marginTop: 14, background: 'none', border: 'none', color: '#ff6b61', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Continue without signing in (dev)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
