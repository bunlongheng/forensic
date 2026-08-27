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
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@xyflow/react')) return 'reactflow'
        },
      },
    },
  },
})
