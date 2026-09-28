/* ==========================================================================
   Clex — theme

   Light (bone) and dark (charcoal). Until the visitor picks one, the site
   follows the OS. Switching spills the new theme outward from the toggle like
   ink, using a view transition where the browser has one and an instant swap
   where it doesn't.
   ========================================================================== */

const THEME_KEY = 'clex-theme-v3';
const REVEAL_MS = 650;

/** @returns {'light' | 'dark'} */
export function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    return 'light';
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function initTheme() {
  applyTheme(readTheme());

  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  mq?.addEventListener?.('change', (event) => {
    if (hasStoredPreference()) return;
    applyTheme(event.matches ? 'dark' : 'light');
  });

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', (event) => toggleTheme(/** @type {MouseEvent} */ (event)));
  });
}

function hasStoredPreference() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light';
  } catch {
    return false;
  }
}

/** @param {'light' | 'dark'} theme */
function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  });

  // Keep the browser chrome (mobile address bar) in step with the page.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', bg || (theme === 'dark' ? '#121210' : '#f2eee7'));
  });

  window.dispatchEvent(new CustomEvent('clex:theme', { detail: { theme } }));
}

/** @param {MouseEvent} [event] */
export function toggleTheme(event) {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  const commit = () => {
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
  };

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof document.startViewTransition !== 'function') {
    commit();
    return;
  }

  const { x, y } = originOf(event);
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  root.classList.add('theme-switching');
  const transition = document.startViewTransition(commit);
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: REVEAL_MS, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => { /* aborted — the theme is committed either way */ });
  transition.finished.finally(() => root.classList.remove('theme-switching'));
}

/** @param {MouseEvent | undefined} event */
function originOf(event) {
  if (event && Number.isFinite(event.clientX) && (event.clientX || event.clientY)) {
    return { x: event.clientX, y: event.clientY };
  }
  const button = document.querySelector('[data-theme-toggle]');
  if (button) {
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: innerWidth - 40, y: 40 };
}
