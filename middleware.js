import { rewrite, next } from "@vercel/functions";
import { shareBoardId } from "./lib/share.js";

// A link-preview crawler hitting a share link (/?id=<uuid>) must get the OG
// shell; a person must still get the app. A rewrite in vercel.json cannot make
// that call on "/": Vercel resolves the filesystem before the rewrites list, so
// index.html always wins there. Edge Middleware runs before the filesystem,
// which is why this lives here and not in vercel.json. serve.mjs does the same
// for local/CI.

// Root path only, so every other request skips the middleware entirely.
export const config = { matcher: ["/"] };

export default function middleware(req) {
  const id = shareBoardId(req.url, req.headers.get("user-agent"));
  if (!id) return next();
  return rewrite(new URL(`/api/og?id=${id}`, req.url));
}
