import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    include: ['mammoth', 'pdfjs-dist', 'browser-image-compression', 'jszip', 'pdf-lib', 'qrcode'],
  },
  worker: {
    format: 'es',
  },
})
