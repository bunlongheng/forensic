// Small transient status pill, top-center. Themed via CSS vars.
export function Toast({ message, visible }) {
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', top: 20, left: '50%',
      transform: `translateX(-50%) translateY(${visible ? 0 : -60}px)`,
      background: 'var(--panel)', color: 'var(--text)',
      padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)',
      fontSize: 13, fontWeight: 600, zIndex: 9999, pointerEvents: 'none',
      boxShadow: 'var(--shadow)', opacity: visible ? 1 : 0,
      transition: 'transform .3s ease, opacity .3s ease',
      display: 'flex', alignItems: 'center', gap: 9,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
      {message}
    </div>
  )
}
