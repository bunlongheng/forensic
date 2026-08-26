import { buildReport } from '../lib/report.js'

// A printable case report generated from the board (no tokens). Lists the
// evidence, the detected links, and the connection map.
function Section({ label, count, children }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>
        {label}{count != null && <span style={{ color: 'var(--muted)', fontWeight: 600 }}> · {count}</span>}
      </div>
      {children}
    </div>
  )
}

export function ReportModal({ title, nodes, edges, onClose }) {
  const r = buildReport(title, nodes, edges)
  const stat = (n, l) => (
    <div style={{ textAlign: 'center' }}>
      <div className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{n}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
    </div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(720px, 100%)', maxHeight: '86vh', overflowY: 'auto', background: 'var(--panel)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '26px 30px 30px', boxShadow: 'var(--shadow)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--accent)', textTransform: 'uppercase' }}>Case Report</div>
            <h2 className="mono" style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>{r.title}</h2>
          </div>
          <button onClick={() => window.print()} style={btn}>Print / PDF</button>
          <button onClick={onClose} style={{ ...btn, background: 'transparent' }}>Close</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 20, padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          {stat(r.counts.notes, 'Notes')}
          {stat(r.counts.images, 'Photos')}
          {stat(r.counts.connections, 'Links')}
          {stat(r.counts.links, 'URLs')}
        </div>

        {r.links.length > 0 && (
          <Section label="Detected links" count={r.links.length}>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
              {r.links.map((u) => <li key={u}><a href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{u}</a></li>)}
            </ul>
          </Section>
        )}

        <Section label="Evidence" count={r.notes.length + r.images.length}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
            {r.images.map((i) => <li key={i.id}><b>Photo:</b> {i.label || <em style={{ color: 'var(--muted)' }}>uncaptioned</em>}</li>)}
            {r.notes.map((n) => <li key={n.id} style={{ whiteSpace: 'pre-wrap' }}>{n.text || <em style={{ color: 'var(--muted)' }}>empty note</em>}</li>)}
          </ul>
        </Section>

        {r.connections.length > 0 && (
          <Section label="Connection map" count={r.connections.length}>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
              {r.connections.map((c, i) => <li key={i}>{c.from} <span style={{ color: 'var(--accent)' }}>&rarr;</span> {c.to}</li>)}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}

const btn = {
  padding: '8px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: 9, cursor: 'pointer',
  background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', flexShrink: 0,
}
