<script lang="ts">
  import Footer from '$components/landing/Footer.svelte'

  const faqGroups = [
    {
      label: 'Transfer & Privacy',
      faqs: [
        {
          q: 'Do my files go through Clex servers?',
          a: "During direct P2P transfer, your files never touch Clex servers. The signaling server handles WebRTC connection negotiation only — it sees connection requests, not file bytes. For Google Drive transfers, files go directly to your own Google account. Clex never stores them.",
        },
        {
          q: 'Is the P2P transfer encrypted?',
          a: 'Yes. WebRTC data channels are encrypted using DTLS-SRTP by default, which is a browser-enforced standard. The connection is established via HTTPS signaling, and file bytes are transferred over the encrypted data channel.',
        },
        {
          q: 'What happens to my Google OAuth token?',
          a: 'Your Google OAuth token is stored in your browser\'s sessionStorage only. It is never sent to or stored on Clex servers. It expires when you close your browser tab. The token is scoped to file creation and listing only.',
        },
        {
          q: 'Can Clex see my files?',
          a: 'No. All file processing (compression, conversion, PDF operations) runs in your browser. During P2P transfer, files go browser-to-browser. During Drive transfer, files go to your Google account. At no point does Clex access, store, or read your file contents.',
        },
        {
          q: 'What does the signaling server do exactly?',
          a: "The signaling server's only job is to relay WebRTC handshake messages (ICE candidates and session descriptions) between the sender and receiver browsers. It handles connection setup, not data transfer. Think of it as a matchmaking service — it introduces the browsers, then steps aside.",
        },
      ],
    },
    {
      label: 'Transfer speed & routing',
      faqs: [
        {
          q: 'How fast is direct P2P transfer?',
          a: "Speed depends on your internet connection, not Clex's servers — because files go browser-to-browser. On a typical broadband connection, you can expect 10–50 Mbps. On the same local network, speeds approach your LAN throughput (100–1000 Mbps).",
        },
        {
          q: 'What is local network routing?',
          a: "If sender and receiver are on the same Wi-Fi or wired network, Clex detects it and establishes a direct local connection. Files never leave your network. This gives you near-LAN-speed transfer for large files between devices on the same network.",
        },
        {
          q: 'When should I use Google Drive instead of P2P?',
          a: "Use P2P when both parties are online simultaneously. Use Google Drive when: (1) you need to send a link the receiver can download later, (2) firewalls block WebRTC, or (3) the receiver is on a restricted network. Drive always works as a reliable fallback.",
        },
        {
          q: 'Is there a file size limit?',
          a: "For P2P transfer, there is no Clex-imposed limit — the limit is your browser's memory and the stability of the WebRTC connection. For Google Drive, limits are set by Google's API quotas. For file operations (compression, conversion), the limit depends on your browser and device RAM.",
        },
      ],
    },
    {
      label: 'File tools',
      faqs: [
        {
          q: 'Does compression run on Clex servers?',
          a: 'No. Image compression uses browser-image-compression and the Canvas API. PDF operations use pdf-lib. DOCX conversion uses Mammoth. All of these run entirely in your browser — no server round-trips, no upload, no wait.',
        },
        {
          q: 'What file types does Clex support?',
          a: 'For transfer: any file type. For tools: images (JPEG, PNG, WebP), PDFs, DOCX, and any file for ZIP bundling. Format conversion supports JPEG, PNG, WebP output. PDF tools support merge, split, page extraction, and PDF-to-image export.',
        },
        {
          q: 'Can I compress multiple images at once?',
          a: 'Yes. Drop multiple images and the batch compression tool processes all of them in parallel. Each image gets its own progress indicator and download option.',
        },
        {
          q: 'Does DOCX to PDF preserve formatting?',
          a: "Clex uses Mammoth for DOCX parsing, which supports headings, paragraphs, bold/italic text, and lists with good fidelity. Complex layouts with embedded objects or custom fonts may not render perfectly — for production-critical formatting, verify the output before sending.",
        },
      ],
    },
    {
      label: 'Browser & offline support',
      faqs: [
        {
          q: 'Which browsers does Clex support?',
          a: 'Chrome 88+, Firefox 87+, Edge 88+, and Safari 15+. WebRTC P2P transfer requires a browser with RTCPeerConnection support. File tools (compression, PDF, conversion) work in any modern browser including mobile.',
        },
        {
          q: 'Does Clex work on mobile?',
          a: 'Yes. The workspace is responsive and usable on mobile. File tool operations work well on mobile browsers. P2P transfer on iOS may have some limitations due to Safari\'s WebRTC implementation — Google Drive is the recommended transfer method on iOS.',
        },
        {
          q: 'Can I use Clex without internet?',
          a: "After the first page load, all file preparation tools (compression, conversion, PDF operations) work offline. Transfer features require internet: P2P needs the signaling server to establish the connection, and Drive needs Google's API.",
        },
        {
          q: 'Do I need to install anything?',
          a: 'No. Clex is a web app — open it in any browser and it works immediately. No extension, no desktop app, no plugin required.',
        },
      ],
    },
    {
      label: 'Accounts & Google Drive',
      faqs: [
        {
          q: 'Do I need an account to use Clex?',
          a: 'No account is needed for P2P file transfer or any file tool operations. You only need a Google account if you choose to use Google Drive as the transfer method.',
        },
        {
          q: 'How does Google Drive authorization work?',
          a: "Clicking 'Connect Google Drive' opens a standard Google OAuth consent screen. You grant Clex permission to create and list files on your Drive. The authorization token is stored in your browser's sessionStorage only — it's never sent to or persisted on Clex servers.",
        },
        {
          q: "Can I revoke Clex's access to my Google Drive?",
          a: "Yes. Go to myaccount.google.com/permissions, find Clex, and revoke access. The token in your browser will also expire naturally when you close the tab.",
        },
        {
          q: 'Are Drive files deleted automatically?',
          a: "Clex doesn't automatically delete files from your Drive. Files transferred via Drive remain in your Google Drive under a 'Clex Transfers' folder until you delete them manually.",
        },
      ],
    },
  ]

  let openItems: Set<string> = new Set()

  function toggle(key: string) {
    if (openItems.has(key)) {
      openItems.delete(key)
    } else {
      openItems.add(key)
    }
    openItems = new Set(openItems)
  }

  function isOpen(key: string) {
    return openItems.has(key)
  }
</script>

<svelte:head>
  <title>FAQ — Clex</title>
  <meta name="description" content="Frequently asked questions about Clex: privacy, transfer routing, file tools, browser support, Google Drive, and more." />
</svelte:head>

<!-- Hero -->
<section class="page-hero section">
  <div class="container">
    <div class="section-label enter-1"><span class="section-label-dot" />FAQ</div>
    <h1 class="page-title enter-2">Frequently asked questions.</h1>
    <p class="page-sub enter-3">
      Everything you need to know about how Clex works, how it handles your files,
      and how to get the most out of it.
    </p>
  </div>
</section>

<!-- FAQ groups -->
<section class="faq-section section">
  <div class="container">
    <div class="faq-layout">

      <!-- Sticky nav -->
      <nav class="faq-sidebar">
        {#each faqGroups as group}
          <a href="#{group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}" class="faq-nav-link">
            {group.label}
          </a>
        {/each}
      </nav>

      <!-- FAQ content -->
      <div class="faq-content">
        {#each faqGroups as group}
          <div class="faq-group" id={group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
            <h2 class="group-title">{group.label}</h2>

            <div class="faq-items">
              {#each group.faqs as faq, i}
                {@const key = `${group.label}-${i}`}
                <div class="faq-item" class:faq-open={isOpen(key)}>
                  <button class="faq-question" on:click={() => toggle(key)}>
                    <span>{faq.q}</span>
                    <span class="faq-chevron" class:rotated={isOpen(key)}>▾</span>
                  </button>
                  {#if isOpen(key)}
                    <div class="faq-answer">
                      <p>{faq.a}</p>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<!-- Still stuck -->
<section class="contact-section section-sm">
  <div class="container">
    <div class="contact-card">
      <div class="contact-icon">?</div>
      <div class="contact-copy">
        <h3>Still have a question?</h3>
        <p>Check the getting started guide for a step-by-step walkthrough, or open the workspace and try it directly — most questions are answered by using it.</p>
      </div>
      <div class="contact-actions">
        <a href="/getting-started" class="btn-accent">Getting started guide</a>
        <a href="/workspace" class="btn-secondary">Open workspace</a>
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

  .page-sub { font-size: 18px; line-height: 1.7; color: var(--text-2); max-width: 52ch; }

  /* ── LAYOUT ──────────────────────────────────────── */
  .faq-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 56px;
    align-items: start;
  }

  @media (max-width: 900px) { .faq-layout { grid-template-columns: 1fr; } }

  /* ── SIDEBAR ─────────────────────────────────────── */
  .faq-sidebar {
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

  @media (max-width: 900px) { .faq-sidebar { display: none; } }

  .faq-nav-link {
    display: block;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
    text-decoration: none;
    transition: color 150ms ease, background 150ms ease;
  }

  .faq-nav-link:hover { color: var(--text-1); background: var(--raised); }

  /* ── CONTENT ─────────────────────────────────────── */
  .faq-content { display: flex; flex-direction: column; gap: 56px; }

  .faq-group { display: flex; flex-direction: column; gap: 16px; }

  .group-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-1);
    padding-bottom: 14px;
    border-bottom: 2px solid var(--border-hard);
  }

  .faq-items { display: flex; flex-direction: column; gap: 8px; }

  .faq-item {
    border: 2px solid var(--border-hard);
    border-radius: 14px;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: box-shadow 160ms ease;
  }

  .faq-item:hover { box-shadow: var(--shadow-md); }
  .faq-open { box-shadow: var(--shadow-md); }

  .faq-question {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    transition: background 150ms ease;
  }

  .faq-question:hover { background: var(--raised); }

  .faq-chevron {
    font-size: 18px;
    color: var(--text-3);
    flex-shrink: 0;
    transition: transform 200ms var(--ease-out);
    line-height: 1;
  }

  .faq-chevron.rotated { transform: rotate(180deg); }

  .faq-answer {
    padding: 0 20px 18px;
    border-top: 1px solid var(--border);
    animation: fadeUp 200ms var(--ease-out) both;
  }

  .faq-answer p {
    font-size: 14px;
    line-height: 1.72;
    color: var(--text-2);
    padding-top: 14px;
  }

  /* ── CONTACT ─────────────────────────────────────── */
  .contact-section { border-top: 2px solid var(--border-hard); }

  .contact-card {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 32px 36px;
    border: 2px solid var(--border-hard);
    border-radius: 18px;
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    flex-wrap: wrap;
  }

  .contact-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    border: 2px solid var(--border-hard);
    background: var(--accent);
    color: #000;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 700;
    box-shadow: 3px 3px 0 #000;
    flex-shrink: 0;
  }

  .contact-copy { flex: 1; min-width: 240px; }

  .contact-copy h3 { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text-1); margin-bottom: 6px; }

  .contact-copy p { font-size: 14px; line-height: 1.65; color: var(--text-2); }

  .contact-actions { display: flex; gap: 10px; flex-wrap: wrap; }
</style>
