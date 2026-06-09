import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['sync/__tests__/**/*.test.ts'],
  },
})
