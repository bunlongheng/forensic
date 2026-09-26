// Evidence that is not a photo: a pasted URL, a PDF, an audio or video file, a
// document. Each becomes one small `file` node - a stamped exhibit card you click
// to open in a new tab - so a board can hold the whole case, not just images.
//
// Files ride INSIDE the board JSON as data URLs (there is no blob store), and a
// board's nodes are capped at 4 MB, so one attachment is capped well under that.
// Anything heavier belongs behind a link, and the toast says so.
export const ATTACH_MAX = 2_000_000

const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'aiff']
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v']
const DOC_EXT = ['doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'json', 'eml', 'msg']

const ext = (name) => ((name || '').split('.').pop() || '').toLowerCase()

// What KIND of exhibit this is - drives the icon, the tab color and the label.
// Type first (a browser-supplied MIME is authoritative), extension as the fallback
// for the files that arrive as application/octet-stream.
export function kindOf(type = '', name = '') {
  const e = ext(name)
  if (type === 'application/pdf' || e === 'pdf') return 'pdf'
  if (type.startsWith('audio/') || AUDIO_EXT.includes(e)) return 'audio'
  if (type.startsWith('video/') || VIDEO_EXT.includes(e)) return 'video'
  if (type.startsWith('text/') || type.includes('officedocument') || type.includes('msword') || DOC_EXT.includes(e)) return 'doc'
  return 'file'
}

export const KIND_LABEL = { pdf: 'PDF', audio: 'Audio', video: 'Video', doc: 'Document', file: 'File', link: 'Link' }
// One ink per kind, drawn from the board's existing evidence palette.
export const KIND_COLOR = { pdf: '#c0392b', audio: '#1f7a6b', video: '#5b3fa8', doc: '#2f6690', file: '#6b5844', link: '#1d6fd1' }
export const KIND_ICON = { pdf: 'pdf', audio: 'audio', video: 'video', doc: 'doc', file: 'file', link: 'link' }

export function prettySize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })

// A dropped/pasted non-image file -> node data. Throws with code 'too-large' when
// it would not survive a save, so the caller can say that instead of "failed".
export async function fileToAttachment(file) {
  if (file.size > ATTACH_MAX) {
    const err = new Error('Attachment too large')
    err.code = 'too-large'
    throw err
  }
  const src = await readAsDataURL(file)
  return {
    kind: kindOf(file.type || '', file.name || ''),
    name: file.name || 'Attachment',
    mime: file.type || '',
    size: file.size,
    src,
  }
}

// The visible label for a link: host, plus the last path segment when there is
// one, so a board of links reads as evidence rather than a wall of URLs.
function linkLabel(u) {
  const host = u.hostname.replace(/^www\./, '')
  const last = u.pathname.split('/').filter(Boolean).pop()
  const label = last ? `${host}/${decodeURIComponent(last)}` : host
  return label.length > 76 ? `${label.slice(0, 75)}…` : label
}

// Pasted text -> link node data, or null when it is not a single URL (so ordinary
// text paste is never hijacked). A bare "example.com/x" counts; a sentence does not.
// A link that points AT a document keeps that document's icon - a .pdf link still
// reads as a PDF on the board.
export function parseLink(text) {
  const s = (text || '').trim()
  if (!s || s.length > 2048 || /\s/.test(s)) return null
  const raw = /^https?:\/\//i.test(s)
    ? s
    : (/^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(s) ? `https://${s}` : null)
  if (!raw) return null
  let u
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const k = kindOf('', u.pathname)
  return { kind: k === 'file' ? 'link' : k, url: u.href, name: linkLabel(u) }
}

// data: URL -> Blob, decoded by hand. `fetch(dataUrl)` would be simpler but the
// app's CSP allows connect-src 'self' blob: only, so a fetch of a data: URL is
// blocked - this is not.
export function dataUrlToBlob(dataUrl) {
  const i = dataUrl.indexOf(',')
  const head = dataUrl.slice(0, i)
  const body = dataUrl.slice(i + 1)
  const mime = (head.match(/^data:([^;,]+)/) || [])[1] || 'application/octet-stream'
  if (!/;base64/i.test(head)) return new Blob([decodeURIComponent(body)], { type: mime })
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let n = 0; n < bin.length; n++) bytes[n] = bin.charCodeAt(n)
  return new Blob([bytes], { type: mime })
}

// The only schemes a link node may be opened with or rendered as an href. A board
// can arrive from the agent API or a paste, so node.data.url is untrusted input -
// javascript: and data: URLs never get handed to window.open.
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function isSafeUrl(url) {
  try { return SAFE_PROTOCOLS.has(new URL(url).protocol) } catch { return false }
}

// The mime types that may be OPENED as a blob: document. A blob: URL is
// same-origin, so anything the browser renders as markup there runs under the
// app's own origin - and node.data.src is untrusted (an agent-written board can
// carry `data:text/html,<script>...`). These types all render as inert content
// in the browser's own viewer; svg is excluded even though it is an image,
// because an SVG document scripts exactly like HTML. Everything else downloads.
const VIEWABLE_MIME = /^(application\/pdf|image\/(?!svg\b)|audio\/|video\/|text\/plain)/i

// Open an exhibit. A link opens its URL; an embedded file is handed over as a
// blob - browsers refuse to navigate a tab to a data: URL, and a blob gets the
// real viewer (PDF reader, media player) instead of a download prompt. A type
// that is not on the viewable list is downloaded instead of opened, so it never
// gets a document under this origin.
export function openAttachment(data) {
  if (data?.url) {
    if (!isSafeUrl(data.url)) return false
    window.open(data.url, '_blank', 'noopener,noreferrer')
    return true
  }
  if (!data?.src) return false
  try {
    const blob = dataUrlToBlob(data.src)
    const url = URL.createObjectURL(blob)
    if (VIEWABLE_MIME.test(blob.type)) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = data.name || 'attachment'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    // The new tab / download has its own reference by now; hold ours briefly
    // for slow loads.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return true
  } catch { return false }
}
