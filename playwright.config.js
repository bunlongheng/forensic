import "dotenv/config";
import { defineConfig } from "@playwright/test";

// lib/env.js now validates required vars during `vite build` too (not just the
// server), so .env must be loaded into process.env before the webServer command
// spawns - the child process inherits it from here.

// 4336 matches serve.mjs, so a stray sibling app on 4321 is never reused as "the server".
const PORT = process.env.PORT || "4336";
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: BASE, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "api", testMatch: /api\.spec\.js/ },
    { name: "browser", testMatch: /(render|board)\.spec\.js/, use: { browserName: "chromium" } },
  ],
  webServer: {
    // Prod build + prod-like server (NODE_ENV=production via `npm run start`),
    // NOT a dev server: the strict CSP has no 'unsafe-eval', which dev HMR needs,
    // and the local auth bypass is gated OFF under production - so these specs
    // exercise exactly what ships.
    command: "npm run build && npm run start",
    url: `${BASE}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
