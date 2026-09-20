/**
 * One-time browser-storage notice.
 *
 * Clex sets no cookies, runs no analytics and loads no advertising trackers.
 * Everything it keeps in the browser — the theme flag, the encrypted Vault,
 * its keys, a Drive token if you connect one — is strictly necessary for a
 * feature the visitor asked for. Under the ePrivacy Directive and UK PECR
 * strictly necessary storage does not require prior consent, so this is a
 * notice rather than a consent wall: nothing is withheld until it is
 * dismissed, and there is no "reject" path because there is nothing
 * non-essential to reject.
 *
 * If that ever stops being true — analytics is the obvious candidate — this
 * has to become a real consent gate that defaults to off, and the storage
 * must not be written until the visitor opts in.
 */

const SEEN_KEY = 'clex-storage-notice-v1';

export function initStorageNotice() {
  // The cookies page is itself the full disclosure; a banner over it is noise.
  if (document.body.dataset.page === 'cookies') return;

  let seen = false;
  try {
    seen = localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // Storage blocked. Nothing durable is being written anyway, and a banner
    // that reappears on every page load is worse than no banner.
    seen = true;
  }
  if (seen) return;

  const notice = document.createElement('aside');
  notice.className = 'storage-notice';
  notice.setAttribute('role', 'region');
  notice.setAttribute('aria-label', 'Browser storage notice');
  notice.innerHTML = `
    <p class="storage-notice__text">
      Clex keeps a few things in your browser so the workspace and Vault work —
      <strong>no cookies, no analytics, no trackers</strong>.
    </p>
    <div class="storage-notice__actions">
      <a class="storage-notice__link" href="/cookies">What's stored</a>
      <button class="storage-notice__btn" type="button">Got it</button>
    </div>
  `;

  const dismiss = () => {
    notice.classList.remove('storage-notice--in');
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ }
    const remove = () => notice.remove();
    notice.addEventListener('transitionend', remove, { once: true });
    // transitionend never fires under prefers-reduced-motion.
    setTimeout(remove, 400);
  };

  notice.querySelector('.storage-notice__btn')?.addEventListener('click', dismiss);
  notice.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') dismiss();
  });

  document.body.appendChild(notice);
  requestAnimationFrame(() => notice.classList.add('storage-notice--in'));
}
