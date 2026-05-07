/* ============================================
   CLEX — Generic page animations
   ============================================ */

export function initAnimations() {
  const revealTargets = document.querySelectorAll('.reveal, .reveal-right, .reveal-scale');
  const staggerGroups = document.querySelectorAll('.stagger-group');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  revealTargets.forEach((node) => observer.observe(node));

  staggerGroups.forEach((group) => {
    [...group.children].forEach((child, index) => {
      if (!(child instanceof HTMLElement)) return;
      child.style.transitionDelay = `${index * 90}ms`;
      observer.observe(child);
    });
  });
}

export function initFaqAccordion() {
  const triggers = document.querySelectorAll('.accordion__trigger');

  /**
   * @param {Element} trigger
   * @param {boolean} expanded
   */
  const setAccordionState = (trigger, expanded) => {
    const item = trigger.closest('.accordion__item');
    const content = item?.querySelector('.accordion__content');
    const icon = trigger.querySelector('.accordion__icon');
    if (!item || !(content instanceof HTMLElement)) return;

    trigger.setAttribute('aria-expanded', String(expanded));
    item.classList.toggle('accordion__item--open', expanded);
    content.style.maxHeight = expanded ? `${content.scrollHeight}px` : '0px';
    if (icon instanceof HTMLElement) icon.textContent = expanded ? '−' : '+';
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      triggers.forEach((otherTrigger) => {
        if (otherTrigger === trigger) return;
        setAccordionState(otherTrigger, false);
      });

      setAccordionState(trigger, !expanded);
    });
  });
}

export function initGiantSteps() {
  document.querySelectorAll('.giant-step').forEach((step) => {
    step.addEventListener('mouseenter', () => step.classList.add('giant-step--active'));
    step.addEventListener('mouseleave', () => step.classList.remove('giant-step--active'));
  });
}

export function initRoutingAnimation() {
  // Shared Svelte islands handle their own route visualization state now.
}
