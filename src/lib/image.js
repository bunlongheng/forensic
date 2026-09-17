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
import { ATTACH_MAX } from './attach.js'

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

export async function fileToImage(file) {
  const mime = imageMime(file)
  if (!mime) throw new Error('Not an image')
  let dataUrl = await readAsDataURL(file)
  // A typeless file reads back as data:application/octet-stream, which no <img>
  // will render. Re-label it with the MIME we inferred - the bytes are the same.
  if (!dataUrl.startsWith('data:image/')) dataUrl = `data:${mime}${dataUrl.slice(dataUrl.indexOf(';'))}`
  // SVG has no intrinsic raster size to downscale meaningfully - keep as-is.
  // A GIF is kept as-is too: drawing it onto a canvas keeps exactly one frame, and
  // a GIF that stops moving is not the evidence that was pasted. Since it cannot be
  // shrunk, the attachment cap applies - anything heavier belongs behind a link.
  if (mime === 'image/svg+xml' || mime === 'image/gif') {
    if (mime === 'image/gif' && file.size > ATTACH_MAX) {
      const err = new Error('GIF too large')
      err.code = 'too-large'
      throw err
    }
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
