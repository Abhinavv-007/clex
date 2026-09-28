/* ==========================================================================
   Legal pages — a contents rail built from the headings, with the section
   you're reading marked as you scroll.
   ========================================================================== */

export function initLegal() {
  const doc = document.querySelector('[data-legal]');
  const rail = document.querySelector('[data-legal-toc]');
  if (!doc || !rail) return;

  const headings = [...doc.querySelectorAll('h2')];
  if (!headings.length) return;

  const list = document.createElement('ol');
  list.setAttribute('role', 'list');
  /** @type {Map<Element, HTMLAnchorElement>} */
  const links = new Map();

  headings.forEach((h, i) => {
    if (!h.id) h.id = (h.textContent || `section-${i}`).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span>${h.textContent}`;
    li.append(a);
    list.append(li);
    links.set(h, a);
  });
  rail.append(list);

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((a) => a.removeAttribute('aria-current'));
      links.get(entry.target)?.setAttribute('aria-current', 'true');
    }
  }, { rootMargin: '-20% 0px -70% 0px' });
  headings.forEach((h) => io.observe(h));
}
