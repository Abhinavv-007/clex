import { dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));
const r = (/** @type {string} */ value) => resolve(rootDir, value);
const siteOrigin = 'https://clex.in';
const previewImagePath = '/brand/clex-preview.png';
const defaultDescription = 'Clex is a privacy-first file workspace for direct P2P transfer, local network delivery, and Google Drive fallback.';
const devSlashlessRouteMap = new Map([
  ['/', '/index.html'],
  ['/features', '/features/index.html'],
  ['/how-it-works', '/how-it-works/index.html'],
  ['/workspace', '/workspace/index.html'],
  ['/receive', '/receive/index.html'],
  ['/chain', '/chain/index.html'],
  ['/getting-started', '/getting-started/index.html'],
  ['/faq', '/faq/index.html'],
  ['/privacy', '/privacy/index.html'],
  ['/terms', '/terms/index.html'],
  ['/vault', '/vault/index.html'],
  ['/vault/secret', '/vault/secret/index.html'],
  ['/vault/share', '/vault/share/index.html'],
]);

const previewSlashlessRouteMap = new Map([
  ['/', '/index.html'],
  ['/features', '/features'],
  ['/how-it-works', '/how-it-works'],
  ['/workspace', '/workspace'],
  ['/receive', '/receive'],
  ['/chain', '/chain'],
  ['/getting-started', '/getting-started'],
  ['/faq', '/faq'],
  ['/privacy', '/privacy'],
  ['/terms', '/terms'],
  ['/vault', '/vault'],
  ['/vault/secret', '/vault/secret'],
  ['/vault/share', '/vault/share'],
]);

/**
 * @param {string} pathname
 */
function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * @param {string | undefined} rawPath
 */
function normalizeHtmlRoute(rawPath) {
  if (!rawPath) return '/';

  const [pathname] = rawPath.split('?');
  let normalized = pathname.replace(/\\/g, '/');

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  if (normalized.endsWith('/index.html')) {
    normalized = normalized.slice(0, -'/index.html'.length) || '/';
  } else if (normalized === '/index.html') {
    normalized = '/';
  } else if (normalized.endsWith('.html')) {
    normalized = normalized.slice(0, -'.html'.length) || '/';
  }

  return normalizePathname(normalized);
}

/**
 * @param {string} html
 */
function extractTitle(html) {
  const match = html.match(/<title>(.*?)<\/title>/i);
  return match?.[1]?.trim() ?? 'Clex';
}

/**
 * @param {string} html
 */
function extractDescription(html) {
  const match = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return match?.[1]?.trim() ?? defaultDescription;
}

/**
 * @returns {import('vite').Plugin}
 */
function socialMetaPlugin() {
  return /** @type {import('vite').Plugin} */ ({
    name: 'clex-social-meta',
    transformIndexHtml(html, ctx) {
      const routeFromPath = ctx?.path ? normalizeHtmlRoute(ctx.path) : null;
      const routeFromFilename = ctx?.filename
        ? normalizeHtmlRoute(relative(rootDir, ctx.filename))
        : '/';
      const route = routeFromPath || routeFromFilename || '/';
      const canonicalUrl = `${siteOrigin}${route === '/' ? '' : route}`;
      const title = extractTitle(html);
      const description = extractDescription(html);
      const imageUrl = `${siteOrigin}${previewImagePath}`;

      return {
        html,
        tags: [
          { tag: 'meta', attrs: { name: 'theme-color', content: '#e9e0d2' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'canonical', href: canonicalUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:site_name', content: 'Clex' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:type', content: 'website' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:url', content: canonicalUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image', content: imageUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image:alt', content: 'Clex landing page preview showing the Drop Prepare Share workspace interface' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:title', content: title }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:description', content: description }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:image', content: imageUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:image:alt', content: 'Clex landing page preview showing the Drop Prepare Share workspace interface' }, injectTo: 'head' },
        ],
      };
    },
  });
}

/**
 * @param {Map<string, string>} routeMap
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
  plugins: [svelte(), slashlessRoutesPlugin(), socialMetaPlugin()],
  resolve: {
    alias: {
      $components: r('../packages/frontend-core/src/lib/components'),
      $stores: r('../packages/frontend-core/src/lib/stores'),
      $tools: r('../packages/frontend-core/src/lib/tools'),
      $transfer: r('../packages/frontend-core/src/lib/transfer'),
      $utils: r('../packages/frontend-core/src/lib/utils'),
      $chain: r('../packages/frontend-core/src/lib/chain'),
      $lib: r('../packages/frontend-core/src/lib'),
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
        chain: r('chain/index.html'),
        'getting-started': r('getting-started/index.html'),
        faq: r('faq/index.html'),
        privacy: r('privacy/index.html'),
        terms: r('terms/index.html'),
        vault: r('vault/index.html'),
        'vault-secret': r('vault/secret/index.html'),
        'vault-share': r('vault/share/index.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
  },
  preview: {
    host: '0.0.0.0',
  },
});
