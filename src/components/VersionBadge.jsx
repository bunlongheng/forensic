import { VERSION } from '../version.js'

// A tiny always-on version stamp in the bottom-right corner of every page, so you
// can confirm at a glance which build is live. pointer-events off so it never
// blocks a click; fx-noexport keeps it out of PNG/report exports. Sits above the
// iOS home indicator via the safe-area inset.
export function VersionBadge() {
  return (
    <span
      className="mono fx-noexport"
      style={{
        position: 'fixed',
        right: 'calc(16px + env(safe-area-inset-right))',
        bottom: 'calc(10px + env(safe-area-inset-bottom))',
        zIndex: 2147483000, pointerEvents: 'none',
        fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
        // White, with a faint shadow so it stays legible on light pages too.
        color: '#ffffff', opacity: 0.85, textShadow: '0 1px 2px rgba(0,0,0,0.45)',
      }}
    >
      {VERSION}
    </span>
  )
}
