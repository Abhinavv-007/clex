<script lang="ts">
  import { siteRoutes } from '$utils'

  export let receiveEntryHref = siteRoutes.receive
</script>

<section class="rec-card">
  <div class="rec-copy">
    <span class="rec-label">Receiving files?</span>
    <p class="rec-text">Open the receive screen and enter the room code to start downloading.</p>
  </div>

  <a href={receiveEntryHref} class="btn-accent rec-btn">
    Enter room code
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M2 5.5h7M6 2.5l3 3-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </a>
</section>

<style>
  .rec-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 2px solid var(--border-hard);
    box-shadow: 3px 3px 0 var(--border-hard);
    border-radius: 14px;
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    min-width: 0;
  }

  .rec-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .rec-label {
    font-size: 12px;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
  }

  .rec-text {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    color: var(--text-2);
  }

  .rec-btn {
    width: 100%;
    min-height: 44px;
    justify-content: center;
    gap: 6px;
    text-decoration: none;
    font-weight: 700;
  }
</style>
