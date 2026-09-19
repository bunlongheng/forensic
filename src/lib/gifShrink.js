// Main-thread side of GIF shrinking: spawn the worker, stream its progress to the
// caller, hand back the same { src, width, height } shape fileToImage returns.
import { IMAGE_MAX } from './constants.js'
import { HARD_MAX_BYTES } from './gifPlan.js'

export { HARD_MAX_BYTES }

// Needs WebCodecs' ImageDecoder (Chrome, Edge, Safari 16.4+) and an OffscreenCanvas.
// Both are secure-context only, which localhost and https both are.
export const canShrinkGifs = () =>
  typeof globalThis.ImageDecoder !== 'undefined' && typeof globalThis.OffscreenCanvas !== 'undefined'

const readAsDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })

// Resolves with a data URL that is a real animated GIF under the attachment cap.
// Rejects with err.code 'too-large' when even the smallest pass will not fit, or
// 'decode' when the bytes are not a GIF the browser can read.
export async function shrinkGif(file, onProgress) {
  const buffer = await file.arrayBuffer()
  const worker = new Worker(new URL('./gif.worker.js', import.meta.url), { type: 'module' })
  return new Promise((resolve, reject) => {
    const bail = (message, code) => { worker.terminate(); const err = new Error(message); err.code = code; reject(err) }
    worker.onerror = (e) => bail(e.message || 'GIF worker failed', 'decode')
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') { onProgress?.(data); return }
      if (data.type === 'error') { bail(data.message, data.code); return }
      worker.terminate()
      readAsDataURL(new Blob([data.bytes], { type: 'image/gif' }))
        .then((src) => resolve({ src, width: data.width, height: data.height }))
        .catch(() => bail('Could not read the shrunk GIF', 'decode'))
    }
    worker.postMessage({ buffer, targetBytes: IMAGE_MAX }, [buffer])
  })
}
