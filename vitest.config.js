import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["lib/**", "src/**"],
      // Ratchet: set just below current (lines ~57%, statements ~53%, branches
      // ~52%, functions ~49% under vitest 4's v8 counting) so coverage can only
      // go up. `npm test` runs with --coverage so this is enforced in CI and the
      // CI gate (npm test). Raise these as more of App/Board/Gallery gets covered. The
      // canvas views resist jsdom unit tests; the Playwright e2e suite covers them.
      thresholds: { lines: 55, statements: 52, branches: 50, functions: 47 },
    },
  },
});
