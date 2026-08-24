// Prod-like local/CI server: serves the built SPA (dist/) AND the same API
// handlers Vercel runs in prod, from one process. This is what `npm run start`
// launches, so e2e tests hit a production build (not a dev server) - matching
// the diagrams app's testing philosophy. One source of truth: the handlers in
// lib/handlers are the exact code the Vercel functions in api/ import.
import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import createBoard from "./lib/handlers/create-board.js";
import listBoards from "./lib/handlers/list-boards.js";
import health from "./lib/handlers/health.js";
import boardById from "./lib/handlers/board-by-id.js";
import authLogin from "./lib/handlers/auth-login.js";
import authCallback from "./lib/handlers/auth-callback.js";
import authMe from "./lib/handlers/auth-me.js";
import authLogout from "./lib/handlers/auth-logout.js";
import { withErrors } from "./lib/wrap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "12mb" }));

// Mirror the prod security headers (vercel.json) so local == prod, including the
// strict CSP with NO 'unsafe-eval' and NO 'unsafe-inline' for scripts. Catches
// CSP regressions before they ship. No CORS: prod (Vercel) sets none either -
// the SPA is same-origin and the public API is called server-side by agents.
app.use((_req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https://avatars.githubusercontent.com; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  );
  next();
});

app.get("/api/auth/login", withErrors(authLogin));
app.get("/api/auth/callback", withErrors(authCallback));
app.get("/api/auth/me", withErrors(authMe));
app.post("/api/auth/logout", withErrors(authLogout));
app.post("/api/ai/boards", withErrors(createBoard));
app.get("/api/boards", withErrors(listBoards));
app.post("/api/boards", withErrors(createBoard));
app.get("/api/health", withErrors(health));
app.all("/api/boards/:id", withErrors(boardById));

// Static SPA + client-side routing fallback.
const dist = path.join(__dirname, "dist");
app.use(express.static(dist));
app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

const PORT = process.env.PORT || 4321;
app.listen(PORT, () => console.log(`forensic server on http://localhost:${PORT}`));
