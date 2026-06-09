import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [new URL('./src/__tests__/setup.ts', import.meta.url).pathname],
  },
  resolve: {
    alias: {
      'signage-core': resolve(__dirname, 'src'),
    },
  },
})
