/// <reference types="vitest" />

import path from 'node:path'
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'
import { createFileMiddleware } from './src/data/viteDevFilePlugin'

const weeklyMenuDati = (): Plugin => ({
  name: 'weeklymenu-dati',
  configureServer(server) {
    const dataDir = path.resolve(process.cwd(), 'dati')
    const filePath = path.join(dataDir, 'menu.xlsx')
    server.middlewares.use(createFileMiddleware(filePath, dataDir) as Connect.NextHandleFunction)
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy(),
    weeklyMenuDati()
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})