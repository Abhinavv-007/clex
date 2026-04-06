import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

const rootDir = dirname(fileURLToPath(import.meta.url))
const r = (value: string) => resolve(rootDir, value)

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $components: r('src/lib/components'),
      $stores: r('src/lib/stores'),
      $tools: r('src/lib/tools'),
      $transfer: r('src/lib/transfer'),
      $utils: r('src/lib/utils'),
      $chain: r('src/lib/chain'),
    },
  },
  optimizeDeps: {
    include: ['mammoth', 'pdfjs-dist', 'browser-image-compression', 'jszip', 'pdf-lib', 'qrcode'],
  },
  build: {
    lib: {
      entry: r('src/index.ts'),
      name: 'ClexFrontendCore',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['svelte'],
    },
  },
  worker: {
    format: 'es',
  },
})
