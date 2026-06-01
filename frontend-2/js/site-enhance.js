/* ============================================
   CLEX — Site-wide interactive enhancements
   Auto-applied to every page from main.js.
   - Universal magnetic on .btn / .pill-btn
   - Ripple effect on click for buttons + cards
   - Mouse-tilt on .hover-lift cards (subtle)
   - FAQ accordion arrows + keyboard navigation polish
   - Hash-link smooth scroll
   - Spotlight cursor on .card-grid containers
   ============================================ */

export function initSiteEnhance() {
  injectPageHeroDecor();
  upgradePageHeroTitles();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  initUniversalMagnetic();
  initRipples();
  initSmoothHashScroll();
}

/**
 * Inject the cinematic aurora layer + sparkles into every page hero
 * (.features-hero / .faq-hero / .gs-hero / .hiw-hero / .dev-hero / .chain-hero / .legal-hero).
 */
function injectPageHeroDecor() {
  const heroSelectors = [
    '.features-hero',
    '.faq-hero',
    '.gs-hero',
    '.hiw-hero',
    '.dev-hero',
    '.chain-hero',
    '.legal-hero',
  ];
  document.querySelectorAll(heroSelectors.join(',')).forEach((hero) => {
    if (!(hero instanceof HTMLElement)) return;
    if (hero.querySelector('.clex-hero-aurora')) return;
    const layer = document.createElement('div');
    layer.className = 'clex-hero-aurora';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `
      <div class="clex-hero-aurora__noise"></div>
      <span class="clex-hero-aurora__blob clex-hero-aurora__blob--a"></span>
      <span class="clex-hero-aurora__blob clex-hero-aurora__blob--b"></span>
      <span class="clex-hero-aurora__blob clex-hero-aurora__blob--c"></span>
      <span class="clex-hero-aurora__sparkle clex-hero-aurora__sparkle--a">✦</span>
      <span class="clex-hero-aurora__sparkle clex-hero-aurora__sparkle--b">✧</span>
      <span class="clex-hero-aurora__sparkle clex-hero-aurora__sparkle--c">✦</span>
      <span class="clex-hero-aurora__sparkle clex-hero-aurora__sparkle--d">✧</span>
    `;
    hero.insertBefore(layer, hero.firstChild);
  });
}

/**
 * Find every .page-hero__title and the last visible "line" (after the
 * trailing <br>, or last word if no <br>) and wrap it in <em class="italic-accent">.
 * Skips titles already containing an .italic-accent or em.
 */
function upgradePageHeroTitles() {
  document.querySelectorAll('.page-hero__title').forEach((title) => {
    if (!(title instanceof HTMLElement)) return;
    if (title.querySelector('em, .italic-accent')) return;

    const html = title.innerHTML;
    const brIdx = html.lastIndexOf('<br>');
    if (brIdx >= 0) {
      const head = html.slice(0, brIdx + 4);
      const tail = html.slice(brIdx + 4).trim();
      if (tail) title.innerHTML = `${head}<em class="italic-accent">${tail}</em>`;
      return;
    }
    // No <br>: italicize last word.
    const text = title.textContent || '';
    const m = text.match(/^([\s\S]*?)(\S+)\s*$/);
    if (m && m[2]) {
      title.innerHTML = `${escapeHtml(m[1])}<em class="italic-accent">${escapeHtml(m[2])}</em>`;
    }
  });
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/* ---------- Universal magnetic on every primary button ---------- */
function initUniversalMagnetic() {
  const targets = document.querySelectorAll(
    '.btn--primary, .pill-btn--primary, .pill-btn--ghost, .pill-btn--white, .faq-category-btn'
  );
  targets.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.classList.contains('magnetic')) return; // already wired by hero-effects
    const strength = 0.18;
    /** @param {PointerEvent} e */
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * strength;
      const dy = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

/* ---------- Ripple on click ---------- */
function initRipples() {
  const targets = document.querySelectorAll(
    '.btn, .pill-btn, .faq-category-btn, .card, .tool-card, .tip-card'
  );
  /** @param {PointerEvent} ev @param {HTMLElement} el */
  const ripple = (ev, el) => {
    const r = el.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const dot = document.createElement('span');
    dot.className = 'clex-ripple';
    dot.style.cssText = `
      position:absolute;left:${x}px;top:${y}px;
      width:12px;height:12px;border-radius:50%;
      background: currentColor; opacity:0.18;
      transform: translate(-50%, -50%) scale(0);
      pointer-events:none;
      transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 600ms ease;
      z-index: 0;
    `;
    const cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    if (cs.overflow !== 'hidden') el.style.overflow = 'hidden';
    el.appendChild(dot);
    requestAnimationFrame(() => {
      const max = Math.max(r.width, r.height);
      dot.style.transform = `translate(-50%, -50%) scale(${(max / 12) * 2.5})`;
      dot.style.opacity = '0';
    });
    setTimeout(() => dot.remove(), 700);
  };
  targets.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.addEventListener('pointerdown', (e) => ripple(e, el));
  });
}

/* ---------- Subtle 3D tilt on cards (very small) ---------- */
function initSubtleTilt() {
  const cards = document.querySelectorAll('.card.hover-lift, .tool-card, .tip-card, .delivery-flow__node, .dpc-cell');
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) return;
    const max = 4; // degrees
    /** @param {PointerEvent} e */
    const onMove = (e) => {
      const r = card.getBoundingClientRect();
      const cx = (e.clientX - r.left) / r.width - 0.5;
      const cy = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(800px) rotateX(${-cy * max}deg) rotateY(${cx * max}deg) translateZ(0)`;
    };
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });
}

/* ---------- Smooth hash scroll for in-page links ---------- */
function initSmoothHashScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#' || href.length < 2) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}
