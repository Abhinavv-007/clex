/* ============================================
   CLEX — Animations (GSAP + ScrollTrigger)
   ============================================ */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initAnimations() {
  // ── Reveal animations ──
  initReveals();
  // ── Staggered card reveals ──
  initCardStagger();
  // ── Hero text animation ──
  initHeroText();
  // ── Counter animations ──
  initCounters();
  // ── Parallax effects ──
  initParallax();
  // ── Banner scale ──
  initBannerScale();
  // ── Workspace mock file animation ──
  initWorkspaceMock();
}

function initReveals() {
  gsap.utils.toArray('.reveal').forEach(el => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      }
    });
  });

  gsap.utils.toArray('.reveal-left').forEach(el => {
    gsap.to(el, {
      opacity: 1,
      x: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      }
    });
  });

  gsap.utils.toArray('.reveal-right').forEach(el => {
    gsap.to(el, {
      opacity: 1,
      x: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      }
    });
  });

  gsap.utils.toArray('.reveal-scale').forEach(el => {
    gsap.to(el, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      }
    });
  });
}

function initCardStagger() {
  gsap.utils.toArray('.stagger-group').forEach(group => {
    const children = group.children;
    gsap.from(children, {
      opacity: 0,
      y: 40,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: group,
        start: 'top 80%',
        once: true,
      }
    });
  });
}

function initHeroText() {
  const heroTitle = document.querySelector('.hero__title');
  if (!heroTitle) return;

  const lines = heroTitle.querySelectorAll('.hero__title-line');
  gsap.from(lines, {
    opacity: 0,
    y: 60,
    rotateX: -15,
    duration: 1,
    stagger: 0.15,
    ease: 'power4.out',
    delay: 0.3,
  });

  const heroSubtitle = document.querySelector('.hero__subtitle');
  if (heroSubtitle) {
    gsap.from(heroSubtitle, {
      opacity: 0,
      y: 30,
      duration: 0.8,
      ease: 'power3.out',
      delay: 0.8,
    });
  }

  const heroActions = document.querySelector('.hero__actions');
  if (heroActions) {
    gsap.from(heroActions, {
      opacity: 0,
      y: 20,
      duration: 0.6,
      ease: 'power3.out',
      delay: 1,
    });
  }

  const heroBadge = document.querySelector('.hero__badge');
  if (heroBadge) {
    gsap.from(heroBadge, {
      opacity: 0,
      x: -20,
      duration: 0.6,
      ease: 'power3.out',
      delay: 0.1,
    });
  }
}

function initCounters() {
  gsap.utils.toArray('.stat__value[data-count]').forEach(el => {
    const target = parseInt(el.getAttribute('data-count'), 10);
    const suffix = el.getAttribute('data-suffix') || '';

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(el, {
          duration: 1.5,
          ease: 'power2.out',
          onUpdate: function() {
            el.textContent = Math.round(this.progress() * target) + suffix;
          },
        });
      }
    });
  });
}

function initParallax() {
  gsap.utils.toArray('.parallax').forEach(el => {
    const speed = parseFloat(el.getAttribute('data-speed')) || 0.3;
    gsap.to(el, {
      yPercent: -30 * speed,
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      }
    });
  });
}

function initBannerScale() {
  gsap.utils.toArray('.banner').forEach(el => {
    gsap.from(el.querySelector('.banner__text'), {
      scale: 0.92,
      opacity: 0.5,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 80%',
        once: true,
      }
    });
  });
}

function initWorkspaceMock() {
  const files = document.querySelectorAll('.workspace-mock__file');
  if (!files.length) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.workspace-mock',
      start: 'top 70%',
      once: true,
    }
  });

  files.forEach((file, i) => {
    tl.to(file, {
      opacity: 1,
      x: 0,
      duration: 0.4,
      ease: 'power2.out',
    }, i * 0.2 + 0.5);

    // Animate status text
    tl.to(file.querySelector('.workspace-mock__file-status'), {
      color: 'var(--accent)',
      duration: 0.3,
    }, i * 0.2 + 0.9);
  });

  // Animate toolbar tools becoming active
  const tools = document.querySelectorAll('.workspace-mock__tool');
  if (tools.length) {
    tools.forEach((tool, i) => {
      tl.to(tool, {
        className: '+=workspace-mock__tool--active',
        duration: 0.1,
      }, 1.5 + i * 0.15);
    });
  }
}

export function initFaqAccordion() {
  document.querySelectorAll('.accordion__trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.accordion__item');
      const content = item.querySelector('.accordion__content');
      const body = content.querySelector('.accordion__body');
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      // Close all others in same accordion
      const accordion = trigger.closest('.accordion');
      accordion.querySelectorAll('.accordion__trigger[aria-expanded="true"]').forEach(other => {
        if (other !== trigger) {
          other.setAttribute('aria-expanded', 'false');
          const otherContent = other.closest('.accordion__item').querySelector('.accordion__content');
          gsap.to(otherContent, { height: 0, duration: 0.3, ease: 'power2.inOut' });
        }
      });

      if (isOpen) {
        trigger.setAttribute('aria-expanded', 'false');
        gsap.to(content, { height: 0, duration: 0.3, ease: 'power2.inOut' });
      } else {
        trigger.setAttribute('aria-expanded', 'true');
        gsap.to(content, {
          height: body.offsetHeight,
          duration: 0.4,
          ease: 'power2.out',
        });
      }
    });
  });
}

// ── Giant step animations (How It Works) ──
export function initGiantSteps() {
  gsap.utils.toArray('.giant-step').forEach((step, i) => {
    const number = step.querySelector('.giant-step__number');
    const content = step.querySelector('.giant-step__content');
    const visual = step.querySelector('.step-visual');

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: step,
        start: 'top 75%',
        once: true,
      }
    });

    if (number) {
      tl.from(number, {
        opacity: 0,
        scale: 0.5,
        duration: 0.6,
        ease: 'back.out(1.7)',
      });
    }

    if (content) {
      tl.from(content.querySelectorAll('.giant-step__title, .giant-step__text, .giant-step__tags'), {
        opacity: 0,
        y: 30,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out',
      }, '-=0.3');
    }

    if (visual) {
      tl.from(visual, {
        opacity: 0,
        x: i % 2 === 0 ? 60 : -60,
        duration: 0.8,
        ease: 'power3.out',
      }, '-=0.5');
    }
  });
}

// ── Routing path animation ──
export function initRoutingAnimation() {
  const paths = document.querySelectorAll('.routing-visual__path');
  if (!paths.length) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.routing-visual',
      start: 'top 75%',
      once: true,
    }
  });

  paths.forEach((path, i) => {
    tl.from(path, {
      opacity: 0,
      x: -30,
      duration: 0.5,
      ease: 'power2.out',
    }, i * 0.15);
  });

  // Highlight active path
  tl.to(paths[0], {
    className: '+=routing-visual__path--active',
    duration: 0.3,
  }, '+=0.3');
}
