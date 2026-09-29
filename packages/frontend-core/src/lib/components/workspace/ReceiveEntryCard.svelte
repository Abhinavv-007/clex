<script lang="ts">
  /**
   * Receiving, right where you are. Typing the sender's code here opens the
   * workspace's Receive mode in place — no trip to another page. The route
   * comes from the code's first letter, so there is nothing else to choose.
   */
  import { parseRoomCode } from '$utils/crypto'

  let code = ''
  let error = ''

  $: parsed = parseRoomCode(code)

  function open() {
    if (!parsed) {
      error = 'Enter the code from the sender, like D7KQ2M'
      return
    }
    error = ''
    window.dispatchEvent(new CustomEvent('clex:workspace-mode', {
      detail: { mode: 'receive', code: code.trim() },
    }))
    code = ''
  }
</script>

<form class="rec-card" on:submit|preventDefault={open}>
  <div class="rec-copy">
    <span class="rec-label">Receiving files?</span>
    <p class="rec-text">Type the sender's code. Their route comes with it.</p>
  </div>

  <div class="rec-row">
    <input
      class="rec-input"
      type="text"
      bind:value={code}
      on:input={() => (error = '')}
      placeholder="D7KQ2M"
      maxlength="8"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      aria-label="Code from the sender"
    />
    <button class="btn-accent rec-btn" type="submit" disabled={!parsed}>
      Receive
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <path d="M2 5.5h7M6 2.5l3 3-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
  {#if error}
    <p class="rec-error" role="alert">{error}</p>
  {/if}
</form>

<style>
  .rec-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--border-strong);
    box-shadow: var(--shadow-sm);
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

  .rec-row {
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .rec-input {
    flex: 1 1 auto;
    min-width: 0;
    height: 40px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text-1);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .rec-input::placeholder {
    color: var(--text-3);
    opacity: 0.6;
  }

  .rec-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .rec-btn {
    flex: 0 0 auto;
    min-height: 40px;
    padding: 0 12px;
    justify-content: center;
    gap: 6px;
    font-weight: 700;
  }

  .rec-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rec-error {
    margin: 0;
    font-size: 11.5px;
    color: var(--red, #b1402c);
  }
</style>
