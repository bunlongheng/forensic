// A small metal paperclip that hangs over the top edge of a paper. Shared by the
// Clip note and the note's "Paper" style.
const CLIP_PATH = 'M7 40 V12 a4 4 0 0 1 8 0 V35 a2.7 2.7 0 0 1 -5.4 0 V17'

export function Paperclip({ left = 18 }) {
  return (
    <svg viewBox="0 0 22 46" width="17" height="36" style={{ position: 'absolute', top: -15, left, zIndex: 3, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.35))' }} aria-hidden>
      <path d={CLIP_PATH} fill="none" stroke="#9aa1a8" strokeWidth="2.6" strokeLinecap="round" />
      <path d={CLIP_PATH} fill="none" stroke="#eef1f4" strokeWidth="0.9" strokeLinecap="round" transform="translate(-0.5 -0.5)" />
    </svg>
  )
}
