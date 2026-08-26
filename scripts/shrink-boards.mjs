// Re-compress image data URLs in any board whose JSON exceeds the safe save size,
// writing straight to Postgres so it bypasses the 4.5MB API body limit. Fixes
// boards saved with the old high-res images ("Save failed"). Run: node scripts/shrink-boards.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const require = createRequire(import.meta.url)
const sharp = require(process.env.HOME + '/Sites/bheng/node_modules/sharp')
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const env = Object.fromEntries(
  readFileSync(path.join(root, '.env'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).replace(/^"|"$/g, '').trim()]
  }),
)
const SAFE_MB = 3.6  // shrink boards bigger than this so a PUT (Vercel 4.5MB) succeeds
const TARGET_MB = 4.0 // step image quality down until the board fits under this
// Progressively harder (maxPx, webpQuality) settings.
const LADDER = [[1800, 78], [1400, 72], [1100, 66], [900, 60], [720, 55]]

async function shrink(src, max, q) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(src)
  if (!m) return null
  const buf = Buffer.from(m[2], 'base64')
  const meta = await sharp(buf).metadata()
  const scale = Math.min(1, max / Math.max(meta.width || max, meta.height || max))
  const w = Math.max(1, Math.round((meta.width || max) * scale))
  const h = Math.max(1, Math.round((meta.height || max) * scale))
  const out = meta.hasAlpha
    ? await sharp(buf).resize(w, h).png({ quality: q }).toBuffer()
    : await sharp(buf).resize(w, h).webp({ quality: q }).toBuffer()
  const mime = meta.hasAlpha ? 'image/png' : 'image/webp'
  const next = `data:${mime};base64,${out.toString('base64')}`
  return next.length < src.length ? next : null
}

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
})
try {
  const { rows } = await pool.query('SELECT id, title, nodes FROM boards')
  let fixed = 0
  for (const b of rows) {
    const before = Buffer.byteLength(JSON.stringify(b.nodes)) / 1e6
    if (before < SAFE_MB) continue
    let changed = false
    let after = before
    for (const [max, q] of LADDER) {
      for (const n of b.nodes) {
        if (n.type === 'image' && typeof n.data?.src === 'string' && n.data.src.startsWith('data:')) {
          const next = await shrink(n.data.src, max, q)
          if (next) { n.data.src = next; changed = true }
        }
      }
      after = Buffer.byteLength(JSON.stringify(b.nodes)) / 1e6
      if (after < TARGET_MB) break // fits - stop before degrading further
    }
    if (changed) {
      await pool.query('UPDATE boards SET nodes = $1::jsonb WHERE id = $2', [JSON.stringify(b.nodes), b.id])
      console.log(`  ${b.title}: ${before.toFixed(2)}MB -> ${after.toFixed(2)}MB${after >= 4.4 ? ' (STILL LARGE - needs blob storage)' : ''}`)
      fixed++
    }
  }
  console.log(fixed ? `shrunk ${fixed} oversized board(s)` : 'no oversized boards found')
} finally {
  await pool.end()
}
