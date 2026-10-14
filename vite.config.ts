import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The proxy forwards any /api request to the FastAPI backend.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})