<section class="methods-section">
  <div class="methods-inner">

    <div class="methods-header">
      <p class="methods-eyebrow">Transfer methods</p>
      <h2 class="methods-headline">Smart routing, your choice.</h2>
      <p class="methods-sub">Clex automatically picks the best method. You always stay in control.</p>
    </div>

    <div class="methods-grid">

      <!-- P2P -->
      <div class="method-card method-primary">
        <div class="method-top">
          <div class="method-priority">
            <span class="priority-dot priority-green" />
            Primary
          </div>
          <div class="method-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="4.5" cy="9" r="2" stroke="currentColor" stroke-width="1.4"/>
              <circle cx="13.5" cy="4.5" r="2" stroke="currentColor" stroke-width="1.4"/>
              <circle cx="13.5" cy="13.5" r="2" stroke="currentColor" stroke-width="1.4"/>
              <path d="M6.5 8.1L11.5 5.4M6.5 9.9L11.5 12.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <h3 class="method-name">Direct Transfer</h3>
        <p class="method-desc">Pure P2P using WebRTC DataChannel. Files go directly between browsers — zero servers in the transfer path.</p>
        <ul class="method-features">
          <li>No server relay</li>
          <li>No file storage anywhere</li>
          <li>Works across networks</li>
          <li>Any file size</li>
        </ul>
      </div>

      <!-- Local -->
      <div class="method-card">
        <div class="method-top">
          <div class="method-priority">
            <span class="priority-dot priority-blue" />
            Fast Track
          </div>
          <div class="method-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 13a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
              <path d="M5.5 10.5a5 5 0 017 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M2.5 7.5a9 9 0 0113 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <h3 class="method-name">Local Network</h3>
        <p class="method-desc">Same Wi-Fi? Detected automatically. Transfer at full local speeds with no cloud overhead.</p>
        <ul class="method-features">
          <li>Automatic detection</li>
          <li>Maximum speeds</li>
          <li>No setup needed</li>
          <li>Private by nature</li>
        </ul>
      </div>

      <!-- Drive -->
      <div class="method-card">
        <div class="method-top">
          <div class="method-priority">
            <span class="priority-dot priority-amber" />
            Cloud Fallback
          </div>
          <div class="method-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 12V5M6 8l3-3 3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 14h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <h3 class="method-name">Google Drive</h3>
        <p class="method-desc">Upload to your own Drive and generate a shareable link. Secure fallback when direct transfer isn't possible.</p>
        <ul class="method-features">
          <li>Your own Drive account</li>
          <li>Shareable link output</li>
          <li>drive.file scope only</li>
          <li>OAuth 2.0 secure</li>
        </ul>
      </div>
    </div>

    <!-- CTA -->
    <div class="methods-cta">
      <a href="/workspace" class="btn-primary methods-cta-btn">
        Start sending files
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
      <p class="methods-cta-note">Free to use · No account required for P2P</p>
    </div>

  </div>
</section>

<style>
  .methods-section {
    padding: 100px 24px;
    border-top: 1px solid var(--border);
  }

  .methods-inner {
    max-width: 900px;
    margin: 0 auto;
  }

  .methods-header {
    text-align: center;
    margin-bottom: 56px;
  }

  .methods-eyebrow {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-3);
    margin-bottom: 14px;
  }

  .methods-headline {
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-1);
    margin-bottom: 14px;
  }

  .methods-sub {
    font-size: 15px;
    color: var(--text-2);
    max-width: 400px;
    margin: 0 auto;
  }

  .methods-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .method-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 24px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .method-card:hover {
    border-color: var(--border-strong);
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  }

  :global(.dark) .method-card:hover {
    box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  }

  .method-primary {
    background: var(--raised);
  }

  .method-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .method-priority {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .priority-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .priority-green { background: #22c55e; }
  .priority-blue { background: #3b82f6; }
  .priority-amber { background: #f59e0b; }

  .method-icon-wrap {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-1);
  }

  .method-primary .method-icon-wrap {
    background: var(--surface);
  }

  .method-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
    margin-bottom: 8px;
  }

  .method-desc {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.65;
    margin-bottom: 20px;
  }

  .method-features {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .method-features li {
    font-size: 12px;
    color: var(--text-2);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .method-features li::before {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--border-strong);
    flex-shrink: 0;
  }

  /* CTA */
  .methods-cta {
    text-align: center;
    margin-top: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .methods-cta-btn {
    padding: 12px 28px;
    font-size: 15px;
    border-radius: 10px;
    gap: 10px;
    display: inline-flex;
    align-items: center;
    background: var(--text-1);
    color: var(--text-inv);
    border: 1px solid transparent;
    font-weight: 500;
    transition: opacity 0.15s;
    text-decoration: none;
  }

  .methods-cta-btn:hover { opacity: 0.85; }

  .methods-cta-note {
    font-size: 12px;
    color: var(--text-3);
  }

  @media (max-width: 680px) {
    .methods-grid { grid-template-columns: 1fr; }
  }
</style>
