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
  upgradeCursiveLanguage();
  initWritingAccents();
  releaseDesignBoot();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  initUniversalMagnetic();
  initRipples();
  initLiquidInteractives();
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
 * Turn existing page/section title endings into the same colorful handwritten
 * accent language used by the landing page.
 */
function upgradeCursiveLanguage() {
  document.querySelectorAll('.text-accent, .chain-hero__title-accent').forEach((el) => {
    el.classList.add('italic-accent');
  });

  const selectors = [
    '.page-hero__title',
    '.section__title',
    '.page-section__title',
    '.cta-strip__title',
    '.banner__text',
    '.legal-section__title',
    '.faq-section__title',
    '.gs-step__title',
    '.giant-step__title',
    '.chain-explorer__title',
    '.dev-access__title',
  ];

  document.querySelectorAll(selectors.join(',')).forEach((title) => {
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

    const text = title.textContent || '';
    const words = text.trim().split(/\s+/);
    const count = words.length >= 4 ? 2 : 1;
    const accent = words.splice(-count).join(' ');
    const head = words.join(' ');
    if (accent) {
      title.innerHTML = `${head ? `${escapeHtml(head)} ` : ''}<em class="italic-accent">${escapeHtml(accent)}</em>`;
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

function initWritingAccents() {
  const accents = document.querySelectorAll('.italic-accent, .hero__title-word--italic, .text-accent, .chain-hero__title-accent');
  if (!accents.length) return;

  const reveal = (el) => {
    if (!(el instanceof HTMLElement) || el.classList.contains('clex-write--done')) return;
    el.classList.add('clex-write--visible');
    const computedDelay = Number.parseFloat(getComputedStyle(el).getPropertyValue('--write-delay')) || 0;
    const complete = () => {
      el.classList.add('clex-write--done');
    };
    el.addEventListener('animationend', complete, { once: true });
    window.setTimeout(complete, 3150 + computedDelay);
  };

  accents.forEach((accent, index) => {
    if (!(accent instanceof HTMLElement)) return;
    accent.classList.add('clex-write');
    accent.style.setProperty('--write-delay', `${Math.min(index * 70, 520)}ms`);
  });

  document.querySelectorAll('.hero .clex-write, .hero__title-word--italic').forEach(reveal);

  if (!('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    accents.forEach(reveal);
    return;
  }

  const revealVisibleNow = () => {
    accents.forEach((accent) => {
      if (!(accent instanceof HTMLElement) || accent.classList.contains('clex-write--visible')) return;
      const rect = accent.getBoundingClientRect();
      if (rect.bottom >= -160 && rect.top <= window.innerHeight * 1.85) reveal(accent);
    });
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '55% 0px 55% 0px', threshold: 0 });

  accents.forEach((accent) => io.observe(accent));
  requestAnimationFrame(revealVisibleNow);
  [180, 520, 980, 1600, 2600].forEach((delay) => window.setTimeout(revealVisibleNow, delay));
  window.setTimeout(() => {
    document.querySelectorAll('footer .clex-write').forEach(reveal);
  }, 1800);
  window.addEventListener('load', revealVisibleNow, { once: true });
  window.addEventListener('scroll', revealVisibleNow, { passive: true });
  window.addEventListener('resize', revealVisibleNow, { passive: true });
  window.addEventListener('orientationchange', revealVisibleNow, { passive: true });
}

function releaseDesignBoot() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('clex-design-booting');
      document.documentElement.classList.add('clex-design-ready');
    });
  });
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

function initLiquidInteractives() {
  const targets = document.querySelectorAll(
    '.btn, .pill-btn, .faq-category-btn, .card, .tool-card, .tip-card, .dpc-cell, .delivery-flow__node, .vault-spotlight__note, .stat-orb, .accordion__item'
  );
  targets.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    let raf = 0;
    let pos = { x: 50, y: 50 };
    const apply = () => {
      raf = 0;
      el.style.setProperty('--liquid-x', `${pos.x}%`);
      el.style.setProperty('--liquid-y', `${pos.y}%`);
    };
    el.addEventListener('pointermove', (event) => {
      const rect = el.getBoundingClientRect();
      pos = {
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
      };
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
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
