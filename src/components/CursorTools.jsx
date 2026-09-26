import { useState, useEffect, useRef } from 'react'
import { Icon } from './Icon.jsx'
import { STAMP_COLORS } from '../lib/constants.js'

// The tool ring: hit + in the toolbar or the + in the corner and the
// add-tools bloom around the pointer, so a note lands where you are looking
// instead of in the middle of the screen. A tool with `choices` re-blooms the
// ring as its options rather than opening a second menu somewhere else.

const R = 96        // icon ring radius, screen px - constant regardless of zoom
const R2 = 136      // choices ring: wider, because those are text pills
const AWAY = 80      // how far past the outermost button counts as "moved away"
const GRACE_MS = 200 // slop before a move-away commits, so a nudge past the edge is forgiven
const SPIN_MS = 300  // one button's travel out from (or back into) the centre
const STEP_MS = 32   // stagger between neighbours - this is what reads as a sweep
// The exit easing is the literal MIRROR of the entry's: reflecting the control
// points through (0.5, 0.5) turns the fly-out's overshoot into a matching wind-up
// on the way back, which is what makes the close read as the open rewinding.
const EASE_OUT = 'cubic-bezier(.22,.9,.28,1.12)'
const EASE_IN = 'cubic-bezier(.72,-.12,.78,.1)'
const exitMs = (n) => SPIN_MS + (n - 1) * STEP_MS
export const RING_SAFE = R2 + 12 // Board clamps the summon point to this margin

const ringPos = (i, n, r) => {
  const a = ((i / n) * 360 - 90) * Math.PI / 180
  return { x: Math.cos(a) * r, y: Math.sin(a) * r }
}

// Opening sweeps CLOCKWISE (index order runs clockwise from 12 o'clock, so the
// stagger follows it). Closing runs fx-retract staggered from the LAST button
// back to the first, which reads as counter-clockwise.
const bloom = (x, y, i, n, exiting) => ({
  '--tx': `${x}px`, '--ty': `${y}px`,
  animationName: exiting ? 'fx-retract' : 'fx-bloom',
  animationDuration: `${SPIN_MS}ms`,
  animationTimingFunction: exiting ? EASE_IN : EASE_OUT,
  animationDelay: `${(exiting ? n - 1 - i : i) * STEP_MS}ms`,
  animationFillMode: 'both',
  willChange: 'transform, opacity', // keep the sweep on the compositor
})

export function CursorTools({ at, items, closing, onPick, onClose }) {
  const [chooser, setChooser] = useState(null)
  // Dismissing plays the ring back into the centre before it unmounts, so it
  // never just blinks out. `closing` is the board asking; the local flag is the
  // ring's own backdrop click or the pointer walking away.
  const [selfClosing, setSelfClosing] = useState(false)
  // Move the pointer clear of the ring and it puts itself away, playing the SAME
  // counter-clockwise retract as a deliberate dismiss - an opacity fade in place
  // read as nothing happening. A grace window forgives a nudge past the edge.
  const [away, setAway] = useState(false)
  useEffect(() => {
    if (!at) return
    const outer = (chooser ? R2 : R) + 19 + AWAY
    const onMove = (e) => setAway(Math.hypot(e.clientX - at.x, e.clientY - at.y) > outer)
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [at, chooser])
  useEffect(() => {
    if (!away) return
    const t = setTimeout(() => setSelfClosing(true), GRACE_MS)
    return () => clearTimeout(t)
  }, [away])

  // Keyboard support: focus the first ring button as soon as it blooms (so Tab
  // reaches it instead of needing a pointer), Escape dismisses like the backdrop
  // click, and focus returns to whatever opened the ring once it's gone.
  const firstBtnRef = useRef(null)
  useEffect(() => {
    if (!at) return
    const previouslyFocused = document.activeElement
    const raf = requestAnimationFrame(() => firstBtnRef.current?.focus())
    const onKeyDown = (e) => { if (e.key === 'Escape') setSelfClosing(true) }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus()
    }
  }, [at, chooser])

  // Let the counter-clockwise sweep finish, then actually unmount.
  const exitingNow = closing === true || selfClosing
  const count = (chooser ? chooser.choices : items).length
  useEffect(() => {
    if (!exitingNow) return
    const t = setTimeout(onClose, exitMs(count))
    return () => clearTimeout(t)
  }, [exitingNow, count, onClose])

  if (!at) return null

  const exiting = closing === true || selfClosing
  const close = () => setSelfClosing(true)
  const pick = (it) => {
    if (it.choices) { setChooser(it); return }
    // The node lands immediately; the ring rewinds out over it.
    onPick(it)
    setSelfClosing(true)
  }
  const list = chooser ? chooser.choices : items
  const r = chooser ? R2 : R

  return (
    <>
      {/* Catches the click that dismisses the ring. Sits UNDER the buttons. */}
      <div onPointerDown={close} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-ring)' }} />
      <div className="fx-noexport" role="menu" aria-label={chooser ? chooser.label : 'Add to board'} style={{
        position: 'fixed', left: at.x, top: at.y, width: 0, height: 0, zIndex: 'calc(var(--z-ring) + 1)',
        pointerEvents: exiting ? 'none' : undefined, // never click a tool that is on its way out
      }}>
        {/* Marks the exact spot the node will land on. */}
        <div style={{
          position: 'absolute', left: -5, top: -5, width: 10, height: 10, borderRadius: '50%',
          background: 'var(--accent)', boxShadow: '0 0 0 3px rgba(255,255,255,.45)', pointerEvents: 'none',
        }} />
        {chooser && (
          <span className="mono" style={{
            position: 'absolute', left: '-50%', top: 14, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            fontSize: 9, fontWeight: 700, letterSpacing: '.05em', color: 'var(--muted)', pointerEvents: 'none',
          }}>{chooser.label.toUpperCase()}</span>
        )}
        {list.map((it, i) => {
          const { x, y } = ringPos(i, list.length, r)
          const isStamp = chooser?.key === 'stamp'
          return (
            <button
              key={it.key ? `${it.key}-${it.label}` : it.label} ref={i === 0 ? firstBtnRef : undefined}
              className="fx-fab-item" title={it.label} role="menuitem"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => pick(it)}
              style={{
                position: 'absolute', cursor: 'pointer', boxShadow: 'var(--shadow)',
                background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)',
                display: 'grid', placeItems: 'center',
                ...(chooser
                  ? {
                      left: x - 46, top: y - 13, width: 92, height: 26, borderRadius: 999,
                      fontSize: isStamp ? 9 : 10.5, fontWeight: 700,
                      letterSpacing: isStamp ? '.05em' : 0,
                      fontFamily: isStamp ? "'Space Mono', ui-monospace, monospace" : undefined,
                      color: isStamp ? STAMP_COLORS[0] : 'var(--text)',
                    }
                  : { left: x - 19, top: y - 19, width: 38, height: 38, borderRadius: '50%' }),
                ...bloom(x, y, i, list.length, exiting),
              }}
            >
              {chooser
                ? it.label
                : it.glyph ? <span style={{ fontSize: 16 }}>{it.glyph}</span> : <Icon name={it.icon} size={16} />}
            </button>
          )
        })}
      </div>
    </>
  )
}
