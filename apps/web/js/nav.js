/* ==========================================================================
   Clex — navigation

   · frosts once the page scrolls under it (with hysteresis, so it never
     flickers when a scroll comes to rest right on the threshold)
   · a single pill glides to whichever link the pointer is over
   · on small screens, a sheet with the links staggered in
   · every "Start sharing" link scrolls to the workspace when it is on this
     page, instead of reloading it
   ========================================================================== */

export function initNav() {
  const nav = document.getElementById('site-nav');
  if (!nav) return;

  initScrollState(nav);
  initGlider(nav);
  initSheet(nav);
}

/** @param {HTMLElement} nav */
function initScrollState(nav) {
  const ENTER = 40;
  const LEAVE = 12;
  let scrolled = false;
  let frame = 0;

  const darks = [...document.querySelectorAll('.tone-dark')];
  const bar = nav.querySelector('.nav__bar');

  const update = () => {
    frame = 0;
    const y = window.scrollY;
    if (!scrolled && y > ENTER) {
      scrolled = true;
      nav.classList.add('nav--scrolled');
    } else if (scrolled && y < LEAVE) {
      scrolled = false;
      nav.classList.remove('nav--scrolled');
    }

    // Take the dark tone while a dark section sits under the bar.
    if (darks.length && bar) {
      const b = bar.getBoundingClientRect();
      const mid = b.top + b.height / 2;
      const over = darks.some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= mid && r.bottom >= mid && r.left <= b.left + 40 && r.right >= b.right - 40;
      });
      nav.classList.toggle('nav--on-dark', over);
    }
  };

  const request = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request, { passive: true });
  update();
}

/** @param {HTMLElement} nav */
function initGlider(nav) {
  const links = nav.querySelector('.nav__links');
  if (!(links instanceof HTMLElement)) return;

  /** @param {HTMLElement} link */
  const moveTo = (link) => {
    const box = link.getBoundingClientRect();
    const parent = links.getBoundingClientRect();
    links.style.setProperty('--glider-x', `${box.left - parent.left}px`);
    links.style.setProperty('--glider-w', `${box.width}px`);
  };

  links.querySelectorAll('.nav__link').forEach((link) => {
    link.addEventListener('pointerenter', () => {
      moveTo(/** @type {HTMLElement} */ (link));
      // Arrive at the first link without sliding in from the left edge.
      if (!links.classList.contains('is-gliding')) {
        const glider = links.querySelector('.nav__glider');
        if (glider instanceof HTMLElement) {
          glider.style.transition = 'opacity 200ms';
          requestAnimationFrame(() => { glider.style.transition = ''; });
        }
      }
      links.classList.add('is-gliding');
    });
  });
  links.addEventListener('pointerleave', () => links.classList.remove('is-gliding'));
}

/** @param {HTMLElement} nav */
function initSheet(nav) {
  const burger = nav.querySelector('.nav__burger');
  const sheet = document.getElementById('nav-sheet');
  if (!(burger instanceof HTMLElement) || !sheet) return;

  sheet.querySelectorAll('.nav__sheet-link').forEach((link, i) => {
    /** @type {HTMLElement} */ (link).style.setProperty('--i', String(i));
  });

  let open = false;

  const setOpen = (/** @type {boolean} */ next) => {
    if (next === open) return;
    open = next;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('nav--open', open);

    if (open) {
      sheet.hidden = false;
      sheet.classList.remove('is-closing');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      sheet.classList.add('is-closing');
      const done = () => {
        if (!open) sheet.hidden = true;
        sheet.classList.remove('is-closing');
      };
      sheet.addEventListener('animationend', done, { once: true });
      setTimeout(done, 320);
    }
  };

  burger.addEventListener('click', () => setOpen(!open));
  sheet.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) setOpen(false);
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
  window.matchMedia('(min-width: 1021px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}

/**
 * Links to the workspace scroll to it when it is on the current page, and
 * links to Vault switch the workspace into Vault mode first.
 */
export function initWorkspaceLinks() {
  const target = document.getElementById('workspace');

  document.querySelectorAll('[data-scroll-workspace], [data-open-vault]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (!target) return; // not on the landing page: follow the link
      event.preventDefault();
      if (link.hasAttribute('data-open-vault')) {
        window.dispatchEvent(new CustomEvent('clex:workspace-mode', { detail: { mode: 'vault' } }));
      }
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', `${location.pathname}${location.search}#workspace`);
    });
  });
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
