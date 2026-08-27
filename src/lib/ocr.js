// In-browser OCR via tesseract.js - zero API cost, zero tokens. All assets are
// self-hosted under /tesseract (worker, wasm core, english model) so the strict
// CSP needs no external host. Results are cached per-image for the session.
let workerPromise = null
const cache = new Map() // image src -> extracted text

async function getWorker() {
  if (!workerPromise) {
    const { createWorker } = await import('tesseract.js')
    workerPromise = createWorker('eng', 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/tesseract-core-simd-lstm.wasm.js',
      langPath: '/tesseract',
    })
  }
  return workerPromise
}

// OCR one image (data URL or URL). Cached by src. Returns trimmed text ('' on failure).
export async function ocrImage(src) {
  if (cache.has(src)) return cache.get(src)
  try {
    const worker = await getWorker()
    const { data } = await worker.recognize(src)
    const text = (data.text || '').replace(/\s+\n/g, '\n').trim()
    cache.set(src, text)
    return text
  } catch {
    cache.set(src, '')
    return ''
  }
}

export const ocrCached = (src) => cache.get(src)
