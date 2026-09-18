#!/usr/bin/env node
/**
 * Lift inline base64 images out of saved boards and into board_images rows.
 *
 * Every photo used to live inside boards.nodes as a data URL, which capped a
 * whole board at about 4 MB and made every autosave re-send every image. This
 * moves the bytes into their own rows and rewrites each node's `src` to
 * /api/images/<id>. The board JSON becomes text again.
 *
 * SAFE BY DEFAULT:
 *   - dry run unless --write is passed; it prints exactly what it would do
 *   - before touching a board it writes the original row to backups/, so a bad
 *     run is undone with --restore, not with a database restore
 *   - it never deletes an image row, so --restore always has bytes to point at
 *   - a node whose data URL is not a supported image type is left alone
 *
 *   node scripts/extract-board-images.mjs                # dry run, all boards
 *   node scripts/extract-board-images.mjs --write        # do it
 *   node scripts/extract-board-images.mjs --board <id>   # one board only
 *   node scripts/extract-board-images.mjs --restore <file.json>
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { parseDataUrl } from "../lib/handlers/images.js";
import { sslConfig, connectionString } from "../lib/db.js";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => (has(f) ? args[args.indexOf(f) + 1] : null);
const WRITE = has("--write");
const BACKUPS = path.join(process.cwd(), "backups");

const pool = new pg.Pool({ connectionString: connectionString(), ssl: sslConfig() });
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function restore(file) {
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  await pool.query("UPDATE boards SET nodes = $1 WHERE id = $2", [JSON.stringify(saved.nodes), saved.id]);
  console.log(`restored ${saved.title} (${saved.id}) from ${file}`);
}

async function main() {
  const restoreFile = val("--restore");
  if (restoreFile) return restore(restoreFile);

  const one = val("--board");
  const { rows } = one
    ? await pool.query("SELECT id, title, user_id, nodes FROM boards WHERE id = $1", [one])
    : await pool.query("SELECT id, title, user_id, nodes FROM boards WHERE trashed_at IS NULL ORDER BY updated_at DESC");

  if (!WRITE) console.log("DRY RUN - nothing is written. Pass --write to apply.\n");
  let totalMoved = 0, totalBytes = 0;

  for (const board of rows) {
    const nodes = Array.isArray(board.nodes) ? board.nodes : [];
    const before = JSON.stringify(nodes).length;
    const targets = nodes.filter((n) => parseDataUrl(n?.data?.src));
    if (!targets.length) {
      console.log(`  ${board.title.padEnd(22)} nothing inline (${kb(before)})`);
      continue;
    }

    if (WRITE) {
      fs.mkdirSync(BACKUPS, { recursive: true });
      const file = path.join(BACKUPS, `board-${board.id}.json`);
      // Never overwrite an existing backup - the FIRST one is the true original.
      if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ id: board.id, title: board.title, nodes }));
    }

    let moved = 0, bytes = 0;
    for (const n of targets) {
      const parsed = parseDataUrl(n.data.src);
      bytes += parsed.buf.length;
      if (!WRITE) { moved++; continue; }
      const { rows: ins } = await pool.query(
        "INSERT INTO board_images (user_id, mime, bytes, byte_size) VALUES ($1, $2, $3, $4) RETURNING id",
        [board.user_id, parsed.mime, parsed.buf, parsed.buf.length],
      );
      n.data.src = `/api/images/${ins[0].id}`;
      moved++;
    }

    const after = JSON.stringify(nodes).length;
    if (WRITE) await pool.query("UPDATE boards SET nodes = $1 WHERE id = $2", [JSON.stringify(nodes), board.id]);
    console.log(`  ${board.title.padEnd(22)} ${String(moved).padStart(2)} images  ${kb(before)} -> ${WRITE ? kb(after) : "(dry run)"}`);
    totalMoved += moved;
    totalBytes += bytes;
  }

  console.log(`\n${WRITE ? "moved" : "would move"} ${totalMoved} images, ${(totalBytes / 1e6).toFixed(2)} MB out of board JSON`);
  if (WRITE) console.log(`originals saved in ${BACKUPS}/ - undo with --restore <file>`);
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => pool.end());
