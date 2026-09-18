// The board clipboard - deliberately OUTSIDE React.
//
// The copied selection used to live in a useRef inside the clipboard hook, and
// App renders <Board key={board.id}>, so opening another board unmounted the
// component and took the clipboard with it: copy on one board, paste on the next,
// nothing happened. A module-level store survives that remount, which is the whole
// point of cutting something - you cut it HERE to put it THERE.
//
// It is mirrored into sessionStorage as well, so a reload mid-move does not lose
// the cut, but only when the payload is small: a board node can carry a 4 MB
// base64 image inline, and the draft store already shares that quota. Too big to
// mirror is not an error - the in-memory copy still works for this tab.
const MIRROR_MAX = 512 * 1024
const KEY = 'fx-node-clipboard'

let mem = null // { nodes, edges } - the authoritative copy

const session = () => {
  try {
    return window.sessionStorage
  } catch {
    return null // Safari private mode and friends throw on ACCESS, not just on write
  }
}

export function writeClip(nodes, edges = []) {
  mem = { nodes, edges }
  const s = session()
  if (!s) return
  try {
    const payload = JSON.stringify(mem)
    if (payload.length > MIRROR_MAX) s.removeItem(KEY) // stale entry would be worse than none
    else s.setItem(KEY, payload)
  } catch {
    // quota, or a node that will not serialise - the memory copy is still good
  }
}

export function readClip() {
  if (mem) return mem
  const s = session()
  if (!s) return null
  try {
    const raw = s.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.nodes) && parsed.nodes.length ? parsed : null
  } catch {
    return null
  }
}

export function clearClip() {
  mem = null
  try { session()?.removeItem(KEY) } catch { /* nothing to clear */ }
}
