import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    watch: {
      ignored: ['!../../packages/signage-core/**'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
