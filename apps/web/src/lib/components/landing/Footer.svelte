<script lang="ts">
  import { onMount } from 'svelte'

  const year = new Date().getFullYear()
  let visible = false
  let footerEl: HTMLElement | null = null

  onMount(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          visible = true
          observer.disconnect()
        }
      },
      { threshold: 0.18 }
    )

    if (footerEl) observer.observe(footerEl)

    return () => observer.disconnect()
  })
</script>

<footer class="footer" bind:this={footerEl}>
  <div class="footer-cta" class:is-visible={visible}>
    <p class="footer-kicker">Ready to ship files beautifully?</p>
    <h2>Open the workspace and make the product feel as premium as the promise.</h2>
    <div class="footer-actions">
      <a href="/workspace" class="btn-primary">Launch workspace</a>
      <a href="/receive" class="btn-secondary">Receive files</a>
    </div>
  </div>

  <div class="footer-meta" class:is-visible={visible}>
    <div class="footer-brand">
      <div class="footer-logo">
        <span class="footer-logo-mark">C</span>
        <div>
          <strong>clex</strong>
          <span>File workspace with motion-grade sharing.</span>
        </div>
      </div>
      <p>Prepare, route, and deliver files in one browser-native surface.</p>
    </div>

    <nav class="footer-nav" aria-label="Footer navigation">
      <a href="/workspace">Workspace</a>
      <a href="/#features">Workflow</a>
      <a href="/#how-it-works">Motion system</a>
    </nav>

    <div class="footer-copy">
      <span class="footer-badge">
        <span class="footer-badge-dot" />
        Privacy-first by default
      </span>
      <small>© {year} Clex</small>
    </div>
  </div>
</footer>

<style>
  .footer {
    padding: 32px 24px 44px;
  }

  .footer-cta,
  .footer-meta {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 700ms var(--ease-out), transform 700ms var(--ease-out);
  }

  .footer-cta.is-visible,
  .footer-meta.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .footer-meta.is-visible { transition-delay: 120ms; }

  .footer-cta {
    max-width: 1240px;
    margin: 0 auto 18px;
    padding: 34px;
    border-radius: 36px;
    border: 1px solid rgba(53, 212, 255, 0.18);
    background:
      radial-gradient(circle at top right, rgba(53, 212, 255, 0.14), transparent 26%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
      rgba(7, 10, 17, 0.88);
    box-shadow: 0 34px 90px rgba(0, 0, 0, 0.32);
    text-align: center;
  }

  :global(:not(.dark)) .footer-cta {
    background:
      radial-gradient(circle at top right, rgba(53, 212, 255, 0.14), transparent 26%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.74)),
      rgba(255, 255, 255, 0.82);
    box-shadow: 0 28px 80px rgba(10, 22, 45, 0.12);
  }

  .footer-kicker {
    margin: 0 0 12px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .footer-cta h2 {
    margin: 0 auto;
    max-width: 15ch;
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 5.6vw, 5rem);
    line-height: 0.98;
    letter-spacing: -0.05em;
    text-wrap: balance;
  }

  .footer-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 26px;
    flex-wrap: wrap;
  }

  .footer-meta {
    max-width: 1240px;
    margin: 0 auto;
    padding: 22px 10px 0;
    border-top: 1px solid var(--border);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 18px;
    align-items: center;
  }

  .footer-logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .footer-logo-mark {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #bff3ff 0%, #24bcff 100%);
    color: #04131d;
    font-weight: 900;
    box-shadow: 0 16px 32px rgba(33, 187, 255, 0.22);
  }

  .footer-brand strong {
    display: block;
    font-size: 15px;
    letter-spacing: -0.02em;
    color: var(--text-1);
  }

  .footer-brand span,
  .footer-brand p {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-2);
  }

  .footer-brand p {
    margin: 12px 0 0;
    max-width: 30rem;
  }

  .footer-nav {
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
  }

  .footer-nav a {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    text-decoration: none;
    transition: color 180ms ease;
  }

  .footer-nav a:hover {
    color: var(--text-1);
  }

  .footer-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .footer-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--raised);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .footer-badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--success);
    box-shadow: 0 0 14px rgba(74, 222, 179, 0.44);
  }

  .footer-copy small {
    font-size: 12px;
    color: var(--text-3);
  }

  @media (max-width: 920px) {
    .footer-meta {
      grid-template-columns: 1fr;
    }

    .footer-copy {
      align-items: flex-start;
    }
  }

  @media (max-width: 640px) {
    .footer {
      padding: 18px 18px 36px;
    }

    .footer-cta {
      padding: 26px 20px;
      text-align: left;
    }

    .footer-cta h2 {
      max-width: 11ch;
    }

    .footer-actions {
      justify-content: flex-start;
      flex-direction: column;
    }

    .footer-actions :global(.btn-primary),
    .footer-actions :global(.btn-secondary) {
      width: 100%;
    }
  }
</style>
