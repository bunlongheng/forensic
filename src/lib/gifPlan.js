// The pure half of GIF shrinking - no DOM, no worker - so it can be unit-tested
// and shared by the main thread and the worker.
//
// A GIF that is over the attachment cap cannot ride as-is, and a canvas keeps a
// single frame, so shrinking has to keep the animation: fewer frames, smaller
// pixels, one 256-colour palette. Pass 1 encodes at full size with the frame
// budget applied; every pass after that is sized from what the last one measured.

export const MAX_FRAMES = 90          // enough for any looping clip; keeps a pass under a few seconds
export const MIN_FRAMES = 24          // below this a clip reads as a slideshow, not motion
export const MIN_SCALE = 0.25         // a quarter-size infographic is the floor before we give up
export const MAX_PASSES = 4
export const SAFETY = 0.85            // aim under the target: LZW is only roughly linear in pixels
export const HARD_MAX_BYTES = 40_000_000 // refuse outright above this - decoding it would eat the tab
export const HARD_MAX_FRAMES = 600
export const MIN_DELAY_MS = 20        // browsers clamp anything shorter up to 100ms anyway

// Which frames survive so at most `max` remain, and how long each one shows.
// Dropped frames donate their time to the kept frame before them, so the clip
// still plays for the same wall-clock length at a lower frame rate.
export function planFrames(durationsMs, max = MAX_FRAMES) {
  const n = durationsMs.length
  const step = Math.max(1, Math.ceil(n / max))
  const keep = []
  for (let i = 0; i < n; i += step) {
    let delay = 0
    for (let j = i; j < Math.min(n, i + step); j++) delay += durationsMs[j] || 0
    keep.push({ index: i, delay: Math.max(MIN_DELAY_MS, Math.round(delay)) })
  }
  return keep
}

// Given what the last pass produced, choose the next (frames, scale). GIF bytes
// are roughly linear in pixels x frames, so the needed shrink factor is measured,
// not guessed: half of it comes off the frame count (down to MIN_FRAMES), the rest
// off the scale. One measured pass beats five blind ones - and lands under the
// target instead of just below the previous size. Returns null when even the floor
// cannot fit, so the caller can refuse honestly instead of encoding for nothing.
export function nextPlan(bytes, target, frames, scale) {
  const k = (target / bytes) * SAFETY
  if (k >= 1) return null
  const nextFrames = Math.max(MIN_FRAMES, Math.min(frames, Math.round(frames * Math.sqrt(k))))
  const remaining = k * (frames / nextFrames)
  const nextScale = scale * Math.sqrt(Math.min(1, remaining))
  if (nextScale < MIN_SCALE) return null
  return { frames: nextFrames, scale: +nextScale.toFixed(3) }
}

// Output pixel size for a pass: long edge scaled, never below 16px, even numbers.
export function scaledSize(width, height, scale) {
  const w = Math.max(16, Math.round(width * scale))
  const h = Math.max(16, Math.round(height * scale))
  return { width: w, height: h }
}
