import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = resolve(rootDir, 'dist');
const flatRoutes = [
  'features',
  'how-it-works',
  'workspace',
  'receive',
  'chain',
  'getting-started',
  'faq',
  'privacy',
  'terms',
];

for (const route of flatRoutes) {
  const html = await readFile(resolve(distDir, route, 'index.html'));
  await rm(resolve(distDir, route), { recursive: true, force: true });
  await writeFile(resolve(distDir, route), html);
}

const redirects = flatRoutes
  .flatMap((route) => [`/${route}/ /${route} 301`])
  .concat([
    '/vault/secret/* /vault/secret/index.html 200',
    '/vault/share/* /vault/share/index.html 200',
  ])
  .join('\n');

await writeFile(resolve(distDir, '_redirects'), `${redirects}\n`);

const headers = flatRoutes
  .map((route) => `/${route}\n  Content-Type: text/html; charset=utf-8`)
  .concat([
    '/vault/index.html\n  Content-Type: text/html; charset=utf-8',
    '/vault/secret/index.html\n  Content-Type: text/html; charset=utf-8',
    '/vault/share/index.html\n  Content-Type: text/html; charset=utf-8',
  ])
  .join('\n\n');

await writeFile(resolve(distDir, '_headers'), `${headers}\n`);
