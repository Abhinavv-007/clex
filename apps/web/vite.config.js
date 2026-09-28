import { readFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { inkify } from './scripts/handwriting.mjs';

const rootDir = dirname(fileURLToPath(import.meta.url));
const r = (/** @type {string} */ value) => resolve(rootDir, value);
const siteOrigin = 'https://clex.in';
const previewImagePath = '/brand/clex-preview.png';
const defaultDescription = 'Clex is a privacy-first file workspace: drop files, prepare them in your browser, and send them straight to another device.';

/**
 * Pages that used to exist on their own and now live inside the landing page.
 * The workspace is the product, so it is the first thing on `/`, and Vault is
 * a mode of that same workspace. Old links and bookmarks keep working.
 * The same table is written to `_redirects` for Cloudflare Pages.
 */
export const legacyRedirects = [
  ['/workspace', '/#workspace'],
  ['/vault', '/?mode=vault#workspace'],
];

const devSlashlessRouteMap = new Map([
  ['/', '/index.html'],
  ['/features', '/features/index.html'],
  ['/how-it-works', '/how-it-works/index.html'],
  ['/receive', '/receive/index.html'],
  ['/share', '/share/index.html'],
  ['/chain', '/chain/index.html'],
  ['/developers', '/developers/index.html'],
  ['/account', '/account/index.html'],
  ['/getting-started', '/getting-started/index.html'],
  ['/faq', '/faq/index.html'],
  ['/privacy', '/privacy/index.html'],
  ['/terms', '/terms/index.html'],
  ['/cookies', '/cookies/index.html'],
  ['/vault/secret', '/vault/secret/index.html'],
  ['/admin', '/admin/index.html'],
]);

const previewSlashlessRouteMap = new Map([
  ['/', '/index.html'],
  ['/features', '/features'],
  ['/how-it-works', '/how-it-works'],
  ['/receive', '/receive'],
  ['/share', '/share'],
  ['/chain', '/chain'],
  ['/developers', '/developers'],
  ['/account', '/account'],
  ['/getting-started', '/getting-started'],
  ['/faq', '/faq'],
  ['/privacy', '/privacy'],
  ['/terms', '/terms'],
  ['/cookies', '/cookies'],
  // Nested routes keep their directory in dist (see flatten-pages-output.mjs),
  // so they must point at the file: `vite preview` does not resolve a
  // directory index by itself the way Cloudflare Pages does.
  ['/vault/secret', '/vault/secret/index.html'],
  ['/admin', '/admin'],
]);

/**
 * Route prefixes whose every sub-path is served by one page, e.g.
 * `/share/K9M3JX72A8DR` → the share page, which reads the token from the URL.
 */
const devPrefixRoutes = [
  ['/share/', '/share/index.html'],
  ['/vault/secret/', '/vault/secret/index.html'],
];
const previewPrefixRoutes = [
  ['/share/', '/share'],
  ['/vault/secret/', '/vault/secret/index.html'],
];

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
 * Shared page chrome and shared scenes.
 *
 * Every page used to carry its own copy of the head, the nav and the footer,
 * and the copies had drifted: different nav items, different footers (one of
 * them patched at runtime by JS), different font requests. Pages now mark
 * where shared markup goes and this plugin fills it in from `partials/`, in
 * dev and at build, before Vite processes the HTML — so the stylesheets and
 * the entry script it injects are bundled like any hand-written tag.
 *
 *   <!-- @head -->    fonts, theme bootstrap, shared CSS, the entry script
 *   <!-- @nav -->     the site navigation, with the current page marked
 *   <!-- @footer -->  the site footer
 *   <!-- @name -->    any other partials/name.html (illustrations used on
 *                     more than one page)
 *
 * A marker naming a partial that does not exist fails loudly rather than
 * shipping an empty hole.
 *
 * @returns {import('vite').Plugin}
 */
function partialsPlugin() {
  const read = (/** @type {string} */ name) => readFileSync(r(`partials/${name}.html`), 'utf8');

  return /** @type {import('vite').Plugin} */ ({
    name: 'clex-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = html.match(/<body[^>]*data-page="([^"]+)"/)?.[1] ?? '';
        const expand = (/** @type {string} */ source, depth = 0) =>
          source.replace(/<!-- @([a-z0-9-]+) -->/g, (_, name) => {
            let partial;
            try {
              partial = read(name);
            } catch {
              throw new Error(`clex-partials: ${ctx.filename} uses <!-- @${name} --> but partials/${name}.html does not exist`);
            }
            if (name === 'nav') {
              partial = partial.replace(
                new RegExp(`(<a[^>]*data-nav="${page}")`, 'g'),
                '$1 aria-current="page"',
              );
            }
            return depth < 3 ? expand(partial, depth + 1) : partial;
          });
        // Every <span class="script"> becomes handwriting (scripts/handwriting.mjs).
        return inkify(expand(html));
      },
    },
    handleHotUpdate({ file, server }) {
      if (file.includes('/partials/') || file.endsWith('handwriting.mjs')) server.ws.send({ type: 'full-reload' });
    },
  });
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
          { tag: 'meta', attrs: { name: 'theme-color', content: '#f2eee7', media: '(prefers-color-scheme: light)' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'theme-color', content: '#121210', media: '(prefers-color-scheme: dark)' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'canonical', href: canonicalUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:site_name', content: 'Clex' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:type', content: 'website' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:url', content: canonicalUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image', content: imageUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image:alt', content: 'Clex — move files, keep control' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:title', content: title }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:description', content: description }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:image', content: imageUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:image:alt', content: 'Clex — move files, keep control' }, injectTo: 'head' },
        ],
      };
    },
  });
}

/**
 * @param {Map<string, string>} routeMap
 * @param {string[][]} prefixRoutes
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: (err?: unknown) => void) => void}
 */
function createRouteRewriteMiddleware(routeMap, prefixRoutes) {
  return (req, res, next) => {
    if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) {
      next();
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const pathname = normalizePathname(url.pathname);

    const legacy = legacyRedirects.find(([from]) => from === pathname);
    if (legacy) {
      // Keep any query the old link carried (e.g. /vault?mode=…).
      const [target, hash = ''] = legacy[1].split('#');
      const dest = new URL(target, 'http://localhost');
      url.searchParams.forEach((value, key) => dest.searchParams.set(key, value));
      res.statusCode = 302;
      res.setHeader('Location', `${dest.pathname}${dest.search}${hash ? `#${hash}` : ''}`);
      res.end();
      return;
    }

    const prefix = prefixRoutes.find(([p]) => url.pathname.startsWith(p) && url.pathname.length > p.length);
    if (prefix && !/\.[a-z0-9]+$/i.test(url.pathname)) {
      req.url = `${prefix[1]}${url.search}`;
      next();
      return;
    }

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
      server.middlewares.use(createRouteRewriteMiddleware(devSlashlessRouteMap, devPrefixRoutes));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createRouteRewriteMiddleware(previewSlashlessRouteMap, previewPrefixRoutes));
    },
  });
}

export default defineConfig({
  appType: 'mpa',

  // Every browser-visible variable in this project is named PUBLIC_*, and the
  // .env examples and docs have always said so — but Vite only exposes vars
  // matching envPrefix, which defaults to VITE_. Without this line each
  // `import.meta.env.PUBLIC_*` read is undefined and silently falls back to a
  // hardcoded default, so setting any of them had no effect. Production kept
  // working only because those defaults are the production values.
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [partialsPlugin(), svelte(), slashlessRoutesPlugin(), socialMetaPlugin()],
  resolve: {
    alias: {
      $components: r('../../packages/frontend-core/src/lib/components'),
      $stores: r('../../packages/frontend-core/src/lib/stores'),
      $tools: r('../../packages/frontend-core/src/lib/tools'),
      $transfer: r('../../packages/frontend-core/src/lib/transfer'),
      $utils: r('../../packages/frontend-core/src/lib/utils'),
      $chain: r('../../packages/frontend-core/src/lib/chain'),
      $lib: r('../../packages/frontend-core/src/lib'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: r('index.html'),
        features: r('features/index.html'),
        'how-it-works': r('how-it-works/index.html'),
        receive: r('receive/index.html'),
        share: r('share/index.html'),
        chain: r('chain/index.html'),
        developers: r('developers/index.html'),
        account: r('account/index.html'),
        'getting-started': r('getting-started/index.html'),
        faq: r('faq/index.html'),
        privacy: r('privacy/index.html'),
        terms: r('terms/index.html'),
        cookies: r('cookies/index.html'),
        'vault-secret': r('vault/secret/index.html'),
        admin: r('admin/index.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    // Opt-in: point same-origin API calls at a running worker, e.g.
    //   CLEX_VAULT_ORIGIN=http://127.0.0.1:8787 pnpm dev:web
    // so the share page, the developer key panel and the footer status work
    // locally. Off by default, so dev never writes to production.
    proxy: {
      ...(process.env.CLEX_VAULT_ORIGIN ? { '/vault/api': { target: process.env.CLEX_VAULT_ORIGIN, changeOrigin: true } } : {}),
      ...(process.env.CLEX_CHAIN_ORIGIN ? { '/chain/': { target: process.env.CLEX_CHAIN_ORIGIN, changeOrigin: true } } : {}),
    },
  },
  preview: {
    host: '0.0.0.0',
  },
});
