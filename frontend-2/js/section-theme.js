/* ============================================
   CLEX — Scroll-driven section theme system
   Each <section> can declare data-section-theme="cream"|"lime"|"dark"|"ivory"
   The body gets a matching class so nav + decorations can morph.
   ============================================ */

const THEMES = ['cream', 'lime', 'dark', 'ivory', 'peach', 'lavender'];

export function initSectionTheme() {
  const sections = Array.from(document.querySelectorAll('[data-section-theme]'));
  if (!sections.length) return;

  const body = document.body;
  /** @param {string | null} theme */
  const setActive = (theme) => {
    if (!theme) return;
    THEMES.forEach((t) => body.classList.toggle(`section-theme-${t}`, t === theme));
    body.dataset.activeSectionTheme = theme;
  };

  // pick the section whose top crosses 30% of viewport
  let current = sections[0].getAttribute('data-section-theme');
  setActive(current);

  const update = () => {
    const probeY = window.innerHeight * 0.28;
    let active = current;
    for (const sec of sections) {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= probeY && rect.bottom > probeY) {
        active = sec.getAttribute('data-section-theme');
        break;
      }
    }
    if (active && active !== current) {
      current = active;
      setActive(active);
    }
  };

  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      update();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}
