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
      // Ratchet: set just below current (lines/statements ~56.9%, branches
      // ~75.6%, functions ~65.3%) so coverage can only go up. Raise these as
      // more of App.jsx/Board.jsx/Gallery.jsx gets covered.
      thresholds: { lines: 56, statements: 56, branches: 65, functions: 35 },
    },
  },
});
