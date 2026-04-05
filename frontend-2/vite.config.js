import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));
const r = (/** @type {string} */ value) => resolve(rootDir, value);
const devSlashlessRouteMap = new Map([
  ['/', '/index.html'],
  ['/features', '/features/index.html'],
  ['/how-it-works', '/how-it-works/index.html'],
  ['/workspace', '/workspace/index.html'],
  ['/receive', '/receive/index.html'],
  ['/getting-started', '/getting-started/index.html'],
  ['/faq', '/faq/index.html'],
  ['/privacy', '/privacy/index.html'],
  ['/terms', '/terms/index.html'],
]);

const previewSlashlessRouteMap = new Map([
  ['/', '/index.html'],
  ['/features', '/features'],
  ['/how-it-works', '/how-it-works'],
  ['/workspace', '/workspace'],
  ['/receive', '/receive'],
  ['/getting-started', '/getting-started'],
  ['/faq', '/faq'],
  ['/privacy', '/privacy'],
  ['/terms', '/terms'],
]);

/**
 * @param {string} pathname
 */
function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: (err?: unknown) => void) => void}
 */
function createRouteRewriteMiddleware(routeMap) {
  return (req, _res, next) => {
    if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) {
      next();
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const pathname = normalizePathname(url.pathname);
    const entry = routeMap.get(pathname);

    if (!entry || entry === url.pathname || pathname === url.pathname && url.pathname.endsWith('.html')) {
      next();
      return;
    }

    req.url = `${entry}${url.search}`;
    next();
  };
}

/**
 * @returns {import('vite').Plugin}
 */
function slashlessRoutesPlugin() {
  return /** @type {import('vite').Plugin} */ ({
    name: 'slashless-directory-routes',
    configureServer(server) {
      server.middlewares.use(createRouteRewriteMiddleware(devSlashlessRouteMap));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createRouteRewriteMiddleware(previewSlashlessRouteMap));
    },
  });
}

export default defineConfig({
  appType: 'mpa',
  plugins: [svelte(), slashlessRoutesPlugin()],
  resolve: {
    alias: {
      $components: r('../packages/frontend-core/src/lib/components'),
      $stores: r('../packages/frontend-core/src/lib/stores'),
      $tools: r('../packages/frontend-core/src/lib/tools'),
      $transfer: r('../packages/frontend-core/src/lib/transfer'),
      $utils: r('../packages/frontend-core/src/lib/utils'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: r('index.html'),
        features: r('features/index.html'),
        'how-it-works': r('how-it-works/index.html'),
        workspace: r('workspace/index.html'),
        receive: r('receive/index.html'),
        'getting-started': r('getting-started/index.html'),
        faq: r('faq/index.html'),
        privacy: r('privacy/index.html'),
        terms: r('terms/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
