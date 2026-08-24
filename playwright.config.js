import { defineConfig } from "@playwright/test";

const PORT = process.env.PORT || "4321";
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: { baseURL: BASE },
  projects: [
    { name: "api", testMatch: /api\.spec\.js/ },
    { name: "browser", testMatch: /render\.spec\.js/, use: { browserName: "chromium" } },
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
