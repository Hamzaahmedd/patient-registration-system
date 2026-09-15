import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Backend REST API (see ../backend). Run the backend on :3000 before `npm run dev` here.
      '/patients': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
