import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the FastAPI mount prefix in backend/app/main.py ("/admin")
export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  build: { outDir: 'dist' },
  server: { port: 5174 },
})
