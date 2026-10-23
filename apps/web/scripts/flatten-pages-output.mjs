/**
 * Cloudflare Pages emits `about/index.html` for a `/about` route, which serves
 * at both `/about` and `/about/`. We flatten each page to an extensionless
 * file so there is exactly one canonical URL per route, and emit the
 * `_redirects` / `_headers` that make that work.
 *
 * A route can only be flattened if nothing is nested underneath it — turning
 * `vault/` into a file would orphan `vault/secret`.
 */
import { createHash } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = resolve(rootDir, 'dist');

/** Leaf routes — flattened to `dist/<route>`. */
const flatRoutes = [
  'features',
  'how-it-works',
  'receive',
  'share',
  'chain',
  'developers',
  'account',
  'getting-started',
  'faq',
  'privacy',
  'terms',
  'cookies',
  'admin',
];

/** Routes that keep their directory because they have children. */
const nestedRoutes = [
  'vault/secret',
];

/**
 * Pages that now live inside the landing page. Mirrors `legacyRedirects` in
 * vite.config.js, which applies the same table to the dev and preview servers.
 */
const legacyRedirects = [
  ['/workspace', '/#workspace'],
  ['/vault', '/?mode=vault#workspace'],
];

const HTML_TYPE = 'Content-Type: text/html; charset=utf-8';

const flattened = [];
for (const route of flatRoutes) {
  let html;
  try {
    html = await readFile(resolve(distDir, route, 'index.html'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      // A route listed here but not built is a config drift bug — fail the
      // build rather than silently shipping a 404.
      throw new Error(
        `flatten-pages-output: no dist/${route}/index.html. Either the page ` +
        `was removed (drop it from flatRoutes) or it failed to build.`
      );
    }
    throw err;
  }
  await rm(resolve(distDir, route), { recursive: true, force: true });
  await writeFile(resolve(distDir, route), html);
  flattened.push(route);
}

// Collapse the trailing-slash form onto the canonical one.
const redirects = [
  ...legacyRedirects.flatMap(([from, to]) => [`${from} ${to} 301`, `${from}/ ${to} 301`]),
  ...flattened.map((route) => `/${route}/ /${route} 301`),
  // One page serves every share token; it reads the token from the path.
  '/share/* /share 200',
  '/vault/secret/* /vault/secret/index.html 200',
].join('\n');
await writeFile(resolve(distDir, '_redirects'), `${redirects}\n`);

/**
 * Hardening sent with every response. Cloudflare Pages merges every block
 * whose path matches, so these apply on top of the per-route content types.
 * `frame-ancestors` lives in a CSP of its own so it can be sent site-wide
 * without constraining what the pages themselves load.
 */
const SITE_HEADERS = [
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'X-Frame-Options: SAMEORIGIN',
  "Content-Security-Policy: frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  'Permissions-Policy: interest-cohort=(), browsing-topics=()',
];

/**
 * The operator console gets a full lock-down: it only ever talks to its own
 * origin, is never framed, never cached and never indexed. Its inline scripts
 * (the theme bootstrap) are allowed by hash, computed from the built page so
 * the policy cannot drift from the markup.
 */
async function adminHeaders() {
  const html = String(await readFile(resolve(distDir, 'admin')));
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' https://signal.clex.in",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join('; ');
  return [
    // Pages joins a header named by two matching blocks with a comma, so
    // this second CSP is enforced alongside the site-wide one (a browser
    // applies both) and X-Frame-Options is not repeated: frame-ancestors
    // 'none' already forbids framing.
    `Content-Security-Policy: ${csp}`,
    'Cache-Control: no-store',
    'X-Robots-Tag: noindex, nofollow',
    'Referrer-Policy: no-referrer',
  ];
}

// Extensionless files need an explicit content type.
const headers = [
  `/*\n${SITE_HEADERS.map((h) => `  ${h}`).join('\n')}`,
  ...flattened.map((route) => `/${route}\n  ${HTML_TYPE}`),
  ...nestedRoutes.map((route) => `/${route}/index.html\n  ${HTML_TYPE}`),
  `/admin\n${(await adminHeaders()).map((h) => `  ${h}`).join('\n')}`,
].join('\n\n');
await writeFile(resolve(distDir, '_headers'), `${headers}\n`);

console.log(`flatten-pages-output: ${flattened.length} routes flattened, ${nestedRoutes.length} nested`);
