import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Fail the production build if required env vars are missing (see lib/env.js).
import './lib/env.js'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4321',
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
