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
            Drop files, prepare them in-browser, and share through the fastest route available. Private by default, built for the open web.
          </p>
        </div>

        <div class="footer__col">
          <h4 class="footer__col-title">Product</h4>
          <nav class="footer__links">
            <a href="${routes.features}" class="footer__link">Features</a>
            <a href="${routes.vault}" class="footer__link">Vault</a>
            <a href="${routes.howItWorks}" class="footer__link">How It Works</a>
            <a href="${routes.workspace}" class="footer__link">Workspace</a>
            <a href="${routes.chain}" class="footer__link">Chain</a>
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

      <div class="footer__signature">
        <div class="footer__signature-copy">
          <p class="footer__signature-heading">
            <span class="footer__signature-kicker">Built by</span>
            <span class="footer__signature-name">Abhinav</span>
          </p>
          <p class="footer__signature-text">
            Fast tools, private transfers, and browser-native delivery.
          </p>
        </div>

        <div class="footer__signature-links">
          <a href="https://www.linkedin.com/in/abhnv07/" target="_blank" rel="noopener noreferrer" class="footer__signature-link footer__signature-link--linkedin" aria-label="Abhinav on LinkedIn">
            <span class="footer__signature-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" focusable="false">
                <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.27 2.38 4.27 5.47v6.27ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"/>
              </svg>
            </span>
            <span>LinkedIn</span>
          </a>

          <a href="mailto:abhnv@abhnv.in" class="footer__signature-link footer__signature-link--mail" aria-label="Email Abhinav">
            <span class="footer__signature-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">
                <path d="M3.5 6.75a2.25 2.25 0 0 1 2.25-2.25h12.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H5.75A2.25 2.25 0 0 1 3.5 17.25V6.75Z" stroke="currentColor" stroke-width="1.6"/>
                <path d="M4.25 7.5 11 12.4a1.75 1.75 0 0 0 2 0L19.75 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="18.5" cy="6" r="2.5" fill="var(--accent, #6366f1)" stroke="var(--bg-card, #fff)" stroke-width="1"/>
              </svg>
            </span>
            <span>abhnv@abhnv.in</span>
          </a>

          <a href="https://abhnv.in" target="_blank" rel="noopener noreferrer" class="footer__signature-link footer__signature-link--site" aria-label="Visit abhnv.in">
            <span class="footer__signature-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/>
                <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.5 3.6 8.5s-1.2 6.1-3.6 8.5M12 3.5C9.6 5.9 8.4 9 8.4 12s1.2 6.1 3.6 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                <path d="M5.5 8.5h13M5.5 15.5h13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.55"/>
              </svg>
            </span>
            <span>abhnv.in</span>
          </a>

          <a href="https://abhnv.me" target="_blank" rel="noopener noreferrer" class="footer__signature-link footer__signature-link--me" aria-label="Visit abhnv.me">
            <span class="footer__signature-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">
                <circle cx="12" cy="9" r="3.5" stroke="currentColor" stroke-width="1.6"/>
                <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                <circle cx="18.5" cy="5.5" r="2" fill="currentColor" opacity="0.85"/>
              </svg>
            </span>
            <span>abhnv.me</span>
          </a>
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
