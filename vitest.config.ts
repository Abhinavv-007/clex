import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const rootDir = dirname(fileURLToPath(import.meta.url))
const r = (value: string) => resolve(rootDir, 'packages/frontend-core', value)

export default defineConfig({
  test: {
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      $components: r('src/lib/components'),
      $stores: r('src/lib/stores'),
      $tools: r('src/lib/tools'),
      $transfer: r('src/lib/transfer'),
      $utils: r('src/lib/utils'),
      $chain: r('src/lib/chain'),
      $lib: r('src/lib'),
    },
  },
})
