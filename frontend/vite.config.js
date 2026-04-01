import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
      },
      '/status': {
        target: 'http://api:8000',
        changeOrigin: true,
        // Only proxy /status/* API calls (not the React route /status/:slug)
        // The React router handles the page render; axios calls go to backend
      },
    },
  },
})
