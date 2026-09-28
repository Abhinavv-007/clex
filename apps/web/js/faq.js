/* ==========================================================================
   FAQ — filter by topic, search as you type
   ========================================================================== */

export function initFaq() {
  const root = document.querySelector('[data-faq]');
  if (!root) return;

  const input = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-faq-search]'));
  const chips = [...root.querySelectorAll('[data-faq-topic]')];
  const groups = [...root.querySelectorAll('[data-faq-group]')];
  const empty = root.querySelector('[data-faq-empty]');
  const count = root.querySelector('[data-faq-count]');
  let topic = 'all';

  const apply = () => {
    const q = (input?.value || '').trim().toLowerCase();
    let shown = 0;
    for (const group of groups) {
      const inTopic = topic === 'all' || group.getAttribute('data-faq-group') === topic;
      let groupShown = 0;
      for (const item of group.querySelectorAll('.qa')) {
        const match = inTopic && (!q || (item.textContent || '').toLowerCase().includes(q));
        item.toggleAttribute('hidden', !match);
        if (match) groupShown += 1;
      }
      group.toggleAttribute('hidden', groupShown === 0);
      shown += groupShown;
    }
    if (empty) empty.toggleAttribute('hidden', shown > 0);
    if (count) count.textContent = `${shown} ${shown === 1 ? 'answer' : 'answers'}`;
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      topic = chip.getAttribute('data-faq-topic') || 'all';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      apply();
    });
  });
  input?.addEventListener('input', apply);

  // "/" focuses the search, like everywhere else on the web.
  window.addEventListener('keydown', (event) => {
    if (event.key !== '/' || document.activeElement instanceof HTMLInputElement) return;
    event.preventDefault();
    input?.focus();
  });

  apply();
}
