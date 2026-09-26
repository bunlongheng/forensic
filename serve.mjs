// Prod-like local/CI server: serves the built SPA (dist/) AND the same API
// handlers Vercel runs in prod, from one process. This is what `npm run start`
// launches, so e2e tests hit a production build (not a dev server) - matching
// the diagrams app's testing philosophy. One source of truth: the handlers in
// lib/handlers are the exact code the Vercel functions in api/ import.
import "dotenv/config";
import "./lib/env.js";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { headersFor } from "./lib/headers.js";
import createBoard from "./lib/handlers/create-board.js";
import listBoards from "./lib/handlers/list-boards.js";
import health from "./lib/handlers/health.js";
import { createImage, getImage } from "./lib/handlers/images.js";
import boardById from "./lib/handlers/board-by-id.js";
import authLogin from "./lib/handlers/auth-login.js";
import authCallback from "./lib/handlers/auth-callback.js";
import authMe from "./lib/handlers/auth-me.js";
import authLogout from "./lib/handlers/auth-logout.js";
import { withErrors } from "./lib/wrap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "4.5mb" }));

// Mirror the prod security headers, read from vercel.json itself (lib/headers.js)
// so local == prod and the 2 lists can never drift - they are the SAME list.
// Includes the strict CSP with NO 'unsafe-eval' and NO 'unsafe-inline' for
// scripts, so a CSP regression is caught before it ships. No CORS: prod (Vercel)
// sets none either - the SPA is same-origin and the public API is called
// server-side by agents.
app.use((req, res, next) => {
  for (const [k, v] of Object.entries(headersFor(req.path))) res.setHeader(k, v);
  next();
});

app.get("/api/auth/login", withErrors(authLogin));
app.get("/api/auth/callback", withErrors(authCallback));
app.get("/api/auth/me", withErrors(authMe));
app.post("/api/auth/logout", withErrors(authLogout));
app.post("/api/ai/boards", withErrors(createBoard));
app.get("/api/boards", withErrors(listBoards));
app.post("/api/boards", withErrors((req, res) => createBoard(req, res, { allowBearer: false })));
app.get("/api/health", withErrors(health));
app.post("/api/images", withErrors(createImage));
app.get("/api/images/:id", withErrors(getImage));
app.all("/api/boards/:id", withErrors(boardById));

// Static SPA + client-side routing fallback.
const dist = path.join(__dirname, "dist");
// Hashed build output never changes under its own name, so it is cached for a
// year - same value vercel.json sets for /assets/(.*). express.static writes its
// own Cache-Control, so the option has to be here too or it would overwrite the
// header the middleware above already set.
app.use("/assets", express.static(path.join(dist, "assets"), { immutable: true, maxAge: "1y" }));
app.use(express.static(dist));
app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

// 4336 (not 4321) so it never collides with sibling apps that also default to 4321.
const PORT = process.env.PORT || 4336;
app.listen(PORT, () => console.log(`forensic server on http://localhost:${PORT}`));
