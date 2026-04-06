import { routes } from './routes.js';

/* ============================================
   CLEX — Footer Component
   ============================================ */

export function getFooterHTML() {
  const year = new Date().getFullYear();
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer__grid">
        <div class="footer__brand">
          <div class="footer__logo" aria-label="Clex">
            <img src="/brand/clex-logo.png" alt="" class="footer__logo-image">
            <span class="footer__logo-wordmark">Clex</span>
          </div>
          <p class="footer__desc">
            One workspace. Drop files, prepare them, share them. No friction, no accounts, no server storage. Just fast, private file movement.
          </p>
          <div class="flex gap-sm">
            <span class="badge badge--outline"><span class="badge__dot"></span> Online</span>
          </div>
        </div>

        <div class="footer__col">
          <h4 class="footer__col-title">Product</h4>
          <nav class="footer__links">
            <a href="${routes.features}" class="footer__link">Features</a>
            <a href="${routes.howItWorks}" class="footer__link">How It Works</a>
            <a href="${routes.workspace}" class="footer__link">Workspace</a>
            <a href="${routes.gettingStarted}" class="footer__link">Get Started</a>
          </nav>
        </div>

        <div class="footer__col">
          <h4 class="footer__col-title">Support</h4>
          <nav class="footer__links">
            <a href="${routes.faq}" class="footer__link">FAQ</a>
            <a href="${routes.gettingStarted}" class="footer__link">Onboarding</a>
            <a href="mailto:hello@clex.in" class="footer__link">Contact</a>
          </nav>
        </div>

        <div class="footer__col">
          <h4 class="footer__col-title">Legal</h4>
          <nav class="footer__links">
            <a href="${routes.privacy}" class="footer__link">Privacy Policy</a>
            <a href="${routes.terms}" class="footer__link">Terms of Service</a>
          </nav>
        </div>
      </div>

      <div class="footer__bottom">
        <span class="footer__copyright">© ${year} Clex. All rights reserved.</span>
        <div class="footer__legal">
          <a href="${routes.privacy}" class="footer__legal-link">Privacy</a>
          <a href="${routes.terms}" class="footer__legal-link">Terms</a>
        </div>
      </div>
    </div>
  </footer>
  `;
}
