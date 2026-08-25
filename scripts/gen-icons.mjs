// Regenerate the full Forensic icon set from the master brand image
// (public/icon-source.png - the red-pins-and-thread evidence-board mark).
// Resizes it to every size the app references, builds favicon.ico, and renders
// the 1200x630 OG/Twitter share card with the icon as its tile.
//
// Run: node scripts/gen-icons.mjs
// Uses sharp from ~/Sites/bheng (not a repo dependency) - dev-only tooling.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require(process.env.HOME + "/Sites/bheng/node_modules/sharp");
const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const SRC = join(pub, "icon-source.png");

const BONE = "#f4f1ea";
const RED = "#ff4438";

const SIZES = {
  "icon-512.png": 512, "icon-192.png": 192, "icon-180.png": 180,
  "apple-touch-icon.png": 180, "icon-96.png": 96, "icon-48.png": 48,
  "icon-32.png": 32, "icon-16.png": 16, "icon.png": 512, "favicon.png": 48,
};

async function buildPngs() {
  for (const [name, size] of Object.entries(SIZES)) {
    await sharp(SRC).resize(size, size).png().toFile(join(pub, name));
  }
  console.log("wrote", Object.keys(SIZES).length, "png icons from icon-source.png");
}

async function buildIco() {
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map((s) => sharp(SRC).resize(s, s).png().toBuffer()));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  const entries = [];
  let offset = 6 + 16 * sizes.length;
  sizes.forEach((s, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(s, 0);
    e.writeUInt8(s, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    entries.push(e);
  });
  writeFileSync(join(pub, "favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));
  console.log("wrote favicon.ico");
}

// 1200x630 dark share card with the icon as a rounded tile.
async function buildOg() {
  const W = 1200, H = 630, TILE = 232;
  let dots = "";
  for (let x = 40; x < W; x += 54)
    for (let y = 40; y < H; y += 54)
      dots += `<circle cx="${x}" cy="${y}" r="2.2" fill="#ffffff" opacity="0.045"/>`;
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#161a21"/><stop offset="100%" stop-color="#0a0c10"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>${dots}
    <text x="96" y="315" font-family="'Space Mono', ui-monospace, monospace" font-size="88" font-weight="700" letter-spacing="6" fill="${BONE}">FORENSIC</text>
    <rect x="100" y="345" width="128" height="8" rx="4" fill="${RED}"/>
    <text x="100" y="405" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="33" font-weight="500" fill="#9aa2ad">An infinite board for pinning evidence and</text>
    <text x="100" y="450" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="33" font-weight="500" fill="#9aa2ad">wiring the connections. Figma-fast, unlimited zoom.</text>
  </svg>`);
  const tile = await sharp(SRC).resize(TILE, TILE).png().toBuffer();
  await sharp(bg)
    .composite([{ input: tile, top: 120, left: W - TILE - 96 }])
    .png()
    .toFile(join(pub, "og.png"));
  console.log("wrote og.png (1200x630 share card)");
}

await buildPngs();
await buildIco();
await buildOg();
console.log("forensic icon set complete");
