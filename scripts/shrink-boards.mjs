// Re-compress image data URLs in any board whose JSON exceeds the safe save size,
// writing straight to Postgres so it bypasses the 4.5MB API body limit. Fixes
// boards saved with the old high-res images ("Save failed").
//
// SAFE BY DEFAULT, mirroring scripts/extract-board-images.mjs:
//   node scripts/shrink-boards.mjs                     # dry run, all active boards
//   node scripts/shrink-boards.mjs --write              # do it
//   node scripts/shrink-boards.mjs --board <id>          # one board only
//   node scripts/shrink-boards.mjs --include-trashed     # also shrink trashed boards
import "dotenv/config";
import pg from "pg";
import { sslConfig, connectionString } from "../lib/db.js";
import { loadSharp } from "./_sharp.mjs";

const sharp = await loadSharp();

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => (has(f) ? args[args.indexOf(f) + 1] : null);
const WRITE = has("--write");
const INCLUDE_TRASHED = has("--include-trashed");
const ONE = val("--board");

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
  connectionString: connectionString(),
  ssl: process.env.DATABASE_SSL === 'true' ? sslConfig() : false,
})

if (!WRITE) console.log('DRY RUN - nothing is written. Pass --write to apply.\n')

try {
  const { rows } = ONE
    ? await pool.query('SELECT id, title, nodes, trashed_at FROM boards WHERE id = $1', [ONE])
    : await pool.query(`SELECT id, title, nodes, trashed_at FROM boards${INCLUDE_TRASHED ? '' : ' WHERE trashed_at IS NULL'}`)
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
      if (WRITE) await pool.query('UPDATE boards SET nodes = $1::jsonb WHERE id = $2', [JSON.stringify(b.nodes), b.id])
      console.log(`  ${b.title}: ${before.toFixed(2)}MB -> ${after.toFixed(2)}MB${after >= 4.4 ? ' (STILL LARGE - needs blob storage)' : ''}${WRITE ? '' : ' (dry run)'}`)
      fixed++
    }
  }
  console.log(fixed ? `${WRITE ? 'shrunk' : 'would shrink'} ${fixed} oversized board(s)` : 'no oversized boards found')
} finally {
  await pool.end()
}
