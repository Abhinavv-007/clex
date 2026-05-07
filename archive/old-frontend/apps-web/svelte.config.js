import adapter from '@sveltejs/adapter-cloudflare'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>'],
      },
    }),
    alias: {
      $components: '../../packages/frontend-core/src/lib/components',
      $stores: '../../packages/frontend-core/src/lib/stores',
      $transfer: '../../packages/frontend-core/src/lib/transfer',
      $tools: '../../packages/frontend-core/src/lib/tools',
      $utils: '../../packages/frontend-core/src/lib/utils',
      $chain: '../../packages/frontend-core/src/lib/chain',
    },
  },
}

export default config
