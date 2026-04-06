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
            A project by <span class="footer__signature-name">Abhinav</span>
          </p>
          <p class="footer__signature-text">
            Independent product design and engineering for privacy-first file movement on the open web.
          </p>
        </div>

        <div class="footer__signature-links">
          <a href="https://www.linkedin.com/in/abhnv07/" target="_blank" rel="noopener noreferrer" class="footer__signature-link" aria-label="Abhinav on LinkedIn">
            <span class="footer__signature-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="4" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 10.25V16.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                <circle cx="8" cy="7.6" r="1" fill="currentColor"/>
                <path d="M12 16.5V10.25H15.4V11.35C16.02 10.5 16.92 10 18.1 10C20.12 10 21 11.42 21 13.54V16.5H17.6V13.96C17.6 12.97 17.26 12.15 16.14 12.15C15.32 12.15 14.8 12.71 14.58 13.24C14.5 13.42 14.46 13.69 14.46 13.95V16.5H12Z" fill="currentColor"/>
              </svg>
            </span>
            <span>LinkedIn</span>
          </a>

          <a href="mailto:abhnv@abhnv.in" class="footer__signature-link" aria-label="Email Abhinav">
            <span class="footer__signature-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5.25" width="18" height="13.5" rx="2.5" stroke="currentColor" stroke-width="1.5"/>
                <path d="M4.75 7L12 12.25L19.25 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span>abhnv@abhnv.in</span>
          </a>

          <a href="https://abhnv.in" target="_blank" rel="noopener noreferrer" class="footer__signature-link" aria-label="Visit abhnv.in">
            <span class="footer__signature-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.25" stroke="currentColor" stroke-width="1.5"/>
                <path d="M3.75 12H20.25M12 3.75C13.94 5.81 15.04 8.63 15.04 12C15.04 15.37 13.94 18.19 12 20.25M12 3.75C10.06 5.81 8.96 8.63 8.96 12C8.96 15.37 10.06 18.19 12 20.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </span>
            <span>abhnv.in</span>
          </a>

          <a href="https://abhnv.me" target="_blank" rel="noopener noreferrer" class="footer__signature-link" aria-label="Visit abhnv.me">
            <span class="footer__signature-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.25" stroke="currentColor" stroke-width="1.5"/>
                <path d="M3.75 12H20.25M12 3.75C13.94 5.81 15.04 8.63 15.04 12C15.04 15.37 13.94 18.19 12 20.25M12 3.75C10.06 5.81 8.96 8.63 8.96 12C8.96 15.37 10.06 18.19 12 20.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
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
