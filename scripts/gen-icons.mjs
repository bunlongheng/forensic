// Regenerate the full Forensic icon set from a single vector source of truth
// (no binary brand asset checked in). Renders the "evidence network" mark - a
// red-thread web of pins on a dark board - to every size the app references,
// plus favicon.ico and the 1200x630 OG/Twitter share card.
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

const BONE = "#f4f1ea";
const RED = "#ff4438";

// A gently sagging thread (quadratic curve) between two pins.
function thread(x1, y1, x2, y2, sag) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  return `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${RED}" stroke-width="11" stroke-linecap="round" opacity="0.92"/>`;
}

function pin(cx, cy, r, center) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${BONE}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.42}" fill="${center}"/>`;
}

// Dot-grid board texture.
function dots() {
  let d = "";
  for (let x = 56; x < 512; x += 52)
    for (let y = 56; y < 512; y += 52)
      d += `<circle cx="${x}" cy="${y}" r="2.4" fill="#ffffff" opacity="0.05"/>`;
  return d;
}

// 512x512 master mark.
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b1f27"/>
      <stop offset="100%" stop-color="#0b0d11"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="3" y="3" width="506" height="506" rx="110" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="2"/>
  ${dots()}
  <g filter="url(#s)">
    ${thread(256, 186, 150, 344, 40)}
    ${thread(256, 186, 256, 372, 34)}
    ${thread(256, 186, 362, 344, 40)}
    ${pin(150, 344, 30, "#2b313d")}
    ${pin(256, 372, 30, "#2b313d")}
    ${pin(362, 344, 30, "#2b313d")}
    ${pin(256, 186, 42, RED)}
  </g>
</svg>`;

// 1200x630 share card.
function ogCard() {
  let d = "";
  for (let x = 40; x < 1200; x += 54)
    for (let y = 40; y < 630; y += 54)
      d += `<circle cx="${x}" cy="${y}" r="2.2" fill="#ffffff" opacity="0.045"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#161a21"/>
        <stop offset="100%" stop-color="#0a0c10"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    ${d}
    <text x="96" y="300" font-family="'Space Mono', ui-monospace, monospace" font-size="92" font-weight="700" letter-spacing="6" fill="${BONE}">FORENSIC</text>
    <rect x="100" y="330" width="132" height="8" rx="4" fill="${RED}"/>
    <text x="100" y="392" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="34" font-weight="500" fill="#9aa2ad">An infinite board for pinning evidence and</text>
    <text x="100" y="440" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="34" font-weight="500" fill="#9aa2ad">wiring the connections. Figma-fast, unlimited zoom.</text>
  </svg>`;
}

const SIZES = {
  "icon-512.png": 512, "icon-192.png": 192, "icon-180.png": 180,
  "apple-touch-icon.png": 180, "icon-96.png": 96, "icon-48.png": 48,
  "icon-32.png": 32, "icon-16.png": 16, "icon.png": 512, "favicon.png": 48,
};

async function buildPngs() {
  const master = Buffer.from(MARK);
  for (const [name, size] of Object.entries(SIZES)) {
    await sharp(master).resize(size, size).png().toFile(join(pub, name));
  }
  console.log("wrote", Object.keys(SIZES).length, "png icons");
}

async function buildIco() {
  const sizes = [16, 32, 48];
  const master = Buffer.from(MARK);
  const pngs = await Promise.all(sizes.map((s) => sharp(master).resize(s, s).png().toBuffer()));
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

async function buildOg() {
  await sharp(Buffer.from(ogCard())).png().toFile(join(pub, "og.png"));
  console.log("wrote og.png");
}

await buildPngs();
await buildIco();
await buildOg();
console.log("forensic icon set complete");
