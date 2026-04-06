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

          <div class="footer__creator">
            <span class="footer__creator-label">A Project by Abhinav</span>
            <p class="footer__creator-text">Privacy first disposable email. Your inbox, your control.</p>

            <div class="footer__creator-links">
              <a href="mailto:abhnv@abhnv.in" class="footer__creator-link">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M2 3.5h11v8H2z" stroke="currentColor" stroke-width="1.4" rx="1.2"/>
                  <path d="M2.5 4l5 4 5-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>abhnv@abhnv.in</span>
              </a>
              <a href="https://www.linkedin.com/in/abhnv07/" target="_blank" rel="noopener noreferrer" class="footer__creator-link">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M3.25 5.5v6.25M3.25 3a.75.75 0 110 1.5.75.75 0 010-1.5zM6.5 11.75V5.5h2.25v.9c.45-.62 1.08-1.08 2.05-1.08 1.63 0 2.7 1.03 2.7 3.2v3.23h-2.25V8.86c0-.95-.33-1.6-1.18-1.6-.64 0-1.03.43-1.2.85-.06.15-.08.36-.08.57v3.07H6.5z" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>linkedin.com/in/abhnv07</span>
              </a>
              <a href="https://abhnv.in" target="_blank" rel="noopener noreferrer" class="footer__creator-link">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M2.75 7.5h9.5M7.5 2.25c1.32 1.43 2.1 3.28 2.1 5.25s-.78 3.82-2.1 5.25M7.5 2.25c-1.32 1.43-2.1 3.28-2.1 5.25s.78 3.82 2.1 5.25" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                <span>abhnv.in</span>
              </a>
              <a href="https://abhnv.me" target="_blank" rel="noopener noreferrer" class="footer__creator-link">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M2.75 7.5h9.5M7.5 2.25c1.32 1.43 2.1 3.28 2.1 5.25s-.78 3.82-2.1 5.25M7.5 2.25c-1.32 1.43-2.1 3.28-2.1 5.25s.78 3.82 2.1 5.25" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                <span>abhnv.me</span>
              </a>
            </div>
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
