import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const pkg = JSON.parse(fs.readFileSync('../../package.json', 'utf-8'))
const appVersion = pkg.version

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    {
      name: 'version-json',
      writeBundle() {
        fs.mkdirSync('dist', { recursive: true })
        fs.writeFileSync('dist/version.json', JSON.stringify({ version: appVersion }))
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
