import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [new URL('./src/__tests__/setup.ts', import.meta.url).pathname],
  },
})
