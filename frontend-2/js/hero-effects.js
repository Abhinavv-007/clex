/* ============================================
   CLEX — Hero interactive effects
   Cursor spotlight, magnetic CTAs, tilt cards,
   parallax decorations, reveal-on-scroll.
   ============================================ */

export function initHeroEffects() {
  initSpotlight();
  initMagnetic();
  initTilt();
  initBlobParallax();
  initRevealOnce();
}

function initSpotlight() {
  const heros = document.querySelectorAll('[data-spotlight]');
  if (!heros.length) return;
  heros.forEach((hero) => {
    if (!(hero instanceof HTMLElement)) return;
    /** @param {PointerEvent} e */
    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      hero.style.setProperty('--mx', `${x}%`);
      hero.style.setProperty('--my', `${y}%`);
    };
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--mx', `50%`);
      hero.style.setProperty('--my', `35%`);
    });
  });
}

function initMagnetic() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const targets = document.querySelectorAll('.magnetic');
  targets.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const strength = parseFloat(el.getAttribute('data-magnetic') || '0.25');
    /** @param {PointerEvent} e */
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * strength;
      const dy = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.setProperty('--mag-x', `${dx}px`);
      el.style.setProperty('--mag-y', `${dy}px`);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--mag-x', `0px`);
      el.style.setProperty('--mag-y', `0px`);
    });
  });
}

function initTilt() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const cards = document.querySelectorAll('.tilt-card');
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) return;
    /** @param {PointerEvent} e */
    const onMove = (e) => {
      const r = card.getBoundingClientRect();
      const cx = (e.clientX - r.left) / r.width - 0.5;
      const cy = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--tx', `${cx * 6}deg`);
      card.style.setProperty('--ty', `${-cy * 6}deg`);
    };
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tx', `0deg`);
      card.style.setProperty('--ty', `0deg`);
    });
  });
}

function initBlobParallax() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const blobs = document.querySelectorAll('[data-parallax]');
  if (!blobs.length) return;
  const onScroll = () => {
    const y = window.scrollY;
    blobs.forEach((b) => {
      if (!(b instanceof HTMLElement)) return;
      const speed = parseFloat(b.getAttribute('data-parallax') || '0.15');
      b.style.transform = `translate3d(0, ${y * speed}px, 0)`;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initRevealOnce() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}
