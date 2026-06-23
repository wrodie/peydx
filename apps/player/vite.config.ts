import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import fs from 'fs'

let gitHash = 'unknown'
try {
  gitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
} catch {}

export default defineConfig({
  define: {
    __GIT_HASH__: JSON.stringify(gitHash),
  },
  plugins: [
    react(),
    {
      name: 'version-json',
      writeBundle() {
        fs.mkdirSync('dist', { recursive: true })
        fs.writeFileSync('dist/version.json', JSON.stringify({ hash: gitHash }))
      },
    },
  ],
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
