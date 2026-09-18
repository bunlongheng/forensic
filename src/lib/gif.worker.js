// Shrinks an oversized GIF off the main thread: decode with the browser's own
// ImageDecoder, downscale each kept frame on an OffscreenCanvas, quantise to one
// global 256-colour palette, re-encode with gifenc. Posts progress per frame and
// the finished bytes, or an error the caller can explain.
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { planFrames, scaledSize, nextPlan, MAX_FRAMES, MAX_PASSES, HARD_MAX_FRAMES } from './gifPlan.js'

const FORMAT = 'rgb565'
const PALETTE_SAMPLE_FRAMES = 6 // frames sampled for the global palette
const PALETTE_SAMPLE_STRIDE = 3 // every 3rd pixel of those frames

const fail = (code, message) => self.postMessage({ type: 'error', code, message })

self.onmessage = async ({ data: { buffer, targetBytes } }) => {
  let decoder
  try {
    decoder = new globalThis.ImageDecoder({ data: buffer, type: 'image/gif' })
    await decoder.tracks.ready
    await decoder.completed
    const total = decoder.tracks.selectedTrack.frameCount
    if (total > HARD_MAX_FRAMES) return fail('too-large', `${total} frames is more than the ${HARD_MAX_FRAMES} this can shrink`)

    // Pass 0: frame timings only, so the frame budget keeps the clip's real length.
    const durations = []
    let width = 0, height = 0
    for (let i = 0; i < total; i++) {
      const { image } = await decoder.decode({ frameIndex: i })
      if (i === 0) { width = image.displayWidth; height = image.displayHeight }
      durations.push((image.duration || 100_000) / 1000) // microseconds -> ms
      image.close()
    }
    let plan = { frames: Math.min(total, MAX_FRAMES), scale: 1 }
    let last = null
    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      const frames = planFrames(durations, plan.frames)
      const { width: w, height: h } = scaledSize(width, height, plan.scale)
      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const rgbaOf = async (frameIndex) => {
        const { image } = await decoder.decode({ frameIndex })
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(image, 0, 0, w, h)
        image.close()
        return ctx.getImageData(0, 0, w, h).data
      }

      // One palette for the whole clip: a sample of frames, thinned, quantised once.
      // Per-frame palettes would flicker and cost a local colour table per frame.
      const sampleEvery = Math.max(1, Math.floor(frames.length / PALETTE_SAMPLE_FRAMES))
      const chunks = []
      for (let k = 0; k < frames.length; k += sampleEvery) {
        const px = await rgbaOf(frames[k].index)
        const thin = new Uint8ClampedArray(Math.floor(px.length / 4 / PALETTE_SAMPLE_STRIDE) * 4)
        for (let p = 0, q = 0; q < thin.length; p += 4 * PALETTE_SAMPLE_STRIDE, q += 4) {
          thin[q] = px[p]; thin[q + 1] = px[p + 1]; thin[q + 2] = px[p + 2]; thin[q + 3] = 255
        }
        chunks.push(thin)
      }
      const sample = new Uint8ClampedArray(chunks.reduce((n, c) => n + c.length, 0))
      for (let off = 0, c = 0; c < chunks.length; off += chunks[c++].length) sample.set(chunks[c], off)
      const palette = quantize(sample, 256, { format: FORMAT })

      const gif = GIFEncoder()
      for (let f = 0; f < frames.length; f++) {
        const rgba = await rgbaOf(frames[f].index)
        const index = applyPalette(rgba, palette, FORMAT)
        gif.writeFrame(index, w, h, { palette, delay: frames[f].delay, repeat: 0, dispose: 1 })
        if (f % 3 === 0 || f === frames.length - 1) {
          self.postMessage({ type: 'progress', pass, passes: MAX_PASSES, done: f + 1, total: frames.length, pct: Math.round(((f + 1) / frames.length) * 100), width: w, height: h })
        }
      }
      gif.finish()
      const bytes = gif.bytes()
      if (bytes.length <= targetBytes) {
        self.postMessage({ type: 'done', bytes, width: w, height: h, frames: frames.length, passes: pass }, [bytes.buffer])
        return
      }
      last = { bytes: bytes.length, frames: frames.length, w, h }
      plan = nextPlan(bytes.length, targetBytes, plan.frames, plan.scale)
      if (!plan) break
    }
    fail('too-large', `still ${Math.round((last?.bytes || 0) / 1e5) / 10} MB at ${last?.frames} frames, ${last?.w}x${last?.h}`)
  } catch (err) {
    fail(err?.code || 'decode', err?.message || 'Could not decode the GIF')
  } finally {
    try { decoder?.close() } catch { /* already closed */ }
  }
}
