/* ============================================
   CLEX — Theme Toggle (Dark / Light)
   Smooth radial reveal originating from the toggle button.
   Uses the View Transitions API where available; falls back
   to a CSS clip-path animation everywhere else.
   ============================================ */

const THEME_KEY = 'clex-theme-v2';
const REVEAL_DURATION_MS = 720;
const REVEAL_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
let revealOverlayActive = false;

export function initTheme() {
  applyTheme(readTheme());
}

/**
 * Toggle the active theme with a circular reveal originating from the
 * cursor (or the theme-toggle button when invoked from keyboard).
 *
 * @param {MouseEvent | KeyboardEvent | Event} [event]
 */
export function toggleTheme(event) {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  const origin = computeOrigin(event);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (reduced) {
    applyTheme(next);
    persistTheme(next);
    return;
  }

  if (typeof document.startViewTransition === 'function') {
    runViewTransitionReveal(next, origin);
  } else {
    runClipPathReveal(next, origin);
  }
  persistTheme(next);
}

/**
 * @param {'dark' | 'light'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    ensureToggleIcons(toggleBtn);
    toggleBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }
}

/**
 * @param {'dark' | 'light'} theme
 */
function persistTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
}

function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Compute the (x, y) viewport coordinates the reveal should expand from.
 * Falls back to the theme-toggle button center, then the top-right corner.
 *
 * @param {MouseEvent | KeyboardEvent | Event | undefined} event
 * @returns {{ x: number; y: number }}
 */
function computeOrigin(event) {
  if (event && 'clientX' in event && Number.isFinite(/** @type {MouseEvent} */ (event).clientX)) {
    return { x: /** @type {MouseEvent} */ (event).clientX, y: /** @type {MouseEvent} */ (event).clientY };
  }
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const rect = btn.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: window.innerWidth - 32, y: 32 };
}

/**
 * @param {{ x: number; y: number }} origin
 */
function maxRadius({ x, y }) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Distance from origin to each corner — pick the farthest.
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

/**
 * Native View-Transition path. The browser snapshots the old DOM, we mutate
 * the theme, then we run a custom keyframe animation on the new snapshot
 * that expands a clip-path circle from the click origin.
 *
 * @param {'dark' | 'light'} next
 * @param {{ x: number; y: number }} origin
 */
function runViewTransitionReveal(next, origin) {
  const { x, y } = origin;
  const r = maxRadius(origin);
  const transition = document.startViewTransition(() => {
    applyTheme(next);
  });
  transition.ready.then(() => {
    document.documentElement.animate(
      [
        { clipPath: `circle(0px at ${x}px ${y}px)` },
        { clipPath: `circle(${r}px at ${x}px ${y}px)` },
      ],
      {
        duration: REVEAL_DURATION_MS,
        easing: REVEAL_EASING,
        pseudoElement: '::view-transition-new(root)',
      },
    );
  }).catch(() => { /* ignore — transition may abort */ });
}

/**
 * Fallback for browsers without the View Transitions API. We render the
 * outgoing theme into a fixed-position overlay, swap the live theme
 * underneath, then animate a clip-path on the overlay so the new theme is
 * revealed from the click origin.
 *
 * @param {'dark' | 'light'} next
 * @param {{ x: number; y: number }} origin
 */
function runClipPathReveal(next, origin) {
  if (revealOverlayActive) {
    applyTheme(next);
    return;
  }
  revealOverlayActive = true;
  const overlay = document.createElement('div');
  overlay.className = 'clex-theme-v2-reveal';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '99999';
  overlay.style.pointerEvents = 'none';
  overlay.style.background = readBgColor();
  overlay.style.clipPath = `circle(${maxRadius(origin)}px at ${origin.x}px ${origin.y}px)`;
  overlay.style.willChange = 'clip-path';
  document.body.appendChild(overlay);

  applyTheme(next);

  // Force reflow so the starting clip-path is committed before we transition.
  void overlay.offsetWidth;
  overlay.style.transition = `clip-path ${REVEAL_DURATION_MS}ms ${REVEAL_EASING}`;
  overlay.style.clipPath = `circle(0px at ${origin.x}px ${origin.y}px)`;

  const cleanup = () => {
    overlay.remove();
    revealOverlayActive = false;
  };
  overlay.addEventListener('transitionend', cleanup, { once: true });
  setTimeout(cleanup, REVEAL_DURATION_MS + 200);
}

function readBgColor() {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--bg-primary').trim() || '#0a0a0a';
}

/** @param {HTMLElement} toggleBtn */
function ensureToggleIcons(toggleBtn) {
  if (toggleBtn.querySelector('.nav__theme-toggle-icon')) return;
  toggleBtn.innerHTML = `
    <svg class="nav__theme-toggle-icon nav__theme-toggle-icon--sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
    <svg class="nav__theme-toggle-icon nav__theme-toggle-icon--moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  `;
}
