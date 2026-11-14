import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev server for the Chrome Web Store asset harness (store/demo). It renders
// the real UI against sample data; see store/README.md.
export default defineConfig({
  root: resolve(__dirname, 'store/demo'),
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: { port: 5199, strictPort: true },
})
