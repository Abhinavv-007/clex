/**
 * Handwritten words for the apps.
 *
 * The Svelte apps (the workspace header, the empty Vault) show a few words in
 * the same hand as the site. They cannot trace a font in the browser, so the
 * markup is built here, once, into packages/frontend-core/src/lib/hand/words.json.
 * Run it after changing the list or the hand:
 *
 *   node apps/web/scripts/hand-words.mjs
 *
 * site.test.ts fails if the file is out of date.
 */
import { writeFileSync } from 'node:fs';
import { inkWord } from './handwriting.mjs';

/** Every handwritten word the apps use. */
export const APP_WORDS = ['workspace', 'vault', 'here', 'yours alone'];

export const OUT = new URL('../../../packages/frontend-core/src/lib/hand/words.json', import.meta.url);

/** The markup for each word, with __ID__ where each instance puts its own id. */
export function buildWords() {
  /** @type {Record<string, string>} */
  const words = {};
  for (const text of APP_WORDS) {
    words[text] = inkWord(text, { scale: 1, uid: '__ID__' });
  }
  return `${JSON.stringify(words, null, 2)}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(OUT, buildWords());
  console.log(`wrote ${APP_WORDS.length} words to ${OUT.pathname}`);
}
