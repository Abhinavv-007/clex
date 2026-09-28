/* ==========================================================================
   Clex — scenes

   The illustrations that explain the product by doing it. Each one is plain
   markup marked with a data attribute; its module is loaded only on pages
   that have it, and drives it only while it is on screen. With reduced
   motion every scene is shown in its finished state.
   ========================================================================== */

/** selector → [module loader, export name] */
const SCENES = [
  ['[data-statement]', () => import('./statement.js'), 'initStatement'],
  ['[data-flow]', () => import('./flow.js'), 'initFlow'],
  ['[data-lane]', () => import('./lane.js'), 'initLane'],
  ['[data-routes]', () => import('./routes.js'), 'initRoutes'],
  ['[data-nearby]', () => import('./nearby.js'), 'initNearby'],
  ['[data-receipt-scene]', () => import('./receipt.js'), 'initReceiptScene'],
  ['[data-chain-line]', () => import('./chainline.js'), 'initChainLine'],
  ['[data-protocol]', () => import('./protocol.js'), 'initProtocol'],
  ['[data-cipher]', () => import('./cipher.js'), 'initCipher'],
  ['[data-terminal]', () => import('./terminal.js'), 'initTerminal'],
  ['[data-chain-stats]', () => import('./chainstats.js'), 'initChainStats'],
];

export const SCENE_SELECTOR = SCENES.map(([s]) => s).join(', ');

export async function initScenes() {
  await Promise.all(SCENES.map(async ([selector, load, name]) => {
    const els = document.querySelectorAll(selector);
    if (!els.length) return;
    try {
      const mod = await load();
      els.forEach((el) => mod[name](el));
    } catch (err) {
      console.warn(`scene ${selector} did not start:`, err);
    }
  }));
}
