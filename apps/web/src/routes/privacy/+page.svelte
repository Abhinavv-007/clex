<script lang="ts">
  import Footer from '$components/landing/Footer.svelte'
  const lastUpdated = 'April 2025'
</script>

<svelte:head>
  <title>Privacy policy — Clex</title>
  <meta name="description" content="Clex privacy policy. How we handle your data, files, and Google Drive authorization. Short version: your files never touch our servers during P2P transfer." />
</svelte:head>

<section class="page-hero section">
  <div class="container">
    <div class="section-label enter-1"><span class="section-label-dot" />Legal</div>
    <h1 class="page-title enter-2">Privacy policy.</h1>
    <p class="page-sub enter-3">
      The short version: your files don't touch our servers.
      Here's the full picture.
    </p>
    <div class="meta-row enter-4">
      <span class="font-mono text-2xs text-text-3 uppercase tracking-widest">Last updated: {lastUpdated}</span>
    </div>
  </div>
</section>

<section class="legal-section section">
  <div class="container">
    <div class="legal-layout">

      <!-- TOC sidebar -->
      <nav class="legal-toc">
        <p class="toc-label font-mono">Contents</p>
        <a href="#overview">Overview</a>
        <a href="#file-data">File data</a>
        <a href="#p2p-transfer">P2P transfer</a>
        <a href="#google-drive">Google Drive</a>
        <a href="#signaling">Signaling server</a>
        <a href="#analytics">Analytics</a>
        <a href="#cookies">Cookies</a>
        <a href="#changes">Changes</a>
        <a href="#contact">Contact</a>
      </nav>

      <!-- Body -->
      <div class="legal-body">

        <div class="summary-card" id="overview">
          <h2 class="summary-title">Summary</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <span class="si-icon" style="background:var(--green);color:#000">✓</span>
              <div>
                <strong>Files never stored on Clex servers (P2P)</strong>
                <p>During direct P2P transfer, files go browser-to-browser. Our signaling server handles connection setup only.</p>
              </div>
            </div>
            <div class="summary-item">
              <span class="si-icon" style="background:var(--green);color:#000">✓</span>
              <div>
                <strong>All file operations are client-side</strong>
                <p>Compression, conversion, PDF operations — everything runs in your browser. No data is sent to our servers.</p>
              </div>
            </div>
            <div class="summary-item">
              <span class="si-icon" style="background:var(--green);color:#000">✓</span>
              <div>
                <strong>Google OAuth token never persisted server-side</strong>
                <p>Your Drive token is stored in sessionStorage only. It expires when you close the tab.</p>
              </div>
            </div>
            <div class="summary-item">
              <span class="si-icon" style="background:var(--green);color:#000">✓</span>
              <div>
                <strong>No account required for core features</strong>
                <p>P2P transfer and all file tools work without creating an account or providing any personal information.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="legal-block" id="file-data">
          <h2>1. File data</h2>
          <p>Clex is designed so that your files are never uploaded to or stored on Clex's infrastructure. All file processing — image compression, PDF merge and split, DOCX conversion, ZIP bundling — runs entirely in your browser using browser APIs and WebAssembly. No file content is transmitted to Clex servers at any point during file preparation.</p>
          <p>Files you work with in the Clex workspace exist only in your browser's memory for the duration of your session. When you close the tab, they are gone.</p>
        </div>

        <div class="legal-block" id="p2p-transfer">
          <h2>2. Direct P2P transfer</h2>
          <p>When you use direct P2P (WebRTC) transfer, your files travel from your browser directly to the receiver's browser using an encrypted WebRTC data channel. Clex's servers do not see or store file bytes during this transfer.</p>
          <p>The WebRTC connection is encrypted using DTLS-SRTP, which is enforced by the browser. All data transmitted through the WebRTC channel — including file bytes — is protected by this encryption layer.</p>
          <p>The only data our signaling server receives is the WebRTC handshake: ICE candidates and session description protocol (SDP) messages. These are connection metadata used to establish the peer-to-peer link. No file names, sizes, types, or content are included in signaling messages.</p>
        </div>

        <div class="legal-block" id="google-drive">
          <h2>3. Google Drive transfers</h2>
          <p>When you authorize Google Drive as a transfer method, Clex uses Google's OAuth 2.0 flow to obtain a scoped access token. This token is stored exclusively in your browser's <code>sessionStorage</code> and is never transmitted to Clex servers.</p>
          <p>When you upload a file via Google Drive, the file is sent directly from your browser to Google's API endpoints using your own access token. Clex's servers do not handle or relay the file data.</p>
          <p>The access token is scoped to: creating files in Google Drive, listing files in Google Drive. Clex does not request access to existing Drive files outside of what you explicitly create through the app.</p>
          <p>You can revoke Clex's access to your Google Drive at any time at myaccount.google.com/permissions.</p>
        </div>

        <div class="legal-block" id="signaling">
          <h2>4. Signaling server</h2>
          <p>The Clex signaling server (built on Cloudflare Workers with Durable Objects) handles WebRTC session negotiation. It processes the following data to establish P2P connections:</p>
          <ul>
            <li>Room codes (6-character random strings) for session matching</li>
            <li>ICE candidates (network connectivity information)</li>
            <li>SDP offer/answer messages (WebRTC session configuration)</li>
          </ul>
          <p>This data is transient. It exists only for the duration of the connection establishment and is not persisted. Once the P2P connection is established, the signaling server is no longer involved in the session.</p>
        </div>

        <div class="legal-block" id="analytics">
          <h2>5. Analytics and logging</h2>
          <p>Clex may collect minimal, anonymized usage analytics such as page view counts and feature interaction counts. No personally identifiable information is included in analytics data. File names, sizes, types, and content are never included in any analytics.</p>
          <p>Server access logs (standard to Cloudflare infrastructure) may include IP addresses and request metadata for security and operational purposes. These logs are subject to Cloudflare's data processing terms.</p>
        </div>

        <div class="legal-block" id="cookies">
          <h2>6. Cookies and storage</h2>
          <p>Clex uses a small number of browser storage mechanisms:</p>
          <ul>
            <li><strong>localStorage:</strong> Theme preference (dark/light mode) only.</li>
            <li><strong>sessionStorage:</strong> Google OAuth access token (if Drive is connected). Cleared on tab close.</li>
            <li><strong>Cookies:</strong> A temporary server-side cookie is set during Google OAuth callback to pass the access token to the client. It is immediately consumed and deleted.</li>
          </ul>
          <p>No tracking cookies, advertising cookies, or third-party analytics cookies are used.</p>
        </div>

        <div class="legal-block" id="changes">
          <h2>7. Changes to this policy</h2>
          <p>If we make material changes to this privacy policy, we will update the "last updated" date at the top of this page. Continued use of Clex after changes constitutes acceptance of the updated policy.</p>
        </div>

        <div class="legal-block" id="contact">
          <h2>8. Contact</h2>
          <p>For questions about this privacy policy or Clex's data practices, please open an issue at the Clex GitHub repository or reach out through the website.</p>
        </div>

      </div>
    </div>
  </div>
</section>

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

  /* ── LAYOUT ──────────────────────────────────────── */
  .legal-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 56px;
    align-items: start;
  }

  @media (max-width: 900px) { .legal-layout { grid-template-columns: 1fr; } }

  /* ── TOC ─────────────────────────────────────────── */
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

  /* ── BODY ────────────────────────────────────────── */
  .legal-body { display: flex; flex-direction: column; gap: 40px; }

  /* ── SUMMARY CARD ────────────────────────────────── */
  .summary-card {
    padding: 32px;
    border: 2px solid var(--border-hard);
    border-radius: 18px;
    background: var(--surface);
    box-shadow: var(--shadow-lg);
  }

  .summary-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    color: var(--text-1);
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border);
  }

  .summary-grid { display: flex; flex-direction: column; gap: 16px; }

  .summary-item { display: flex; gap: 16px; align-items: flex-start; }

  .si-icon {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: 1.5px solid #000;
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 900;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .summary-item strong { display: block; font-size: 14px; font-weight: 700; color: var(--text-1); margin-bottom: 4px; }

  .summary-item p { font-size: 13px; line-height: 1.6; color: var(--text-2); }

  /* ── LEGAL BLOCK ─────────────────────────────────── */
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

  .legal-block code {
    font-family: var(--font-mono);
    font-size: 13px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-1);
  }

  .legal-block strong { color: var(--text-1); font-weight: 700; }
</style>
