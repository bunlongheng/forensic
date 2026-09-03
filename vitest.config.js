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
      // Ratchet: set just below current (lines ~51%, statements ~47%, branches
      // ~45%, functions ~42% under vitest 4's v8 counting) so coverage can only
      // go up. `npm test` runs with --coverage so this is enforced in CI and the
      // pre-push hook. Raise these as more of App/Board/Gallery gets covered. The
      // canvas views resist jsdom unit tests; the Playwright e2e suite covers them.
      thresholds: { lines: 50, statements: 46, branches: 44, functions: 40 },
    },
  },
});
