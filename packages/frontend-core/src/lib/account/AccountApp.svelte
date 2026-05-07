<script lang="ts">
  /**
   * Clex Account — API key management for programmatic uploads.
   *
   * Sign-in:    Google Firebase popup (reuses signInWithGoogle from $lib/vault/auth)
   * After auth: stays on /account (or redirects back to ?next=… if provided).
   * Lists, creates, edits, revokes API keys; copies plaintext on creation.
   */
  import { onMount, onDestroy } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { onVaultAuthChanged, signInWithGoogle, signOutGoogle, type VaultUser } from '$lib/vault/auth'

  // Lint-friendly autofocus action — Svelte's `autofocus` attribute warns
  // because raw HTML autofocus is hostile to screen readers, but we need it
  // when the modal opens. Using an action keeps the warning suppressed
  // without disabling the rule globally.
  function autofocus(node: HTMLElement) {
    requestAnimationFrame(() => node.focus?.())
  }
  import {
    listApiKeys,
    createApiKey,
    updateApiKey,
    revokeApiKey,
    formatFileSize,
    formatRate,
    FILE_SIZE_PRESETS,
    RATE_PRESETS,
    type ApiKeyRecord,
  } from './apiKeys'

  export let vaultApiUrl: string = '/vault/api'
  /** When supplied via ?next=… the sign-in flow returns the user to that URL. */
  export let nextUrl: string = ''

  let user: VaultUser | null = null
  let unsub: (() => void) | undefined
  let booted = false
  let loadingKeys = false
  let signingIn = false
  let error = ''

  let keys: ApiKeyRecord[] = []

  let showCreate = false
  let createName = ''
  let createMaxFileBytes = FILE_SIZE_PRESETS[1].value
  let createRatePerMinute = RATE_PRESETS[0].value
  let creating = false
  let lastPlaintext = ''
  let plaintextCopied = false
  let plaintextDismissed = false

  let editingKeyId: string | null = null
  let editName = ''
  let editMaxFileBytes = 0
  let editRatePerMinute = 0
  let savingEdit = false

  let confirmRevokeId: string | null = null

  onMount(async () => {
    unsub = await onVaultAuthChanged(async (next) => {
      user = next
      booted = true
      if (next) {
        await loadKeys(next.uid)
        if (nextUrl) {
          // The returnTo flow only fires once per page load.
          const target = sanitizeNext(nextUrl)
          nextUrl = ''
          if (target) window.location.href = target
        }
      } else {
        keys = []
      }
    })
  })

  onDestroy(() => {
    unsub?.()
  })

  function sanitizeNext(raw: string): string | null {
    if (!raw) return null
    try {
      const url = new URL(raw, window.location.origin)
      // Same-origin only — never bounce off-site.
      if (url.origin !== window.location.origin) return null
      // Avoid trivial bounce-loop back to /account.
      if (url.pathname === window.location.pathname) return null
      return url.toString()
    } catch {
      return null
    }
  }

  async function loadKeys(uid: string) {
    loadingKeys = true
    error = ''
    try {
      const data = await listApiKeys({ baseUrl: vaultApiUrl, uid })
      keys = data.keys
    } catch (e) {
      error = (e as Error).message ?? 'Failed to load keys'
    } finally {
      loadingKeys = false
    }
  }

  async function signIn() {
    signingIn = true
    error = ''
    try {
      await signInWithGoogle()
    } catch (e) {
      error = (e as Error).message ?? 'Sign in failed'
    } finally {
      signingIn = false
    }
  }

  async function signOut() {
    await signOutGoogle()
    keys = []
  }

  function openCreate() {
    showCreate = true
    createName = ''
    createMaxFileBytes = FILE_SIZE_PRESETS[1].value
    createRatePerMinute = RATE_PRESETS[0].value
    lastPlaintext = ''
    plaintextCopied = false
    plaintextDismissed = false
  }

  async function submitCreate() {
    if (!user) return
    if (!createName.trim()) {
      error = 'Give your key a name first.'
      return
    }
    creating = true
    error = ''
    try {
      const res = await createApiKey(
        {
          name: createName.trim(),
          email: user.email ?? undefined,
          maxFileBytes: createMaxFileBytes,
          ratePerMinute: createRatePerMinute,
        },
        { baseUrl: vaultApiUrl, uid: user.uid },
      )
      lastPlaintext = res.plaintext
      keys = [res.key, ...keys]
      showCreate = false
    } catch (e) {
      error = (e as Error).message ?? 'Failed to create key'
    } finally {
      creating = false
    }
  }

  function startEdit(key: ApiKeyRecord) {
    editingKeyId = key.id
    editName = key.name
    editMaxFileBytes = key.maxFileBytes
    editRatePerMinute = key.ratePerMinute
  }

  async function submitEdit() {
    if (!user || !editingKeyId) return
    savingEdit = true
    error = ''
    try {
      const res = await updateApiKey(
        editingKeyId,
        {
          name: editName.trim(),
          maxFileBytes: editMaxFileBytes,
          ratePerMinute: editRatePerMinute,
        },
        { baseUrl: vaultApiUrl, uid: user.uid },
      )
      keys = keys.map((k) => (k.id === editingKeyId ? res.key : k))
      editingKeyId = null
    } catch (e) {
      error = (e as Error).message ?? 'Failed to update key'
    } finally {
      savingEdit = false
    }
  }

  async function confirmRevoke(keyId: string) {
    if (!user) return
    error = ''
    try {
      await revokeApiKey(keyId, { baseUrl: vaultApiUrl, uid: user.uid })
      keys = keys.filter((k) => k.id !== keyId)
    } catch (e) {
      error = (e as Error).message ?? 'Failed to revoke key'
    } finally {
      confirmRevokeId = null
    }
  }

  async function copyPlaintext() {
    if (!lastPlaintext) return
    try {
      await navigator.clipboard.writeText(lastPlaintext)
      plaintextCopied = true
      setTimeout(() => { plaintextCopied = false }, 2000)
    } catch {
      // ignore — user can still select the text manually
    }
  }

  function dismissPlaintext() {
    lastPlaintext = ''
    plaintextDismissed = true
  }

  function fmtTimeAgo(ts: number | null): string {
    if (!ts) return 'never'
    const diff = Math.floor(Date.now() / 1000) - ts
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }
</script>

<div class="account">
  <header class="account__header">
    <div class="account__heading">
      <span class="account__eyebrow">DEVELOPERS · ACCOUNT</span>
      <h1 class="account__title">Your API <em>keys</em></h1>
      <p class="account__sub">
        Mint signed credentials for the <code>POST /vault/api/uploads</code> endpoint.
        Set per-key file size + rate caps. Plaintext is shown once, never stored.
      </p>
    </div>

    {#if booted && user}
      <div class="account__user" in:fly={{ y: 6, duration: 220 }}>
        {#if user.photoURL}
          <img src={user.photoURL} alt="" class="account__avatar" />
        {/if}
        <div class="account__user-meta">
          <span class="account__user-name">{user.displayName ?? user.email}</span>
          <button class="account__signout" on:click={signOut}>Sign out</button>
        </div>
      </div>
    {/if}
  </header>

  {#if error}
    <div class="account__error" role="alert" transition:fade={{ duration: 160 }}>
      {error}
    </div>
  {/if}

  {#if !booted}
    <section class="card card--center" aria-busy="true">
      <div class="dot-spinner" />
      <p class="muted">Checking sign-in…</p>
    </section>
  {:else if !user}
    <section class="card card--center card--cta">
      <div class="signin">
        <h2 class="signin__title">Sign in with Google</h2>
        <p class="signin__sub">
          Used only to scope keys to your account. We never see the contents of files
          you transfer through Clex Direct.
        </p>
        <button
          type="button"
          class="signin__button"
          on:click={signIn}
          disabled={signingIn}
        >
          {#if signingIn}Opening Google…{:else}Continue with Google{/if}
        </button>
      </div>
    </section>
  {:else}
    <section class="account__panel">
      <div class="account__panel-header">
        <h2 class="account__panel-title">
          {keys.length} active key{keys.length === 1 ? '' : 's'}
        </h2>
        <button class="btn btn--primary" type="button" on:click={openCreate}>
          + New key
        </button>
      </div>

      {#if lastPlaintext && !plaintextDismissed}
        <div class="plaintext" transition:fly={{ y: -8, duration: 240 }}>
          <header class="plaintext__head">
            <strong>Copy your key now</strong>
            <span class="plaintext__hint">This is the only time we'll show it.</span>
          </header>
          <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
          <code class="plaintext__value" tabindex="0">{lastPlaintext}</code>
          <div class="plaintext__actions">
            <button class="btn btn--ghost" type="button" on:click={copyPlaintext}>
              {plaintextCopied ? 'Copied ✓' : 'Copy'}
            </button>
            <button class="btn btn--quiet" type="button" on:click={dismissPlaintext}>
              I've stored it safely
            </button>
          </div>
        </div>
      {/if}

      {#if loadingKeys && keys.length === 0}
        <div class="card card--center">
          <div class="dot-spinner" />
        </div>
      {:else if keys.length === 0}
        <div class="empty">
          <p>No keys yet. Create one to get a curl-able upload endpoint.</p>
        </div>
      {:else}
        <ul class="keys">
          {#each keys as key (key.id)}
            <li class="key-card">
              {#if editingKeyId === key.id}
                <form
                  class="key-card__edit"
                  on:submit|preventDefault={submitEdit}
                >
                  <label class="field">
                    <span class="field__label">Key name</span>
                    <input
                      class="field__input"
                      type="text"
                      maxlength="64"
                      bind:value={editName}
                      placeholder="ci-uploader"
                      required
                    />
                  </label>
                  <div class="field-row">
                    <label class="field">
                      <span class="field__label">Max file size</span>
                      <select class="field__input" bind:value={editMaxFileBytes}>
                        {#each FILE_SIZE_PRESETS as p}
                          <option value={p.value}>{p.label}</option>
                        {/each}
                      </select>
                    </label>
                    <label class="field">
                      <span class="field__label">Rate</span>
                      <select class="field__input" bind:value={editRatePerMinute}>
                        {#each RATE_PRESETS as p}
                          <option value={p.value}>{p.label}</option>
                        {/each}
                      </select>
                    </label>
                  </div>
                  <div class="key-card__actions">
                    <button class="btn btn--ghost" type="button" on:click={() => editingKeyId = null}>
                      Cancel
                    </button>
                    <button class="btn btn--primary" type="submit" disabled={savingEdit}>
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              {:else}
                <div class="key-card__row">
                  <div class="key-card__id">
                    <span class="key-card__name" title={key.name}>{key.name}</span>
                    <code class="key-card__prefix">{key.prefix}…</code>
                  </div>
                  <div class="key-card__meta">
                    <span class="meta-pill">{formatFileSize(key.maxFileBytes)}</span>
                    <span class="meta-pill">{formatRate(key.ratePerMinute)}</span>
                    <span class="meta-pill meta-pill--quiet">
                      {key.totalUploads} upload{key.totalUploads === 1 ? '' : 's'}
                    </span>
                    <span class="meta-pill meta-pill--quiet">last used {fmtTimeAgo(key.lastUsedAt)}</span>
                  </div>
                </div>
                <div class="key-card__actions">
                  <button class="btn btn--ghost" type="button" on:click={() => startEdit(key)}>
                    Edit
                  </button>
                  {#if confirmRevokeId === key.id}
                    <button class="btn btn--ghost" type="button" on:click={() => confirmRevokeId = null}>
                      Cancel
                    </button>
                    <button class="btn btn--danger" type="button" on:click={() => confirmRevoke(key.id)}>
                      Revoke key
                    </button>
                  {:else}
                    <button class="btn btn--quiet" type="button" on:click={() => confirmRevokeId = key.id}>
                      Revoke
                    </button>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if showCreate}
      <div class="modal" role="dialog" aria-modal="true" transition:fade={{ duration: 140 }}>
        <button
          class="modal__scrim"
          aria-label="Close"
          type="button"
          on:click={() => showCreate = false}
        />
        <form class="modal__panel" on:submit|preventDefault={submitCreate}>
          <h3 class="modal__title">New API key</h3>
          <p class="modal__sub">Limits can be adjusted later.</p>
          <label class="field">
            <span class="field__label">Key name</span>
            <input
              class="field__input"
              type="text"
              maxlength="64"
              bind:value={createName}
              placeholder="e.g. ci-uploader"
              required
              use:autofocus
            />
          </label>
          <div class="field-row">
            <label class="field">
              <span class="field__label">Max file size</span>
              <select class="field__input" bind:value={createMaxFileBytes}>
                {#each FILE_SIZE_PRESETS as p}
                  <option value={p.value}>{p.label}</option>
                {/each}
              </select>
            </label>
            <label class="field">
              <span class="field__label">Rate (per minute)</span>
              <select class="field__input" bind:value={createRatePerMinute}>
                {#each RATE_PRESETS as p}
                  <option value={p.value}>{p.label}</option>
                {/each}
              </select>
            </label>
          </div>
          <footer class="modal__actions">
            <button class="btn btn--ghost" type="button" on:click={() => showCreate = false}>
              Cancel
            </button>
            <button class="btn btn--primary" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create key'}
            </button>
          </footer>
        </form>
      </div>
    {/if}
  {/if}
</div>

<style>
  .account {
    --shadow-paper: 0 22px 48px -32px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    color: var(--text-primary, #111);
    min-width: 0;
  }

  .account__header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.25rem;
  }

  .account__heading { max-width: 640px; }

  .account__eyebrow {
    font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--text-secondary, #666) 88%, transparent);
  }

  .account__title {
    margin: 0.4rem 0 0.6rem;
    font-family: 'Cormorant Garamond', 'Cormorant', Georgia, serif;
    font-weight: 500;
    font-size: clamp(2.4rem, 4.5vw, 3.6rem);
    letter-spacing: -0.01em;
    line-height: 1.05;
  }
  .account__title em {
    font-style: italic;
    font-weight: 500;
    color: color-mix(in srgb, var(--accent-text, var(--accent, #c8ff00)) 90%, var(--text-primary, #111));
  }

  .account__sub {
    color: var(--text-secondary, #555);
    line-height: 1.55;
    max-width: 60ch;
  }

  .account__sub code {
    font-family: var(--font-mono, monospace);
    font-size: 0.85em;
    background: color-mix(in srgb, var(--accent, #c8ff00) 14%, transparent);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .account__user {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    border: 1px solid var(--border-color, #d0c9ba);
    border-radius: 9999px;
    padding: 0.35rem 0.9rem 0.35rem 0.45rem;
    background: color-mix(in srgb, var(--bg-card, #fff) 92%, transparent);
  }
  .account__avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    object-fit: cover;
  }
  .account__user-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .account__user-name {
    font-size: 0.8rem;
    color: var(--text-primary);
    font-weight: 500;
  }
  .account__signout {
    background: none;
    border: none;
    padding: 0;
    color: var(--text-tertiary, #888);
    font-size: 0.78rem;
    cursor: pointer;
    text-decoration: underline dotted color-mix(in srgb, var(--text-tertiary, #888) 60%, transparent);
  }
  .account__signout:hover { color: var(--text-primary); }

  .account__error {
    background: color-mix(in srgb, #d44 18%, transparent);
    border: 1px solid color-mix(in srgb, #d44 60%, transparent);
    color: #d44;
    padding: 0.6rem 0.9rem;
    border-radius: 10px;
    font-size: 0.85rem;
  }

  .card {
    background: color-mix(in srgb, var(--bg-card, #fff) 96%, transparent);
    border: 1px solid var(--border-color, #d0c9ba);
    border-radius: 18px;
    padding: 1.6rem;
    box-shadow: var(--shadow-paper);
  }
  .card--center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    text-align: center;
    min-height: 180px;
  }
  .card--cta {
    padding: 2.4rem 1.6rem;
  }

  .signin__title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-style: italic;
    font-weight: 500;
    font-size: 1.8rem;
    margin: 0 0 0.4rem;
  }
  .signin__sub {
    color: var(--text-secondary, #555);
    max-width: 36ch;
    line-height: 1.55;
    margin: 0 auto 1.2rem;
  }
  .signin__button {
    background: var(--text-primary, #111);
    color: var(--bg-card, #fff);
    padding: 0.75rem 1.4rem;
    border: 1px solid var(--text-primary, #111);
    border-radius: 9999px;
    font-family: var(--font-mono, monospace);
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 200ms ease;
  }
  .signin__button:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px -10px color-mix(in srgb, var(--text-primary, #111) 60%, transparent);
  }
  .signin__button:disabled { opacity: 0.5; cursor: not-allowed; }

  .account__panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .account__panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .account__panel-title {
    margin: 0;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 1.6rem;
    font-weight: 500;
  }

  .btn {
    border: 1px solid var(--border-color, #d0c9ba);
    border-radius: 9999px;
    padding: 0.5rem 1.05rem;
    font-family: var(--font-mono, monospace);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
    background: color-mix(in srgb, var(--bg-card, #fff) 95%, transparent);
    color: var(--text-primary, #111);
    transition: transform 100ms ease, background 160ms ease;
  }
  .btn:hover { transform: translateY(-1px); }
  .btn--primary {
    background: var(--text-primary, #111);
    color: var(--bg-card, #fff);
    border-color: var(--text-primary, #111);
  }
  .btn--ghost {
    background: transparent;
    color: var(--text-primary);
  }
  .btn--quiet {
    background: transparent;
    border-color: transparent;
    color: var(--text-secondary, #555);
  }
  .btn--quiet:hover {
    color: var(--text-primary);
    background: color-mix(in srgb, var(--text-primary, #111) 6%, transparent);
  }
  .btn--danger {
    background: #b53b2b;
    color: #fff;
    border-color: #b53b2b;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .empty {
    border: 1px dashed var(--border-color, #d0c9ba);
    padding: 2rem;
    border-radius: 18px;
    text-align: center;
    color: var(--text-secondary, #555);
  }

  .keys {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }

  .key-card {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1.1rem 1.2rem;
    border: 1px solid var(--border-color, #d0c9ba);
    border-radius: 16px;
    background: color-mix(in srgb, var(--bg-card, #fff) 95%, transparent);
    box-shadow: var(--shadow-paper);
  }

  .key-card__row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
  }

  .key-card__id {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  .key-card__name {
    font-weight: 600;
    font-size: 1rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 28ch;
  }
  .key-card__prefix {
    font-family: var(--font-mono, monospace);
    color: var(--text-tertiary, #888);
    font-size: 0.78rem;
  }

  .key-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .meta-pill {
    font-family: var(--font-mono, monospace);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    background: color-mix(in srgb, var(--accent, #c8ff00) 16%, transparent);
    color: color-mix(in srgb, var(--text-primary, #111) 92%, transparent);
    padding: 4px 10px;
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--accent, #c8ff00) 30%, var(--border-color, #d0c9ba));
  }
  .meta-pill--quiet {
    background: transparent;
    color: var(--text-tertiary, #888);
    border-color: var(--border-color, #d0c9ba);
  }

  .key-card__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .key-card__edit {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .field__label {
    font-family: var(--font-mono, monospace);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--text-secondary, #555);
  }
  .field__input {
    background: color-mix(in srgb, var(--bg-input, #fff) 96%, transparent);
    border: 1px solid var(--border-color, #d0c9ba);
    border-radius: 12px;
    padding: 0.65rem 0.8rem;
    font-size: 0.92rem;
    color: var(--text-primary);
    font-family: inherit;
    min-width: 0;
  }
  .field__input:focus {
    outline: none;
    border-color: var(--accent, #c8ff00);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #c8ff00) 20%, transparent);
  }

  .field-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.85rem;
  }

  .plaintext {
    border: 2px dashed color-mix(in srgb, var(--accent, #c8ff00) 60%, var(--border-color, #d0c9ba));
    border-radius: 16px;
    padding: 1rem 1.2rem;
    background: color-mix(in srgb, var(--accent, #c8ff00) 10%, transparent);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .plaintext__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.6rem;
    justify-content: space-between;
  }
  .plaintext__hint {
    font-size: 0.78rem;
    color: var(--text-secondary, #555);
  }
  .plaintext__value {
    display: block;
    font-family: var(--font-mono, monospace);
    background: color-mix(in srgb, var(--text-primary, #111) 8%, transparent);
    padding: 0.7rem 0.9rem;
    border-radius: 10px;
    word-break: break-all;
    font-size: 0.85rem;
    user-select: all;
  }
  .plaintext__actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .modal {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .modal__scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    border: none;
    cursor: pointer;
  }
  .modal__panel {
    position: relative;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-color, #d0c9ba);
    border-radius: 18px;
    padding: 1.5rem;
    width: min(440px, 92vw);
    box-shadow: 0 32px 64px -28px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .modal__title {
    margin: 0;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 500;
    font-size: 1.6rem;
  }
  .modal__sub {
    margin: 0;
    color: var(--text-secondary, #555);
    font-size: 0.85rem;
  }
  .modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .dot-spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px dotted currentColor;
    animation: spin 1.4s linear infinite;
    color: var(--accent, #c8ff00);
  }

  .muted { color: var(--text-secondary, #555); font-size: 0.85rem; }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
