/* ==========================================================================
   Clex — a terminal that types its script
   ========================================================================== */

import { reducedMotion, sleep, whileVisible } from './util.js';

/* ── Terminal ───────────────────────────────────────────────────────────
   <div data-terminal>
     <script type="application/json" data-terminal-script>[…]</script>
   Each entry is { cmd } (typed) or { out, tone } (printed). */

/** @param {HTMLElement} root */
export function initTerminal(root) {
  const body = root.querySelector('[data-terminal-body]');
  const scriptEl = root.querySelector('[data-terminal-script]');
  if (!(body instanceof HTMLElement) || !scriptEl) return;
  /** @type {{ cmd?: string, out?: string, tone?: string, wait?: number }[]} */
  let lines = [];
  try { lines = JSON.parse(scriptEl.textContent || '[]'); } catch { return; }
  let run = 0;

  const render = (line, text) => {
    const row = document.createElement('div');
    row.className = line.cmd !== undefined ? 'term__line term__line--cmd' : `term__line term__out term__out--${line.tone || 'plain'}`;
    row.textContent = text;
    body.append(row);
    return row;
  };

  const finished = () => {
    body.textContent = '';
    lines.forEach((l) => render(l, l.cmd ?? l.out ?? ''));
  };

  if (reducedMotion()) {
    finished();
    return;
  }

  const play = async () => {
    const id = ++run;
    const alive = () => id === run;
    body.textContent = '';
    for (const line of lines) {
      if (!alive()) return;
      if (line.cmd !== undefined) {
        const row = render(line, '');
        row.classList.add('is-typing');
        for (const ch of line.cmd) {
          if (!alive()) return;
          row.textContent += ch;
          await sleep(34 + Math.random() * 46);
        }
        row.classList.remove('is-typing');
        await sleep(380);
      } else {
        const row = render(line, line.out || '');
        row.classList.add('is-new');
        await sleep(line.wait ?? 420);
      }
    }
    await sleep(5200);
    if (alive()) void play();
  };

  whileVisible(root, () => void play(), () => { run += 1; finished(); }, 0.4);
}
