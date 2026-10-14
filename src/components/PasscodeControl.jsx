import { useEffect, useRef, useState } from 'react'

const ICON = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
const EyeIcon = () => <svg {...ICON}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
const EyeOffIcon = () => <svg {...ICON}><path d="M9.9 4.2A9.6 9.6 0 0 1 12 4c6.4 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.6 8 10 8a9.4 9.4 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>

const iconBtn = {
  display: 'grid', placeItems: 'center', width: 27, height: 27, borderRadius: 7,
  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)',
}

// The passcode box: masked, with an eye to show it (only the owner ever sees
// this, so the stored passcode is in it to read or edit). Enter or Set/Update saves.
// The parent keys it on the saved passcode, so a save or another board resets it.
function PasscodeField({ on, current = '', onSave }) {
  const [value, setValue] = useState(current)
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(true)
  const ready = Boolean(value.trim()) && value.trim() !== current
  const save = async () => {
    if (busy || !ready) return
    setBusy(true)
    await onSave(value.trim())
    setBusy(false)
  }
  return (
    <div onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.02em' }}>Passcode</div>
      <form onSubmit={e => { e.preventDefault(); save() }} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <span style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex' }}>
          <input value={value} onChange={e => setValue(e.target.value.toLowerCase())} onKeyDown={e => e.stopPropagation()} autoFocus={!on}
            type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            data-lpignore="true" data-1p-ignore="" data-bwignore="" data-form-type="other"
            placeholder={on ? 'Enter new passcode' : 'Choose a passcode'} aria-label="Passcode" maxLength={200}
            style={{ flex: 1, minWidth: 0, height: 38, padding: '0 38px 0 12px', fontSize: 16, fontWeight: 600, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-2)', color: 'var(--accent)', fontFamily: 'inherit', WebkitTextSecurity: shown ? 'none' : 'disc', outline: 'none' }} />
          <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? 'Hide passcode' : 'Show passcode'} title={shown ? 'Hide' : 'Show'}
            style={{ position: 'absolute', right: 4, top: 4, width: 30, height: 30, display: 'grid', placeItems: 'center', border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', outline: 'none' }}>
            {shown ? <EyeIcon /> : <EyeOffIcon />}
          </button>
        </span>
        <button type="submit" disabled={busy || !ready}
          style={{ height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--accent-fill)', color: 'var(--accent-ink)', fontSize: 13, fontWeight: 600, cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.45, fontFamily: 'inherit' }}>
          {on ? 'Update' : 'Set'}
        </button>
      </form>
    </div>
  )
}

// The owner's passcode toggle in the board top bar: a lock button that opens a
// small popover with the passcode field. Only mounted when the viewer can edit.
export function PasscodeControl({ hasPasscode, passcode, onSave }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = e => { if (root.current && !root.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={root} style={{ position: 'relative', display: 'flex' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-pressed={Boolean(hasPasscode)} aria-expanded={open}
        title={hasPasscode ? 'Passcode: the link opens to a lock screen' : 'Lock the share link with a passcode'}
        style={{ ...iconBtn, color: hasPasscode ? 'var(--accent)' : 'var(--text)' }}>
        <svg {...ICON}><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg>
      </button>
      {open && (
        <div role="dialog" aria-label="Share passcode"
          style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 280, padding: 12, borderRadius: 12, background: 'var(--panel, #fff)', border: '1px solid var(--border, rgba(0,0,0,0.12))', boxShadow: 'var(--shadow-sm)', pointerEvents: 'auto', zIndex: 10 }}>
          <PasscodeField key={passcode} on={hasPasscode} current={passcode} onSave={onSave} />
          {hasPasscode && (
            <button type="button" onClick={() => onSave('')}
              style={{ marginTop: 10, padding: 0, border: 'none', background: 'none', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
              Remove passcode
            </button>
          )}
        </div>
      )}
    </div>
  )
}
