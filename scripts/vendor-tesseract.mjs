// Copies the tesseract.js runtime assets out of node_modules into public/tesseract
// so the app can self-host them under the strict CSP (no external CDN). These are
// build artifacts of the npm packages, so they are gitignored and restored here on
// every `npm install` (locally and on Vercel) instead of being committed. Only the
// language model (eng.traineddata.gz) is committed, since it has no npm source.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'tesseract')
mkdirSync(out, { recursive: true })

const assets = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
]

for (const [from, to] of assets) {
  const src = join(root, 'node_modules', from)
  if (!existsSync(src)) {
    console.error(`vendor-tesseract: missing ${from} - run npm install first`)
    process.exit(1)
  }
  copyFileSync(src, join(out, to))
}
console.log(`vendor-tesseract: copied ${assets.length} runtime assets to public/tesseract`)
