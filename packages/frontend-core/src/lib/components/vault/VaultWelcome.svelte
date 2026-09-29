<script lang="ts">
  /**
   * The empty vault. Instead of three blank panels: what Vault is, that it
   * is already locked to this device, and the three things to do first.
   */
  import { fade, fly } from 'svelte/transition'
  import { masterKey, vaultActions } from '$stores/vault'
  import { createVaultNote } from '$lib/vault/createNote'
  import HelloWord from '$components/ui/HelloWord.svelte'

  function openSecrets() {
    vaultActions.setPanel('secrets')
  }

  function openPairing() {
    vaultActions.setPanel('settings')
    vaultActions.setSettingsTab('devices')
    vaultActions.openPairingModal()
  }
</script>

<section class="vw" in:fade={{ duration: 220 }}>
  <div class="vw-art" aria-hidden="true">
    <svg viewBox="0 0 320 320">
      <defs>
        <radialGradient id="vw-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" style="stop-color: var(--accent); stop-opacity: 0.18" />
          <stop offset="1" style="stop-color: var(--accent); stop-opacity: 0" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="160" r="156" fill="url(#vw-glow)" />
      <g class="vw-ring vw-ring--outer">
        <circle cx="160" cy="160" r="128" />
        {#each Array(48) as _, i}
          <line x1="160" y1="36" x2="160" y2={i % 4 === 0 ? 48 : 42} transform="rotate({i * 7.5} 160 160)" />
        {/each}
      </g>
      <g class="vw-ring vw-ring--inner">
        <circle cx="160" cy="160" r="96" />
        {#each Array(12) as _, i}
          <circle cx="160" cy="76" r="3" transform="rotate({i * 30} 160 160)" />
        {/each}
      </g>
      <circle class="vw-hub" cx="160" cy="160" r="60" />
      <g class="vw-lock" transform="translate(160 162)">
        <path class="vw-shackle" d="M -15 -6 V -16 a 15 15 0 0 1 30 0 V -6" />
        <rect x="-23" y="-7" width="46" height="36" rx="8" />
        <circle cx="0" cy="8" r="4.5" />
        <path d="M 0 11 V 18" />
      </g>
      <g class="vw-note">
        <rect x="206" y="198" width="92" height="66" rx="10" />
        <path d="M 220 216 h 50 M 220 230 h 64 M 220 244 h 38" />
      </g>
    </svg>
  </div>

  <div class="vw-copy" in:fly={{ y: 10, duration: 320, delay: 80 }}>
    <span class="vw-kicker"><span class="vw-dot"></span>Your vault is ready, and empty</span>
    <h2 class="vw-title">Private by default, <HelloWord text="yours alone" scale={1.15} delay={250} /></h2>
    <p class="vw-lede">
      Everything here is encrypted in this browser before it is saved. Sync between your devices and the backup that
      lets you restore carry only ciphertext, and nothing from Vault ever reaches the public chain.
    </p>

    <div class="vw-actions">
      <button class="vw-action vw-action--primary" type="button" on:click={() => createVaultNote()}>
        <span class="vw-action-icon">
          <svg viewBox="0 0 20 20" width="18" height="18"><path d="M5 3.5h7l3 3v10H5z M12 3.5v3h3 M7.5 10h5 M7.5 13h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" /></svg>
        </span>
        <span class="vw-action-copy"><b>Write a note</b><small>Markdown, folders, tags, search</small></span>
        <span class="vw-action-arrow" aria-hidden="true">→</span>
      </button>
      <button class="vw-action" type="button" on:click={openSecrets}>
        <span class="vw-action-icon">
          <svg viewBox="0 0 20 20" width="18" height="18"><path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1 M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
        </span>
        <span class="vw-action-copy"><b>Create a secret link</b><small>Expiry, view once, reveal codes</small></span>
        <span class="vw-action-arrow" aria-hidden="true">→</span>
      </button>
      <button class="vw-action" type="button" on:click={openPairing}>
        <span class="vw-action-icon">
          <svg viewBox="0 0 20 20" width="18" height="18"><rect x="2.5" y="4" width="10" height="7.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M1.5 14h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /><rect x="14" y="7" width="4.5" height="9" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
        </span>
        <span class="vw-action-copy"><b>Pair a device</b><small>Sync peer to peer with a code</small></span>
        <span class="vw-action-arrow" aria-hidden="true">→</span>
      </button>
    </div>

    <ul class="vw-facts">
      <li>AES-GCM 256</li>
      <li>Key <code>{$masterKey?.fingerprint ?? '········'}</code></li>
      <li>Stored in this browser</li>
      <li>Never on the chain</li>
    </ul>
  </div>
</section>

<style>
  .vw {
    display: grid;
    grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.2fr);
    align-items: center;
    gap: clamp(20px, 4vw, 56px);
    min-height: min(62vh, 600px);
    padding: clamp(20px, 4vw, 48px);
    border: 1px solid var(--border);
    border-radius: 22px;
    background:
      radial-gradient(ellipse 50% 70% at 20% 50%, var(--accent-dim), transparent 70%),
      var(--surface);
    box-shadow: var(--shadow-md);
  }

  .vw-art svg {
    width: 100%;
    max-width: 340px;
    display: block;
    margin: 0 auto;
    overflow: visible;
  }

  .vw-ring circle,
  .vw-ring line {
    fill: none;
    stroke: var(--border-strong);
    stroke-width: 1.4;
  }

  .vw-ring--outer line:nth-child(4n + 2) {
    stroke: var(--accent);
  }

  .vw-ring--inner circle:not(:first-child) {
    fill: var(--accent);
    stroke: none;
    opacity: 0.55;
  }

  .vw-ring--outer {
    transform-origin: 160px 160px;
    animation: vw-turn 40s linear infinite;
  }

  .vw-ring--inner {
    transform-origin: 160px 160px;
    animation: vw-turn 26s linear infinite reverse;
  }

  @keyframes vw-turn {
    to { transform: rotate(360deg); }
  }

  .vw-hub {
    fill: var(--surface);
    stroke: var(--border-strong);
    stroke-width: 1.4;
    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.12));
  }

  .vw-lock rect,
  .vw-lock path,
  .vw-lock circle {
    fill: none;
    stroke: var(--accent);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .vw-lock rect {
    fill: var(--accent-dim);
  }

  .vw-shackle {
    animation: vw-shackle 3.6s var(--ease-out) infinite;
  }

  @keyframes vw-shackle {
    0%, 55%, 100% { transform: translateY(0); }
    70% { transform: translateY(-5px); }
    80% { transform: translateY(0); }
  }

  .vw-note rect {
    fill: var(--surface);
    stroke: var(--border-strong);
    stroke-width: 1.4;
  }

  .vw-note path {
    stroke: var(--border-strong);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .vw-note {
    animation: vw-note 5s var(--ease-out) infinite;
  }

  @keyframes vw-note {
    0%, 20% { transform: translate(0, 0); opacity: 1; }
    55% { transform: translate(-66px, -54px) scale(0.5); opacity: 0; }
    56%, 70% { transform: translate(0, 0); opacity: 0; }
    100% { opacity: 1; }
  }

  .vw-copy {
    display: grid;
    gap: 16px;
    min-width: 0;
  }

  .vw-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .vw-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-dim);
  }

  .vw-title {
    margin: 0;
    font-size: clamp(1.9rem, 1.2rem + 2.4vw, 3rem);
    font-weight: 600;
    line-height: 1.02;
    letter-spacing: -0.045em;
    color: var(--text-1);
  }


  .vw-lede {
    max-width: 44em;
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-2);
  }

  .vw-actions {
    display: grid;
    gap: 10px;
    margin-top: 6px;
  }

  .vw-action {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-2);
    color: var(--text-1);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 200ms var(--ease-out), transform 300ms var(--spring), background 200ms var(--ease-out);
  }

  .vw-action:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }

  .vw-action--primary {
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
    background: var(--accent-dim);
  }

  .vw-action-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 11px;
    background: var(--surface);
    color: var(--accent-text);
    box-shadow: var(--shadow-sm);
  }

  .vw-action-copy {
    display: grid;
    gap: 2px;
  }

  .vw-action-copy b {
    font-weight: 500;
  }

  .vw-action-copy small {
    font-size: 12.5px;
    color: var(--text-3);
  }

  .vw-action-arrow {
    color: var(--text-3);
    transition: transform 300ms var(--spring), color 200ms;
  }

  .vw-action:hover .vw-action-arrow {
    transform: translateX(3px);
    color: var(--accent-text);
  }

  .vw-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }

  .vw-facts li {
    padding: 5px 10px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
  }

  .vw-facts code {
    color: var(--accent-text);
  }

  @media (max-width: 820px) {
    .vw {
      grid-template-columns: 1fr;
    }

    .vw-art svg {
      max-width: 220px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .vw-ring--outer,
    .vw-ring--inner,
    .vw-shackle,
    .vw-note {
      animation: none;
    }
  }
</style>
