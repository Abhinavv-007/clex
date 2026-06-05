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
  initCodeTabs();
  initTerminalAnimation();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  initUniversalMagnetic();
  initRipples();
  initLiquidInteractives();
  initSmoothHashScroll();
  initMascotEyeTracker();
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

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Strip any legacy split spans so the gradient is one continuous fill.
  const restoreText = (el) => {
    const charSpans = el.querySelectorAll('.hand-char');
    if (!charSpans.length) return;
    const text = [...charSpans].map((s) => s.textContent || '').join('');
    el.textContent = text;
    delete el.dataset.handSplit;
  };

  // Measure inner glyph rect (not padding) using a Range.
  const measureWritingArea = (el) => {
    const wrapRect = el.getBoundingClientRect();
    let textRect = null;
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (r && r.width > 0) textRect = r;
    } catch { /* ignore */ }
    const r = textRect || wrapRect;
    return {
      startX: r.left - wrapRect.left,
      endX: r.right - wrapRect.left,
      midY: ((r.top + r.bottom) / 2) - wrapRect.top,
    };
  };

  const reveal = (el) => {
    if (!(el instanceof HTMLElement) || el.classList.contains('clex-hand--done')) return;
    restoreText(el);

    if (reduced) {
      el.classList.add('clex-hand', 'clex-hand--done');
      return;
    }

    el.classList.add('clex-hand', 'clex-hand--writing');

    requestAnimationFrame(() => {
      const area = measureWritingArea(el);
      el.style.setProperty('--hand-pen-y', `${area.midY}px`);

      const len = (el.textContent || '').trim().length || 6;
      const writeMs = Math.min(2400, Math.max(900, len * 75 + 320));
      const startDelay = Number.parseFloat(getComputedStyle(el).getPropertyValue('--write-delay')) || 0;
      const tStart = performance.now() + startDelay;
      const span = area.endX - area.startX;

      const ease = (t) => {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      const step = (now) => {
        const t = (now - tStart) / writeMs;
        const k = ease(t);
        el.style.setProperty('--hand-p', `${Math.min(108, k * 108)}%`);
        const x = area.startX + span * Math.min(1, k);
        el.style.setProperty('--hand-pen-x', `${Math.max(0, x)}px`);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          el.classList.remove('clex-hand--writing');
          el.classList.add('clex-hand--done');
          el.style.setProperty('--hand-p', `120%`);
          el.style.setProperty('--hand-pen-x', `${span}px`);
        }
      };
      requestAnimationFrame(step);
    });
  };

  accents.forEach((accent, index) => {
    if (!(accent instanceof HTMLElement)) return;
    accent.classList.add('clex-hand');
    accent.style.setProperty('--write-delay', `${Math.min(index * 70, 520)}ms`);
    accent.style.setProperty('--hand-p', '0%');
  });

  document.querySelectorAll('.hero .clex-hand, .hero__title-word--italic').forEach(reveal);

  if (reduced || !('IntersectionObserver' in window)) {
    accents.forEach(reveal);
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '20% 0px 20% 0px', threshold: 0.05 });

  accents.forEach((accent) => io.observe(accent));

  const sweep = () => {
    accents.forEach((accent) => {
      if (!(accent instanceof HTMLElement)) return;
      if (accent.classList.contains('clex-hand--done') || accent.classList.contains('clex-hand--writing')) return;
      const rect = accent.getBoundingClientRect();
      if (rect.bottom >= -160 && rect.top <= window.innerHeight * 1.4) reveal(accent);
    });
  };
  window.setTimeout(sweep, 800);
  window.addEventListener('load', sweep, { once: true });
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

/* ---------- Mascot Pupils Pointer Tracking (Cinematic) ---------- */
function initMascotEyeTracker() {
  const pupils = document.querySelectorAll('.hero__mascot-pupil, .dce-mascot-pupil');
  if (!pupils.length) return;

  window.addEventListener('pointermove', (e) => {
    pupils.forEach((pupil) => {
      const rect = pupil.getBoundingClientRect();
      const eyeX = rect.left + rect.width / 2;
      const eyeY = rect.top + rect.height / 2;
      
      const angle = Math.atan2(e.clientY - eyeY, e.clientX - eyeX);
      const distance = Math.min(6, Math.hypot(e.clientX - eyeX, e.clientY - eyeY) / 75);
      
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      
      pupil.style.transform = `translate(${dx}px, ${dy}px)`;
      pupil.style.animation = 'none';
    });
  });

  window.addEventListener('pointerleave', () => {
    pupils.forEach((pupil) => {
      pupil.style.transform = '';
      pupil.style.animation = ''; // restore idle blink animation
    });
  });
}

/* ---------- Tabbed Code Editor Tabs and Copy (Cinematic) ---------- */
function initCodeTabs() {
  const tabs = document.querySelectorAll('.dce-tab');
  const panes = document.querySelectorAll('.dce-pane');
  const copyBtn = document.getElementById('dce-copy-btn');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      if (!tabName) return;

      // Active state for tab button
      tabs.forEach((t) => t.classList.remove('dce-tab--active'));
      tab.classList.add('dce-tab--active');

      // Active state for pane content
      panes.forEach((p) => {
        if (p.id === `pane-${tabName}`) {
          p.classList.add('dce-pane--active');
        } else {
          p.classList.remove('dce-pane--active');
        }
      });
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const activePane = document.querySelector('.dce-pane--active code');
      if (!activePane) return;

      const codeText = activePane.textContent || '';
      try {
        await navigator.clipboard.writeText(codeText.trim());
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('dce-copied');
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.classList.remove('dce-copied');
        }, 2000);
      } catch (err) {
        console.warn('Failed to copy code: ', err);
      }
    });
  }
}

/* ---------- AI CLI Terminal Mockup Interactive Animation ---------- */
function initTerminalAnimation() {
  const terminal = document.getElementById('vibe-terminal');
  if (!terminal) return;

  const cmdEl = terminal.querySelector('.terminal-cmd');
  const outputEl = terminal.querySelector('.terminal-output');
  const cursorEl = terminal.querySelector('.terminal-cursor');

  if (!cmdEl || !outputEl) return;

  const command = 'npx -y clex-cli upload presentation.pdf';
  const steps = [
    { text: '⚙ Reading presentation.pdf (3.4 MB)...', color: '#25b6e8', delay: 700 },
    { text: '✔ Signalled peer & connected over LAN', color: '#7edc8b', delay: 900 },
    { text: '[Direct+] Transferred 14/14 chunks (100% verified)', color: '#c46bc2', delay: 800 },
    { text: '✔ Transfer receipt proof generated successfully', color: '#7edc8b', delay: 600 },
    { text: 'Delivered: https://clex.in/share/A9R2D', color: '#ff941f', delay: 700, isLink: true }
  ];

  let typingTimer = null;
  let executionTimers = [];

  const runAnimation = () => {
    // Clear any previous execution timers and states
    executionTimers.forEach(t => window.clearTimeout(t));
    window.clearTimeout(typingTimer);
    executionTimers = [];

    cmdEl.textContent = '';
    outputEl.innerHTML = '';
    cursorEl.style.display = 'inline';

    let charIdx = 0;
    const typeChar = () => {
      if (charIdx < command.length) {
        cmdEl.textContent += command[charIdx];
        charIdx++;
        typingTimer = window.setTimeout(typeChar, 40 + Math.random() * 40);
      } else {
        // Typing complete, hide cursor after a tiny delay and run steps
        cursorEl.style.display = 'none';
        runSteps(0);
      }
    };

    const runSteps = (stepIdx) => {
      if (stepIdx >= steps.length) {
        // Complete! Loop back after 10 seconds
        const resetTimer = window.setTimeout(() => {
          runAnimation();
        }, 10000);
        executionTimers.push(resetTimer);
        return;
      }

      const step = steps[stepIdx];
      const stepTimer = window.setTimeout(() => {
        const line = document.createElement('div');
        line.style.opacity = '0';
        line.style.transform = 'translateY(6px)';
        line.style.transition = 'all 300ms ease';
        line.style.marginBottom = '0.35rem';

        if (step.isLink) {
          const prefix = document.createElement('span');
          prefix.style.color = step.color;
          prefix.textContent = 'Delivered: ';
          
          const link = document.createElement('a');
          link.href = 'https://clex.in/share/A9R2D';
          link.target = '_blank';
          link.style.color = '#c4b5fd';
          link.style.textDecoration = 'underline';
          link.style.fontWeight = '700';
          link.textContent = 'https://clex.in/share/A9R2D';
          
          line.appendChild(prefix);
          line.appendChild(link);
        } else {
          line.style.color = step.color;
          line.textContent = step.text;
        }

        outputEl.appendChild(line);
        
        // Force reflow
        line.offsetHeight;
        line.style.opacity = '1';
        line.style.transform = 'translateY(0)';

        // Auto-scroll terminal if it overflows
        terminal.scrollTop = terminal.scrollHeight;

        runSteps(stepIdx + 1);
      }, step.delay);

      executionTimers.push(stepTimer);
    };

    typeChar();
  };

  // Run observer to check viewport intersection
  if (!('IntersectionObserver' in window)) {
    runAnimation();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        runAnimation();
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  observer.observe(terminal);
}

