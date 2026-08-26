// Turn a dropped/pasted image File into a canvas-ready node payload. Large images
// are downscaled to MAX px on the long edge and re-encoded (WebP where supported,
// else PNG) so a board packed with photos stays light in Postgres and fast to
// pan/zoom. Returns { src, width, height } - width/height are the natural pixels
// used to seed the node's on-canvas size while preserving aspect ratio.
const MAX = 1800 // long-edge cap - balance zoom sharpness vs Vercel's 4.5MB save limit
const RECODE_OVER = 350_000 // bytes: recode anything bigger even if it fits MAX

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

export async function fileToImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Not an image')
  const dataUrl = await readAsDataURL(file)
  // SVG has no intrinsic raster size to downscale meaningfully - keep as-is.
  if (file.type === 'image/svg+xml') {
    const img = await loadImage(dataUrl).catch(() => null)
    return { src: dataUrl, width: img?.width || 320, height: img?.height || 320 }
  }
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  const needsWork = scale < 1 || file.size > RECODE_OVER
  if (!needsWork) return { src: dataUrl, width: img.width, height: img.height }

  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const hasAlpha = file.type === 'image/png' || file.type === 'image/gif'
  const type = hasAlpha ? 'image/png' : 'image/webp'
  let out = canvas.toDataURL(type, 0.8)
  // Some engines silently ignore webp and hand back a data: URL of another type;
  // fall back to jpeg if webp wasn't honored and we don't need alpha.
  if (!hasAlpha && !out.startsWith('data:image/webp')) out = canvas.toDataURL("image/jpeg", 0.8)
  return { src: out, width: w, height: h }
}
