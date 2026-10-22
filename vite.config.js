import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api to the Flask backend so the session cookie stays same-origin.
    // 127.0.0.1 rather than localhost: Node may resolve localhost to IPv6, which Flask doesn't bind.
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
})
