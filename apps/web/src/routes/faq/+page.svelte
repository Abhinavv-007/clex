<script lang="ts">
  import Footer from '$components/landing/Footer.svelte'
  import { onMount } from 'svelte'

  let activeKey: string | null = null
  let heroVisible = false
  let heroEl: HTMLElement

  function toggle(key: string) {
    activeKey = activeKey === key ? null : key
  }

  function isOpen(key: string) {
    return activeKey === key
  }

  const faqGroups = [
    {
      id: 'transfer-methods',
      label: 'Transfer Methods',
      faqs: [
        {
          q: 'How does P2P transfer work?',
          a: 'Clex uses <strong>WebRTC</strong> to establish a direct browser-to-browser connection. Clex creates a unique session and uses a lightweight signaling server to help the two browsers find each other. Once connected, the files stream <strong>directly</strong> from your browser to the recipient\'s browser. No server stores or relays the actual file data.',
        },
        {
          q: 'What is local network transfer?',
          a: 'When both devices are on the <strong>same Wi-Fi network</strong>, Clex can detect this and transfer files over the local network instead of routing through the internet. This gives you <strong>LAN-speed transfers</strong> — ideal for large files, video, or batch transfers between your own devices.',
        },
        {
          q: 'When does Google Drive get used?',
          a: 'Google Drive is a <strong>fallback option</strong>. It\'s used when direct P2P or local network transfer isn\'t possible — for example, when devices are on restrictive networks or behind strict NATs. When you choose Drive, the file uploads to <strong>your Google Drive account</strong>, not to Clex\'s servers.',
        },
        {
          q: 'Do both browsers need to be open for P2P?',
          a: '<strong>Yes.</strong> For P2P and local network transfers, both sender and receiver need to keep their browser tabs open until the transfer completes. If either tab closes, the transfer stops. For asynchronous transfers, use the <strong>Google Drive fallback</strong>.',
        },
      ],
    },
    {
      id: 'privacy-security',
      label: 'Privacy & Security',
      faqs: [
        {
          q: 'Are my files stored on Clex servers?',
          a: '<strong>No.</strong> During P2P and local network transfers, your files are <strong>never</strong> stored on any Clex server. They exist only in the sender\'s and receiver\'s browsers during the transfer. The signaling server never sees or stores file data.',
        },
        {
          q: 'Do I need an account?',
          a: '<strong>No account is required</strong> for P2P or local network transfers. Just open Clex and go. The only time authentication is needed is when you choose <strong>Google Drive as a fallback</strong>, which requires signing into your Google account.',
        },
        {
          q: 'Is the transfer encrypted?',
          a: 'WebRTC connections are <strong>encrypted by default</strong> using DTLS (Datagram Transport Layer Security). Your P2P transfers are encrypted end-to-end between browsers. Google Drive transfers use <strong>Google\'s TLS encryption</strong>.',
        },
        {
          q: 'What happens to my Google OAuth token?',
          a: 'Your Google OAuth token is stored in your browser\'s <strong>sessionStorage only</strong>. It is never sent to or stored on Clex servers. It expires when you close your browser tab.',
        },
      ],
    },
    {
      id: 'speed-performance',
      label: 'Speed & Performance',
      faqs: [
        {
          q: 'How fast are transfers?',
          a: 'P2P transfers run at the speed of your internet connection — there\'s no server bottleneck. <strong>Local network transfers</strong> are even faster since they use your Wi-Fi\'s LAN speed (often 100+ Mbps). Google Drive speed depends on your upload bandwidth.',
        },
        {
          q: 'Is there a file size limit?',
          a: 'For P2P and local transfers, the limit is <strong>your browser\'s available RAM</strong>. Most modern browsers handle files up to several GB comfortably. For Google Drive, limits depend on your <strong>Drive storage quota</strong> (15 GB free tier).',
        },
      ],
    },
    {
      id: 'browser-support',
      label: 'Browser Support',
      faqs: [
        {
          q: 'Which browsers does Clex support?',
          a: 'Clex works in all modern browsers with WebRTC support: <strong>Chrome 88+</strong>, <strong>Firefox 87+</strong>, <strong>Safari 15+</strong>, <strong>Edge 88+</strong>, and their mobile equivalents.',
        },
        {
          q: 'Does it work on mobile?',
          a: '<strong>Yes.</strong> Clex is fully responsive and works on mobile browsers. You can drop files, use preparation tools, and share — all from your phone or tablet.',
        },
        {
          q: 'Do I need to install anything?',
          a: 'No. Clex is a web app — open it in any browser and it works immediately. <strong>No extension, no desktop app, no plugin required.</strong>',
        },
      ],
    },
    {
      id: 'file-handling',
      label: 'File Handling',
      faqs: [
        {
          q: 'What file types can I process?',
          a: 'Clex supports <strong>image compression and conversion</strong> (JPEG, PNG, WebP), <strong>PDF operations</strong> (merge, split, extract, export), <strong>DOCX to PDF conversion</strong>, and <strong>ZIP bundling</strong> for any file types.',
        },
        {
          q: 'What happens to my files after transfer?',
          a: 'For P2P and local transfers: <strong>nothing</strong>. The files existed only in browser memory during the transfer. When you close the tab, they\'re gone from Clex entirely. For Google Drive transfers, the file remains in <strong>your Google Drive</strong>.',
        },
        {
          q: 'Can I process files without sharing them?',
          a: '<strong>Absolutely.</strong> You can use Clex purely as a file preparation tool. Drop files, compress images, merge PDFs, convert formats, and download the results — all without ever using the sharing features.',
        },
      ],
    },
  ]

  onMount(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { heroVisible = true; obs.disconnect() } },
      { threshold: 0.05 }
    )
    if (heroEl) obs.observe(heroEl)

    const revealEls = document.querySelectorAll('.reveal-scroll')
    revealEls.forEach((el) => {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          ;(e.target as HTMLElement).classList.add('in-view')
          io.disconnect()
        }
      }, { threshold: 0.08 })
      io.observe(el)
    })

    return () => obs.disconnect()
  })
</script>

<svelte:head>
  <title>FAQ — Clex | Frequently Asked Questions</title>
  <meta name="description" content="Answers to common questions about Clex: transfer methods, privacy, file storage, speed, browser support, and file handling." />
</svelte:head>

<!-- Hero -->
<section class="faq-hero" bind:this={heroEl}>
  <div class="container">
    <span class="section-label faq-label" class:enter-done={heroVisible}>
      <span class="section-label-dot"></span>
      Support
    </span>
    <h1 class="faq-h1" class:enter-done={heroVisible}>
      Frequently<br>Asked Questions.
    </h1>
    <p class="faq-lead" class:enter-done={heroVisible}>
      Everything you need to know about how Clex handles your files, transfers, and privacy.
    </p>
  </div>
</section>

<!-- FAQ Content -->
<section class="section faq-content-section">
  <div class="container faq-container">

    {#each faqGroups as group}
      <div class="faq-group reveal-scroll" id={group.id}>
        <h2 class="faq-group-title font-mono">{group.label}</h2>

        <div class="accordion">
          {#each group.faqs as faq, i}
            <div class="accordion-item" class:accordion-item--open={isOpen(`${group.id}-${i}`)}>
              <button
                class="accordion-trigger font-mono"
                aria-expanded={isOpen(`${group.id}-${i}`)}
                on:click={() => toggle(`${group.id}-${i}`)}
              >
                <span class="accordion-q">{faq.q}</span>
                <span class="accordion-icon">{isOpen(`${group.id}-${i}`) ? '×' : '+'}</span>
              </button>

              {#if isOpen(`${group.id}-${i}`)}
                <div class="accordion-body faq-answer">
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html faq.a}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}

  </div>
</section>

<!-- CTA -->
<section class="faq-cta">
  <div class="container">
    <h2 class="faq-cta-title reveal-scroll">Still have questions?</h2>
    <p class="faq-cta-text reveal-scroll">Reach out or just open the workspace and try it — most questions answer themselves.</p>
    <div class="faq-cta-actions reveal-scroll">
      <a href="mailto:hello@clex.in" class="btn-secondary">Contact Us →</a>
      <a href="/workspace" class="btn-accent">Open Workspace →</a>
    </div>
  </div>
</section>

<Footer />

<style>
  /* ── Scroll reveal ─────────────────────── */
  :global(.reveal-scroll.in-view) { opacity: 1; transform: none; }
  .reveal-scroll {
    opacity: 0;
    transform: translateY(32px);
    transition: opacity 0.55s var(--ease-out), transform 0.55s var(--ease-out);
  }

  /* ── Hero entry ────────────────────────── */
  .faq-label { opacity: 0; transform: translateY(14px); transition: opacity .45s var(--ease-out), transform .45s var(--ease-out); }
  .faq-h1    { opacity: 0; transform: translateY(28px); transition: opacity .55s var(--ease-out) .1s, transform .55s var(--ease-out) .1s; }
  .faq-lead  { opacity: 0; transform: translateY(18px); transition: opacity .45s var(--ease-out) .2s, transform .45s var(--ease-out) .2s; }
  .faq-label.enter-done, .faq-h1.enter-done, .faq-lead.enter-done { opacity: 1; transform: none; }

  /* ── Hero ─────────────────────────────── */
  .faq-hero {
    padding: 10rem 0 5rem;
    background: var(--canvas);
    border-bottom: 2px solid var(--border-hard);
  }
  .faq-h1 {
    font-family: var(--font-display);
    font-size: clamp(3rem, 7vw, 6rem);
    font-weight: 700;
    line-height: 0.95;
    letter-spacing: -0.04em;
    color: var(--text-1);
    margin: 16px 0 20px;
  }
  .faq-lead {
    font-size: clamp(16px, 2vw, 18px);
    color: var(--text-2);
    line-height: 1.72;
    max-width: 50ch;
  }

  /* ── Layout ───────────────────────────── */
  .faq-content-section { padding-bottom: 6rem; }
  .faq-container { max-width: 840px; }

  /* ── FAQ Groups ───────────────────────── */
  .faq-group { margin-bottom: 4rem; }
  .faq-group-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 3px solid var(--accent);
    display: inline-block;
    color: var(--text-1);
  }

  /* ── Accordion ────────────────────────── */
  .accordion {
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-sm);
  }

  .accordion-item {
    border-bottom: 2px solid var(--border-hard);
    background: var(--surface);
  }
  .accordion-item:last-child { border-bottom: none; }
  .accordion-item--open { background: var(--surface-2); }

  .accordion-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: none;
    color: var(--text-1);
    gap: 16px;
    transition: background 120ms ease;
  }
  .accordion-trigger:hover { background: var(--raised); }
  .accordion-item--open .accordion-trigger { background: var(--raised); }

  .accordion-q { flex: 1; line-height: 1.5; }

  .accordion-icon {
    width: 22px; height: 22px;
    display: grid; place-items: center;
    flex-shrink: 0; font-size: 18px; font-weight: 400;
    color: var(--text-3); line-height: 1;
    font-family: var(--font-sans);
  }
  .accordion-item--open .accordion-icon { color: var(--accent); }

  .accordion-body {
    padding: 16px 20px 22px;
    border-top: 1px solid var(--border);
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.78;
    animation: bodyIn 240ms var(--ease-out) both;
  }

  @keyframes bodyIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: none; }
  }

  .faq-answer :global(strong) { color: var(--text-1); font-weight: 700; }
  .faq-answer :global(code) {
    font-family: var(--font-mono); font-size: 11px; padding: 2px 6px;
    background: var(--accent-dim); border: 1px solid var(--accent-border);
    border-radius: 3px; color: var(--accent);
  }

  /* ── CTA ──────────────────────────────── */
  .faq-cta {
    padding: 5rem 0; text-align: center;
    background: var(--surface-2);
    border-top: 2px solid var(--border-hard);
  }
  .faq-cta-title {
    font-family: var(--font-display);
    font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 700;
    letter-spacing: -0.04em; color: var(--text-1); margin-bottom: 12px;
  }
  .faq-cta-text {
    font-size: 16px; color: var(--text-2); max-width: 42ch;
    margin: 0 auto 28px; line-height: 1.7;
  }
  .faq-cta-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
</style>
