/**
 * Cloudflare Pages emits `about/index.html` for a `/about` route, which serves
 * at both `/about` and `/about/`. We flatten each page to an extensionless
 * file so there is exactly one canonical URL per route, and emit the
 * `_redirects` / `_headers` that make that work.
 *
 * A route can only be flattened if nothing is nested underneath it — turning
 * `vault/` into a file would orphan `vault/secret` and `vault/share`.
 */
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = resolve(rootDir, 'dist');

/** Leaf routes — flattened to `dist/<route>`. */
const flatRoutes = [
  'features',
  'how-it-works',
  'workspace',
  'receive',
  'chain',
  'developers',
  'account',
  'getting-started',
  'faq',
  'privacy',
  'terms',
  'admin',
];

/** Routes that keep their directory because they have children. */
const nestedRoutes = [
  'vault',
  'vault/secret',
  'vault/share',
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
  ...flattened.map((route) => `/${route}/ /${route} 301`),
  '/vault/secret/* /vault/secret/index.html 200',
  '/vault/share/* /vault/share/index.html 200',
].join('\n');
await writeFile(resolve(distDir, '_redirects'), `${redirects}\n`);

// Extensionless files need an explicit content type.
const headers = [
  ...flattened.map((route) => `/${route}\n  ${HTML_TYPE}`),
  ...nestedRoutes.map((route) => `/${route}/index.html\n  ${HTML_TYPE}`),
].join('\n\n');
await writeFile(resolve(distDir, '_headers'), `${headers}\n`);

console.log(`flatten-pages-output: ${flattened.length} routes flattened, ${nestedRoutes.length} nested`);
