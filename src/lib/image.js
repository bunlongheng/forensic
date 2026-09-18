// Turn a dropped/pasted image File into a canvas-ready node payload. Images are
// downscaled to MAX px on the long edge and ALWAYS re-encoded to WebP, so a board
// packed with photos stays light in Postgres and fast to pan/zoom. Returns
// { src, width, height } - width/height are the natural pixels used to seed the
// node's on-canvas size while preserving aspect ratio.
//
// WebP for everything, deliberately. This used to keep PNG sources as PNG "for
// the alpha channel", but WebP carries alpha perfectly well and a pasted 1800px
// screenshot is a PNG - which is how boards ended up at 8-12 MB of base64 and hit
// the 4 MB save cap. Same resolution, same visual quality, roughly 85% smaller.
//
// Re-encoding unconditionally also strips EXIF/ICC on the way through (canvas
// only carries pixels), so camera metadata - GPS included - never reaches the DB.
import { IMAGE_MAX } from './constants.js'
import { shrinkGif, canShrinkGifs, HARD_MAX_BYTES } from './gifShrink.js'

const MAX = 1800 // long-edge cap - balance zoom sharpness vs Vercel's 4.5MB save limit
const QUALITY = 0.82

// What counts as a photo. The browser's MIME is authoritative when it has one, but
// files arrive typeless or as application/octet-stream often enough (a .webp saved
// by some apps, an .svg dragged out of a design tool, anything copied through
// Finder) that the extension has to be the fallback - or the photo lands as an
// exhibit card, which is the wrong kind of evidence entirely.
const IMAGE_MIME = {
  svg: 'image/svg+xml', webp: 'image/webp', avif: 'image/avif', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp',
}
const ext = (name) => ((name || '').split('.').pop() || '').toLowerCase()

// The MIME an image file really has: its own type when it is an image type, else
// the one its extension implies, else null (= not an image we can show).
export function imageMime(file) {
  if (file?.type?.startsWith('image/')) return file.type
  return IMAGE_MIME[ext(file?.name)] || null
}
export const isImageFile = (file) => Boolean(imageMime(file))

const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

// Does the bitmap actually use its alpha channel? A pasted screenshot is a PNG but
// is fully opaque, so it can safely fall back to JPEG. Sampled, not exhaustive -
// a 1800px scan of every pixel is not worth the milliseconds.
function hasTransparency(ctx, w, h) {
  try {
    const { data } = ctx.getImageData(0, 0, w, h)
    for (let i = 3; i < data.length; i += 40) if (data[i] < 250) return true
    return false
  } catch { return true } // can't tell - assume alpha and keep a lossless fallback
}


// The real size of an SVG, read from the markup. `width`/`height` win when both
// are present and unitless-or-px; otherwise the viewBox gives the aspect ratio,
// which is what the node needs. Returns null when the markup says neither.
export function svgIntrinsicSize(markup) {
  const tag = /<svg\b[^>]*>/i.exec(markup || '')
  if (!tag) return null
  const attr = (name) => {
    const m = new RegExp(`\\s${name}\\s*=\\s*["']?\\s*([\\d.]+)\\s*(px)?["'\\s>]`, 'i').exec(tag[0])
    return m ? parseFloat(m[1]) : null
  }
  const w = attr('width'), h = attr('height')
  if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) }
  const vb = /\sviewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag[0])
  if (vb && parseFloat(vb[1]) > 0 && parseFloat(vb[2]) > 0) {
    return { width: Math.round(parseFloat(vb[1])), height: Math.round(parseFloat(vb[2])) }
  }
  return null
}

export async function fileToImage(file, onProgress) {
  const mime = imageMime(file)
  if (!mime) throw new Error('Not an image')
  let dataUrl = await readAsDataURL(file)
  // A typeless file reads back as data:application/octet-stream, which no <img>
  // will render. Re-label it with the MIME we inferred - the bytes are the same.
  if (!dataUrl.startsWith('data:image/')) dataUrl = `data:${mime}${dataUrl.slice(dataUrl.indexOf(';'))}`
  // A GIF under the cap is kept as-is: drawing it onto a canvas keeps exactly one
  // frame, and a GIF that stops moving is not the evidence that was pasted. Over
  // the cap it is shrunk in a worker - fewer frames, smaller pixels, one palette -
  // with progress reported to the caller, and refused only when even that fails.
  if (mime === 'image/gif' && file.size > IMAGE_MAX) {
    const err = new Error('GIF too large')
    err.code = 'too-large'
    if (file.size > HARD_MAX_BYTES) throw err
    if (!canShrinkGifs()) { err.code = 'no-shrink'; throw err }
    return shrinkGif(file, onProgress)
  }
  // SVG is vector: never rasterise it, so it stays sharp at any zoom. Its SIZE has
  // to come from the markup though - an <img> holding an SVG with no width/height
  // reports the CSS default 300x150, which is not the drawing's shape. A 1:4 logo
  // would be created as a 2:1 node and sit letterboxed inside it.
  if (mime === 'image/svg+xml') {
    const size = svgIntrinsicSize(await file.text().catch(() => ''))
    if (size) return { src: dataUrl, ...size }
    const img = await loadImage(dataUrl).catch(() => null)
    return { src: dataUrl, width: img?.width || 320, height: img?.height || 320 }
  }
  // A GIF is kept whole for the same reason a canvas would ruin it - one frame.
  if (mime === 'image/gif') {
    const img = await loadImage(dataUrl).catch(() => null)
    return { src: dataUrl, width: img?.width || 320, height: img?.height || 320 }
  }
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)

  let out = canvas.toDataURL('image/webp', QUALITY)
  // Some engines silently ignore webp and hand back a data: URL of another type.
  // Then it's JPEG, unless the bitmap really does use its alpha - only then PNG,
  // which is the expensive one we are trying to avoid.
  if (!out.startsWith('data:image/webp')) {
    out = hasTransparency(ctx, w, h) ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', QUALITY)
  }
  // A tiny, already-optimised source can survive the round trip larger than it
  // started. Keep whichever is smaller, as long as the original was already a
  // metadata-free lossy format.
  if (out.length > dataUrl.length && (mime === 'image/webp' || mime === 'image/jpeg')) {
    return { src: dataUrl, width: img.width, height: img.height }
  }
  return { src: out, width: w, height: h }
}
