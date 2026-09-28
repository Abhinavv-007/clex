/* ==========================================================================
   Clex — shared motion and small interactions

   Everything here is declarative: markup opts in with a data attribute and
   this module wires it up. Nothing hides content before JS has run (see the
   `.js` guard in motion.css), and reduced motion gets the end state at once.
   ========================================================================== */

export const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function initMotion(root = document) {
  initSplit(root);
  initStagger(root);
  initReveal(root);
  initCounters(root);
  initLitCards();
  initTabs(root);
  initCopy(root);
  initAccordions(root);
}

/* ── Accordions ─────────────────────────────────────────────────────────
   <details class="qa"> opens and closes by animating its body's grid row
   from 0fr to 1fr. A native <details> removes its content the instant it
   closes, so closing is held open until the row has collapsed. */

function initAccordions(root) {
  root.querySelectorAll('details.qa').forEach((el) => {
    const details = /** @type {HTMLDetailsElement} */ (el);
    const summary = details.querySelector('summary');
    const body = details.querySelector('.qa__body');
    if (!summary || !body) return;

    summary.addEventListener('click', (event) => {
      if (reducedMotion()) return;
      event.preventDefault();
      if (!details.open) {
        details.classList.add('is-opening');
        details.open = true;
        requestAnimationFrame(() => requestAnimationFrame(() => details.classList.remove('is-opening')));
      } else if (!details.classList.contains('is-closing')) {
        details.classList.add('is-closing');
        const done = () => {
          if (!details.classList.contains('is-closing')) return;
          details.classList.remove('is-closing');
          details.open = false;
        };
        body.addEventListener('transitionend', done, { once: true });
        setTimeout(done, 480);
      }
    });
  });
}

/* ── Reveal ─────────────────────────────────────────────────────────────── */

/** @type {IntersectionObserver | null} */
let revealObserver = null;

function getRevealObserver() {
  if (revealObserver) return revealObserver;
  revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      entry.target.dispatchEvent(new CustomEvent('reveal'));
      revealObserver?.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  return revealObserver;
}

/** Observe anything that reveals: [data-reveal], [data-split], [data-write]. */
function initReveal(root) {
  const targets = root.querySelectorAll('[data-reveal], [data-split]');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = getRevealObserver();
  targets.forEach((el) => io.observe(el));
}

/** Children of [data-stagger] reveal one after another. */
function initStagger(root) {
  root.querySelectorAll('[data-stagger]').forEach((group) => {
    const step = Number(group.getAttribute('data-stagger')) || 80;
    const base = Number(group.getAttribute('data-stagger-base')) || 0;
    let i = 0;
    for (const child of group.children) {
      if (!(child instanceof HTMLElement)) continue;
      if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', '');
      child.style.setProperty('--d', String(base + i * step));
      i += 1;
    }
  });
}

/* ── Split headings ─────────────────────────────────────────────────────── */

/**
 * Wraps each word in `.split-word > span` so it can rise out of its own clip.
 * Inline elements inside the heading (a .script accent, a <br>) are kept as
 * they are; a <br> stays a line break and an element counts as one word.
 */
function initSplit(root) {
  root.querySelectorAll('[data-split]').forEach((el) => {
    if (el.hasAttribute('data-split-done')) return;
    el.setAttribute('data-split-done', '');
    const label = el.textContent?.replace(/\s+/g, ' ').trim();
    if (label && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', label);

    let index = 0;
    const wrap = (/** @type {Node} */ node) => {
      const outer = document.createElement('span');
      outer.className = 'split-word';
      outer.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.style.setProperty('--w', String(index++));
      outer.append(inner);
      inner.append(node);
      return outer;
    };

    for (const node of [...el.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE) {
        const parts = (node.textContent || '').split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) frag.append(document.createTextNode(' '));
          else frag.append(wrap(document.createTextNode(part)));
        }
        node.replaceWith(frag);
      } else if (node instanceof HTMLElement && node.classList.contains('ink-word')) {
        // Handwriting is not clipped into a rising word: its flourishes
        // reach past the line. It writes itself once its line has risen.
        if (!node.dataset.delay) node.dataset.delay = String(index * 70 + 420);
      } else if (node instanceof HTMLElement && node.tagName !== 'BR') {
        node.replaceWith(wrap(node.cloneNode(true)));
      }
    }
  });
}

/* ── Counters ───────────────────────────────────────────────────────────── */

function initCounters(root) {
  const els = root.querySelectorAll('[data-count]');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      countUp(/** @type {HTMLElement} */ (entry.target));
    }
  }, { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
}

/** @param {HTMLElement} el */
export function countUp(el, to = Number(el.dataset.count)) {
  const decimals = Number(el.dataset.decimals || 0);
  const suffix = el.dataset.suffix || '';
  const format = (/** @type {number} */ n) =>
    `${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  if (!Number.isFinite(to)) return;
  if (reducedMotion() || to === 0) {
    el.textContent = format(to);
    return;
  }
  const from = Number(el.dataset.from || 0);
  const duration = Math.min(1800, 700 + Math.log10(Math.abs(to - from) + 1) * 350);
  const start = performance.now();
  const tick = (/** @type {number} */ now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    el.textContent = format(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ── Pointer-lit cards ──────────────────────────────────────────────────── */

let litBound = false;
function initLitCards() {
  if (litBound || !window.matchMedia('(hover: hover)').matches) return;
  litBound = true;
  let frame = 0;
  /** @type {PointerEvent | null} */
  let last = null;
  document.addEventListener('pointermove', (event) => {
    last = event;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const card = last?.target instanceof Element ? last.target.closest('.card--lit') : null;
      if (!(card instanceof HTMLElement) || !last) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${last.clientX - box.left}px`);
      card.style.setProperty('--my', `${last.clientY - box.top}px`);
    });
  }, { passive: true });
}

/* ── Tabs ───────────────────────────────────────────────────────────────── */

/**
 * <div data-tabs>
 *   <div class="tabs" role="tablist"> <span class="tabs__pill"></span>
 *     <button class="tabs__btn" role="tab" aria-controls="panel-a">…</button> …
 *   </div>
 *   <div id="panel-a" role="tabpanel">…</div> …
 * </div>
 */
function initTabs(root) {
  root.querySelectorAll('[data-tabs]').forEach((group) => {
    const list = group.querySelector('.tabs');
    const pill = group.querySelector('.tabs__pill');
    const buttons = [...group.querySelectorAll('.tabs__btn')];
    if (!list || !buttons.length) return;

    const place = (/** @type {Element} */ btn) => {
      if (!(pill instanceof HTMLElement) || !(btn instanceof HTMLElement)) return;
      pill.style.setProperty('--pill-x', `${btn.offsetLeft - 3}px`);
      pill.style.setProperty('--pill-w', `${btn.offsetWidth}px`);
    };

    const select = (/** @type {Element} */ btn, focus = false) => {
      for (const b of buttons) {
        const on = b === btn;
        b.setAttribute('aria-selected', String(on));
        b.setAttribute('tabindex', on ? '0' : '-1');
        const panel = document.getElementById(b.getAttribute('aria-controls') || '');
        if (panel) panel.hidden = !on;
      }
      place(btn);
      if (focus && btn instanceof HTMLElement) btn.focus();
      group.dispatchEvent(new CustomEvent('tabchange', { detail: { id: btn.getAttribute('aria-controls') } }));
    };

    buttons.forEach((btn, i) => {
      btn.addEventListener('click', () => select(btn));
      btn.addEventListener('keydown', (event) => {
        const key = /** @type {KeyboardEvent} */ (event).key;
        if (key !== 'ArrowRight' && key !== 'ArrowLeft') return;
        const next = buttons[(i + (key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
        select(next, true);
      });
    });

    const initial = buttons.find((b) => b.getAttribute('aria-selected') === 'true') || buttons[0];
    select(initial);
    // Fonts change the button widths once they load.
    document.fonts?.ready.then(() => place(buttons.find((b) => b.getAttribute('aria-selected') === 'true') || initial));
    window.addEventListener('resize', () => place(buttons.find((b) => b.getAttribute('aria-selected') === 'true') || initial));
  });
}

/* ── Copy ───────────────────────────────────────────────────────────────── */

/**
 * <button data-copy="#code-id">  copies the text of that element
 * <button data-copy-text="…">    copies the literal text
 */
function initCopy(root) {
  root.querySelectorAll('[data-copy], [data-copy-text]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const selector = btn.getAttribute('data-copy');
      let text = btn.getAttribute('data-copy-text') || '';
      if (selector) {
        const scope = btn.closest('[data-tabs]');
        const visible = scope
          ? [...scope.querySelectorAll(selector)].find((el) => !el.closest('[hidden]'))
          : document.querySelector(selector);
        text = visible?.textContent?.trim() || '';
      }
      if (!text) return;
      const ok = await copyText(text);
      const label = btn.querySelector('[data-copy-label]') || btn;
      const before = label.textContent;
      btn.classList.add('is-copied');
      label.textContent = ok ? 'Copied' : 'Press ⌘C';
      setTimeout(() => {
        btn.classList.remove('is-copied');
        label.textContent = before;
      }, 1600);
    });
  });
}

/** @param {string} text */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/* ── Footer service status ──────────────────────────────────────────────── */

/**
 * Three dots in the footer show whether the services behind the site answer
 * their health checks. Checked once, when the footer comes into view.
 */
export function initServiceStatus() {
  const list = document.querySelector('[data-status]');
  if (!list) return;
  const checks = {
    signal: 'https://signal.clex.in/health',
    chain: '/chain/health',
    api: '/vault/api/health',
  };

  const run = async () => {
    await Promise.all(Object.entries(checks).map(async ([name, url]) => {
      const item = list.querySelector(`[data-service="${name}"]`);
      if (!item) return;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        // A non-JSON answer means this host does not serve that route (a
        // local dev server, a preview deploy): unknown, not down.
        if (body === null && res.status < 500) return;
        item.setAttribute('data-state', res.ok && body?.ok !== false ? 'up' : 'down');
        item.setAttribute('title', res.ok ? 'Operational' : `Answering ${res.status}`);
      } catch {
        item.setAttribute('data-state', 'down');
      }
    }));
  };

  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    void run();
  });
  io.observe(list);
}
