import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Fail the production build if required env vars are missing (see lib/env.js).
import './lib/env.js'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forensic's own API port (4336) - kept off 4321 so it never collides with
      // the sibling apps (system-design / drop) that also default to 4321.
      '/api': {
        target: 'http://localhost:4336',
        changeOrigin: true,
      },
    },
  },
  build: {
    // No manualChunks for @xyflow/react: it is only ever imported by the lazy
    // Board view, so the default splitter already keeps it out of the entry
    // chunk. A named manual chunk here used to force it into a chunk that
    // rolldown then statically modulepreloaded from index.html, defeating
    // the lazy Board split (198 kB fetched on sign-in/gallery for nothing).
    modulePreload: { polyfill: false },
  },
})
