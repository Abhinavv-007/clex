/* ============================================================
   CLEX — Cinematic upgrade module
   - Scroll-revealed [data-cine] choreography
   - Orbit constellation beam injection (links nodes to core)
   - Mobile sticky CTA ribbon
   - Premium pen-tip + descender fixes for italic-accent
   - Hero word stagger
   - Section parallax
   ============================================================ */

export function initCinematic() {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  autoTagCinematicElements();
  initCinematicReveals(reduced);
  initOrbitBeams();
  initMobileCTA();
  initSectionParallax(reduced);
  initHeroWordStagger(reduced);
  initFloatingTagDrift(reduced);
  initCineWindow();
  initEndpointCopy();
}

/* ─── Auto-tag elements that should fade-in cinematically ─── */
function autoTagCinematicElements() {
  const groups = [
    { sel: '.section__header', mode: 'rise' },
    { sel: '.bento__cell', mode: 'up' },
    { sel: '.routing__method', mode: 'up' },
    { sel: '.dpc-cell', mode: 'up' },
    { sel: '.creem-stack__card', mode: 'rise' },
    { sel: '.tilt-card', mode: 'zoom' },
    { sel: '.peer-flow', mode: 'rise' },
    { sel: '.orbit-stage', mode: 'zoom' },
    { sel: '.bento', mode: 'up' },
    { sel: '.feature-card', mode: 'up' },
    { sel: '.gs-step', mode: 'up' },
    { sel: '.cta-final', mode: 'rise' },
    { sel: '.banner__text', mode: 'rise' },
  ];
  groups.forEach((g) => {
    document.querySelectorAll(g.sel).forEach((el, i) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.hasAttribute('data-cine')) return;
      el.setAttribute('data-cine', g.mode);
      const stagger = Math.min(i * 70, 420);
      el.style.setProperty('--cine-delay', `${stagger}ms`);
    });
  });
}

function initCinematicReveals(reduced) {
  const targets = document.querySelectorAll('[data-cine]');
  if (!targets.length) return;
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('cine-on'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('cine-on');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  targets.forEach((t) => io.observe(t));
}

/* ─── Inject animated beams from each orbit-node toward core ─── */
function initOrbitBeams() {
  const stages = document.querySelectorAll('.orbit-stage');
  stages.forEach((stage) => {
    if (!(stage instanceof HTMLElement)) return;
    if (stage.dataset.beamsReady === '1') return;
    const beam = document.createElement('div');
    beam.className = 'orbit-beam';
    beam.setAttribute('aria-hidden', 'true');
    const nodes = stage.querySelectorAll('.orbit-node');
    nodes.forEach(() => {
      const span = document.createElement('span');
      beam.appendChild(span);
    });
    stage.appendChild(beam);

    const layout = () => {
      const stageRect = stage.getBoundingClientRect();
      const cx = stageRect.width / 2;
      const cy = stageRect.height / 2;
      nodes.forEach((node, i) => {
        const r = node.getBoundingClientRect();
        const nx = r.left - stageRect.left + r.width / 2;
        const ny = r.top - stageRect.top + r.height / 2;
        const dx = nx - cx;
        const dy = ny - cy;
        const len = Math.hypot(dx, dy);
        const rot = Math.atan2(dy, dx) * (180 / Math.PI);
        const span = beam.children[i];
        if (span instanceof HTMLElement) {
          span.style.setProperty('--beam-len', `${Math.max(0, len - 30)}px`);
          span.style.setProperty('--beam-rot', `${rot}deg`);
          span.style.animationDelay = `${i * 0.45}s`;
        }
      });
    };

    layout();
    let resizeT;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = window.setTimeout(layout, 120);
    }, { passive: true });
    window.setTimeout(layout, 220);
    window.setTimeout(layout, 700);
    stage.dataset.beamsReady = '1';
  });
}

/* ─── Mobile sticky CTA ─── */
function initMobileCTA() {
  if (document.querySelector('.cine-mobile-cta')) return;
  if (window.matchMedia('(min-width: 641px)').matches) return;
  const page = document.body.getAttribute('data-page') || '';
  if (page === 'workspace' || page === 'vault' || page === 'chain' || page === 'account' || page === 'receive') return;
  const wrap = document.createElement('div');
  wrap.className = 'cine-mobile-cta';
  wrap.innerHTML = `<a href="/workspace" class="cine-mobile-cta__btn">Open Workspace <span aria-hidden="true">→</span></a>`;
  document.body.appendChild(wrap);
}

/* ─── Subtle scroll parallax on background blobs ─── */
function initSectionParallax(reduced) {
  if (reduced) return;
  const targets = document.querySelectorAll('[data-parallax]');
  if (!targets.length) return;
  let raf = 0;
  const apply = () => {
    raf = 0;
    const sy = window.scrollY;
    targets.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const factor = parseFloat(el.dataset.parallax || '0') || 0;
      el.style.transform = `translate3d(0, ${sy * factor}px, 0)`;
    });
  };
  window.addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  apply();
}

/* ─── Hero word stagger so "Move files / Keep control" land in beats ─── */
function initHeroWordStagger(reduced) {
  if (reduced) return;
  const words = document.querySelectorAll('.hero__title-word');
  words.forEach((w, i) => {
    if (!(w instanceof HTMLElement)) return;
    w.style.opacity = '0';
    w.style.transform = 'translateY(28px) rotate(-1deg)';
    w.style.filter = 'blur(6px)';
    w.style.willChange = 'opacity, transform, filter';
    w.style.transition = `opacity 720ms cubic-bezier(0.22,1,0.36,1) ${120 + i * 110}ms, transform 820ms cubic-bezier(0.22,1,0.36,1) ${120 + i * 110}ms, filter 540ms ease-out ${120 + i * 110}ms`;
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      words.forEach((w) => {
        if (!(w instanceof HTMLElement)) return;
        w.style.opacity = '1';
        w.style.transform = 'none';
        w.style.filter = 'none';
      });
    });
  });
}

/* ─── Floating tags drift with cursor (desktop only) ─── */
function initFloatingTagDrift(reduced) {
  if (reduced) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const tags = document.querySelectorAll('.hero__float-tag, [data-float]');
  if (!tags.length) return;
  let raf = 0;
  let target = { x: 0, y: 0 };
  const cur = { x: 0, y: 0 };
  const update = () => {
    raf = 0;
    cur.x += (target.x - cur.x) * 0.06;
    cur.y += (target.y - cur.y) * 0.06;
    tags.forEach((t) => {
      if (!(t instanceof HTMLElement)) return;
      const f = parseFloat(t.dataset.float || '0.5') || 0.5;
      const tx = cur.x * 22 * f;
      const ty = cur.y * 18 * f;
      t.style.setProperty('--cine-drift-x', `${tx}px`);
      t.style.setProperty('--cine-drift-y', `${ty}px`);
      // additive transform (CSS animation already handles base float)
      t.style.transform = `translate(${tx}px, ${ty}px)`;
    });
    if (Math.abs(target.x - cur.x) > 0.001 || Math.abs(target.y - cur.y) > 0.001) {
      raf = requestAnimationFrame(update);
    }
  };
  window.addEventListener('pointermove', (e) => {
    target.x = (e.clientX / window.innerWidth) - 0.5;
    target.y = (e.clientY / window.innerHeight) - 0.5;
    if (!raf) raf = requestAnimationFrame(update);
  }, { passive: true });
}

/* ─── Cinematic window: tab switching + copy ─── */
function initCineWindow() {
  document.querySelectorAll('.cine-window').forEach((win) => {
    if (!(win instanceof HTMLElement)) return;
    if (win.dataset.cineReady === '1') return;
    win.dataset.cineReady = '1';
    const tabs = win.querySelectorAll('.cine-window__tab');
    const panes = win.querySelectorAll('.cine-window__pane');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-target');
        if (!target) return;
        tabs.forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        panes.forEach((p) => {
          if (p.id === target) p.classList.add('is-active');
          else p.classList.remove('is-active');
        });
      });
    });
    const copy = win.querySelector('.cine-window__copy');
    if (copy instanceof HTMLButtonElement) {
      copy.addEventListener('click', async () => {
        const active = win.querySelector('.cine-window__pane.is-active');
        const text = active?.textContent?.trim() || '';
        try {
          await navigator.clipboard.writeText(text);
          const orig = copy.textContent;
          copy.textContent = 'Copied';
          copy.classList.add('is-copied');
          window.setTimeout(() => {
            copy.textContent = orig;
            copy.classList.remove('is-copied');
          }, 1800);
        } catch (e) {
          console.warn('Copy failed', e);
        }
      });
    }
  });
}

/* ─── Endpoint copy buttons (data-cine-copy) ─── */
function initEndpointCopy() {
  document.querySelectorAll('[data-cine-copy]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    if (btn.dataset.cineCopyReady === '1') return;
    btn.dataset.cineCopyReady = '1';
    btn.addEventListener('click', async () => {
      const block = btn.closest('.dev-endpoint, .dce-pane, .cine-window__pane');
      const code = block?.querySelector('pre code, code, pre');
      const text = (code?.textContent || '').trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const orig = btn.querySelector('span')?.textContent || 'Copy';
        const label = btn.querySelector('span');
        if (label) label.textContent = 'Copied';
        btn.classList.add('is-copied');
        window.setTimeout(() => {
          if (label) label.textContent = orig;
          btn.classList.remove('is-copied');
        }, 1800);
      } catch (e) {
        console.warn('clipboard failed', e);
      }
    });
  });
}
