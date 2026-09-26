import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ONE source of truth for the response security headers: vercel.json. serve.mjs
// reads that same list at boot instead of keeping its own copy, so local/CI can
// never drift from what Vercel actually sends (it did - X-Robots-Tag only ever
// existed in vercel.json).
const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "vercel.json");
const rules = JSON.parse(fs.readFileSync(configPath, "utf8")).headers || [];

// Every header vercel.json would apply to this path, later rules winning on a
// duplicate key - the same precedence Vercel uses.
export function headersFor(pathname) {
  const out = {};
  for (const rule of rules) {
    if (!new RegExp(`^${rule.source}$`).test(pathname)) continue;
    for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}
