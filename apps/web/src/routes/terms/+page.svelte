<script lang="ts">
  import Footer from '$components/landing/Footer.svelte'
  const lastUpdated = 'April 2025'
</script>

<svelte:head>
  <title>Terms of service — Clex</title>
  <meta name="description" content="Clex terms of service. Rules for using the Clex workspace, file tools, and transfer features." />
</svelte:head>

<section class="page-hero section">
  <div class="container">
    <div class="section-label enter-1"><span class="section-label-dot" />Legal</div>
    <h1 class="page-title enter-2">Terms of service.</h1>
    <p class="page-sub enter-3">
      Plain-language rules for using Clex.
      We've kept this as short and readable as possible.
    </p>
    <div class="meta-row enter-4">
      <span class="font-mono text-2xs text-text-3 uppercase tracking-widest">Last updated: {lastUpdated}</span>
    </div>
  </div>
</section>

<section class="legal-section section">
  <div class="container">
    <div class="legal-layout">

      <nav class="legal-toc">
        <p class="toc-label font-mono">Contents</p>
        <a href="#acceptance">Acceptance</a>
        <a href="#the-service">The service</a>
        <a href="#acceptable-use">Acceptable use</a>
        <a href="#your-files">Your files</a>
        <a href="#third-party">Third-party services</a>
        <a href="#availability">Availability</a>
        <a href="#disclaimers">Disclaimers</a>
        <a href="#liability">Liability</a>
        <a href="#changes">Changes</a>
      </nav>

      <div class="legal-body">

        <div class="legal-block" id="acceptance">
          <h2>1. Acceptance of terms</h2>
          <p>By using Clex (the "Service"), you agree to these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users of clex.in and any related Clex applications.</p>
        </div>

        <div class="legal-block" id="the-service">
          <h2>2. The service</h2>
          <p>Clex provides a browser-based workspace for file preparation (compression, conversion, PDF operations, archiving) and file delivery (direct P2P transfer via WebRTC, local network transfer, and Google Drive integration).</p>
          <p>Clex is provided as-is. We do not guarantee that the Service will be available at all times or that all features will work in all environments.</p>
          <p>File preparation tools (compression, conversion, etc.) run entirely in your browser. Clex's servers are involved only in WebRTC session negotiation for P2P transfers. Your files are not stored on Clex infrastructure.</p>
        </div>

        <div class="legal-block" id="acceptable-use">
          <h2>3. Acceptable use</h2>
          <p>You may use Clex for lawful purposes only. You agree not to:</p>
          <ul>
            <li>Use Clex to transfer, share, or process illegal content of any kind</li>
            <li>Use Clex to distribute malware, ransomware, or any harmful software</li>
            <li>Attempt to reverse-engineer, disrupt, or abuse the signaling server infrastructure</li>
            <li>Use automated tools to generate excessive room codes or abuse the WebRTC signaling system</li>
            <li>Use Clex in any way that violates applicable laws or regulations in your jurisdiction</li>
            <li>Attempt to circumvent or abuse Google Drive API quotas through the Clex integration</li>
          </ul>
          <p>We reserve the right to block access to the Service for users or IP addresses that abuse it.</p>
        </div>

        <div class="legal-block" id="your-files">
          <h2>4. Your files and content</h2>
          <p>You retain full ownership and responsibility for all files you process or transfer using Clex. You represent that you have the right to process and share any files you use with Clex.</p>
          <p>Clex does not claim any ownership, license, or interest in the files you process or transfer. Because files processed with Clex's file tools are handled entirely client-side, and files transferred via P2P do not pass through Clex servers, we have no access to your file content.</p>
          <p>For Google Drive transfers, files are uploaded to your own Google account. You are subject to Google's terms of service for that storage.</p>
        </div>

        <div class="legal-block" id="third-party">
          <h2>5. Third-party services</h2>
          <p>Clex integrates with Google Drive via Google's OAuth 2.0 API. By connecting Google Drive, you are also subject to Google's Terms of Service and Privacy Policy. Clex is not affiliated with Google.</p>
          <p>Clex is hosted on Cloudflare Pages and uses Cloudflare Workers for the signaling server. You are subject to Cloudflare's acceptable use policy when accessing the Service.</p>
        </div>

        <div class="legal-block" id="availability">
          <h2>6. Availability</h2>
          <p>Clex is provided on a best-effort basis. We do not guarantee uninterrupted availability of the Service, including the signaling server used for P2P transfers. File preparation tools (which run in your browser) will remain functional even if our servers are unavailable.</p>
          <p>We reserve the right to modify, suspend, or discontinue the Service at any time, with or without notice.</p>
        </div>

        <div class="legal-block" id="disclaimers">
          <h2>7. Disclaimers</h2>
          <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
          <p>We do not warrant that file conversion, compression, or other tool operations will produce results suitable for any specific purpose. Always verify processed files before using them in critical workflows.</p>
          <p>We are not responsible for data loss resulting from browser crashes, session expiry, or other interruptions during file processing or transfer.</p>
        </div>

        <div class="legal-block" id="liability">
          <h2>8. Limitation of liability</h2>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, CLEX AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.</p>
          <p>Our total liability for any claim arising from your use of the Service shall not exceed USD $0, as the Service is provided free of charge.</p>
        </div>

        <div class="legal-block" id="changes">
          <h2>9. Changes to these terms</h2>
          <p>We may update these terms from time to time. Material changes will be reflected in the "last updated" date. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
          <p>If you have questions about these terms, please open an issue on the Clex GitHub repository.</p>
        </div>

      </div>
    </div>
  </div>
</section>

<div class="legal-footer-strip">
  <div class="container">
    <div class="lfs-inner">
      <div>
        <strong>Questions about these terms?</strong>
        <p>We aim to be straightforward. If anything here is unclear, reach out.</p>
      </div>
      <div class="lfs-links">
        <a href="/privacy" class="btn-secondary">Privacy policy</a>
        <a href="/faq" class="btn-secondary">FAQ</a>
      </div>
    </div>
  </div>
</div>

<Footer />

<style>
  .page-hero { padding-top: 140px; border-bottom: 2px solid var(--border-hard); }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(3rem, 7vw, 5.5rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 0.95;
    color: var(--text-1);
    margin: 12px 0 16px;
  }

  .page-sub { font-size: 18px; line-height: 1.7; color: var(--text-2); max-width: 52ch; margin-bottom: 16px; }

  .meta-row { display: flex; gap: 16px; }

  .legal-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 56px;
    align-items: start;
  }

  @media (max-width: 900px) { .legal-layout { grid-template-columns: 1fr; } }

  .legal-toc {
    position: sticky;
    top: 100px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 20px;
    border: 2px solid var(--border-hard);
    border-radius: 14px;
    background: var(--surface);
    box-shadow: var(--shadow-md);
  }

  @media (max-width: 900px) { .legal-toc { display: none; } }

  .toc-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .legal-toc a {
    display: block;
    padding: 7px 10px;
    border-radius: 7px;
    font-size: 13px;
    color: var(--text-2);
    text-decoration: none;
    transition: color 150ms ease, background 150ms ease;
  }

  .legal-toc a:hover { color: var(--text-1); background: var(--raised); }

  .legal-body { display: flex; flex-direction: column; gap: 40px; }

  .legal-block {
    scroll-margin-top: 100px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .legal-block h2 {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--text-1);
    margin-bottom: 16px;
  }

  .legal-block p {
    font-size: 15px;
    line-height: 1.78;
    color: var(--text-2);
    margin-bottom: 14px;
  }

  .legal-block ul {
    margin: 0 0 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .legal-block li { font-size: 15px; line-height: 1.72; color: var(--text-2); }

  /* ── FOOTER STRIP ────────────────────────────────── */
  .legal-footer-strip {
    border-top: 2px solid var(--border-hard);
    border-bottom: 2px solid var(--border-hard);
    background: var(--surface-2);
    padding: 32px 0;
  }

  .lfs-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }

  .lfs-inner strong { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--text-1); display: block; margin-bottom: 4px; }

  .lfs-inner p { font-size: 13px; color: var(--text-2); }

  .lfs-links { display: flex; gap: 10px; flex-wrap: wrap; }
</style>
