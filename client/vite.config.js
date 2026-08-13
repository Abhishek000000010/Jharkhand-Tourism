import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Where /api requests are proxied. Defaults to the local server; override with
// API_TARGET to point the dev client at a different backend (a second local
// instance, or a deployed staging API).
const apiTarget = process.env.API_TARGET || 'http://localhost:5000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
