<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { ChainClient } from '$chain/client'
  import { getChainId, formatChainId } from '$utils/chainId'
  import { formatBytes } from '$utils/format'
  import type { ExplorerSession, ChainStats, SessionDetail } from '$chain/client'

  export let chainApiUrl = 'http://localhost:8789'

  // ── State ─────────────────────────────────────────────────────────────────
  let client: ChainClient
  let myChainId = ''
  let displayId = ''

  let stats: ChainStats = { total_sessions: 0, total_chains: 0, completed_sessions: 0 }
  let sessions: ExplorerSession[] = []
  let total = 0
  let page = 1
  const limit = 20

  let loading = true
  let error = ''
  let expandedId: string | null = null
  let expanded: SessionDetail | null = null
  let expandLoading = false

  let refreshTimer: ReturnType<typeof setInterval>
  const ZERO_HASH = '0'.repeat(64)

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(async () => {
    client = new ChainClient(chainApiUrl)
    myChainId = getChainId()
    displayId = formatChainId(myChainId)

    // Register silently
    void client.register(myChainId)

    await loadAll()
    refreshTimer = setInterval(loadAll, 30_000)
  })

  onDestroy(() => clearInterval(refreshTimer))

  // ── Data loaders ──────────────────────────────────────────────────────────
  async function loadAll() {
    error = ''
    try {
      const [s, e] = await Promise.all([client.getStats(), client.getExplorer(page, limit)])
      stats = s
      sessions = e.sessions
      total = e.total
    } catch {
      error = 'Could not reach the chain API.'
    } finally {
      loading = false
    }
  }

  async function goPage(p: number) {
    page = p
    loading = true
    await loadAll()
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      expandedId = null
      expanded = null
      return
    }
    expandedId = id
    expanded = null
    expandLoading = true
    expanded = await client.getSession(id)
    expandLoading = false
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  function shortId(id: string) {
    return id.slice(0, 8) + '…'
  }

  function isMine(chainId: string) {
    return chainId === myChainId
  }

  function routeIcon(route: string) {
    if (route === 'webrtc') return '⚡'
    if (route === 'local')  return '🏠'
    if (route === 'drive')  return '☁'
    return '→'
  }

  function statusColor(status: string) {
    switch (status) {
      case 'completed':   return 'var(--status-completed)'
      case 'transferring':return 'var(--status-transferring)'
      case 'connecting':  return 'var(--status-connecting)'
      case 'waiting_peer':return 'var(--status-waiting)'
      case 'failed':
      case 'abandoned':   return 'var(--status-failed)'
      default:            return 'var(--text-tertiary)'
    }
  }

  function fmtTs(ts: number) {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function fmtDuration(ms: number | null) {
    if (!ms) return '—'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  function totalPages() {
    return Math.max(1, Math.ceil(total / limit))
  }

  function isMissingHash(hash: string | null | undefined) {
    return !hash || hash === ZERO_HASH
  }

  function displayPreviousHash(hash: string) {
    return hash === ZERO_HASH ? 'Genesis record' : hash
  }

  function displayFileHash(hash: string | null) {
    return isMissingHash(hash) ? 'Hash unavailable' : `${hash.slice(0, 16)}…`
  }

  function hashClass(hash: string | null | undefined) {
    return isMissingHash(hash) ? 'cex-hash__val cex-hash__val--placeholder' : 'cex-hash__val'
  }
</script>

<div class="cex-root">

  <!-- ── Your Chain ID ─────────────────────────────────────────────────────── -->
  <div class="cex-identity">
    <div class="cex-identity__inner">
      <div class="cex-identity__label">Your Chain ID</div>
      <div class="cex-identity__id" title={myChainId}>{displayId}</div>
      <p class="cex-identity__note">
        Generated locally in your browser — no IP, no fingerprinting.
        Clearing storage creates a new one.
      </p>
    </div>
  </div>

  <!-- ── Stats ──────────────────────────────────────────────────────────────── -->
  <div class="cex-stats">
    <div class="cex-stat">
      <span class="cex-stat__value">{stats.total_sessions.toLocaleString()}</span>
      <span class="cex-stat__label">Sessions</span>
    </div>
    <div class="cex-stat">
      <span class="cex-stat__value">{stats.total_chains.toLocaleString()}</span>
      <span class="cex-stat__label">Chains</span>
    </div>
    <div class="cex-stat">
      <span class="cex-stat__value">{stats.completed_sessions.toLocaleString()}</span>
      <span class="cex-stat__label">Completed</span>
    </div>
  </div>

  <!-- ── Sessions ───────────────────────────────────────────────────────────── -->
  <div class="cex-table-wrap">
    {#if loading}
      <div class="cex-loading">
        <div class="cex-loading__ring"></div>
        <span>Loading ledger…</span>
      </div>
    {:else if error}
      <div class="cex-error">{error}</div>
    {:else if sessions.length === 0}
      <div class="cex-empty">
        <p>No transfers recorded yet.</p>
        <p class="cex-empty__sub">Make a transfer from the workspace to see it here.</p>
      </div>
    {:else}
      <table class="cex-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Sender</th>
            <th>Receiver</th>
            <th>Route</th>
            <th>Files</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {#each sessions as s}
            <!-- Main row -->
            <tr
              class="cex-row"
              class:cex-row--mine={isMine(s.sender_chain_id) || (s.receiver_chain_id && isMine(s.receiver_chain_id))}
              class:cex-row--expanded={expandedId === s.id}
              on:click={() => toggleExpand(s.id)}
            >
              <td class="cex-cell cex-cell--index">{s.ledger_index}</td>

              <td class="cex-cell cex-cell--chain">
                <span class="cex-chain-id" class:cex-chain-id--mine={isMine(s.sender_chain_id)}>
                  {isMine(s.sender_chain_id) ? 'You' : shortId(s.sender_chain_id)}
                </span>
              </td>

              <td class="cex-cell cex-cell--chain">
                {#if s.receiver_chain_id}
                  <span class="cex-chain-id" class:cex-chain-id--mine={isMine(s.receiver_chain_id)}>
                    {isMine(s.receiver_chain_id) ? 'You' : shortId(s.receiver_chain_id)}
                  </span>
                {:else}
                  <span class="cex-dash">—</span>
                {/if}
              </td>

              <td class="cex-cell">
                <span class="cex-route">{routeIcon(s.route)} {s.route}</span>
              </td>

              <td class="cex-cell">
                <div class="cex-files">
                  {#each s.files.slice(0, 3) as f}
                    <span class="cex-file-badge cex-file-badge--{f.category}">{f.category}</span>
                  {/each}
                  {#if s.files.length > 3}
                    <span class="cex-file-badge">+{s.files.length - 3}</span>
                  {/if}
                </div>
              </td>

              <td class="cex-cell">
                <span class="cex-status" style="color: {statusColor(s.status)}">
                  {s.status}
                </span>
              </td>

              <td class="cex-cell">{fmtDuration(s.duration_ms)}</td>

              <td class="cex-cell cex-cell--time">{fmtTs(s.started_at)}</td>
            </tr>

            <!-- Expanded detail row -->
            {#if expandedId === s.id}
              <tr class="cex-detail-row">
                <td colspan="8">
                  {#if expandLoading}
                    <div class="cex-detail-loading">Loading…</div>
                  {:else if expanded}
                    <div class="cex-detail">
                      <!-- Chain integrity -->
                      <div class="cex-detail__section">
                        <div class="cex-detail__label">Ledger Integrity</div>
                        <div class="cex-hash-pair">
                          <div class="cex-hash">
                            <span class="cex-hash__key">prev</span>
                            <code class={hashClass(expanded.previous_hash)}>{displayPreviousHash(expanded.previous_hash)}</code>
                          </div>
                          <div class="cex-hash">
                            <span class="cex-hash__key">hash</span>
                            <code class={hashClass(expanded.record_hash)}>{expanded.record_hash}</code>
                          </div>
                        </div>
                      </div>

                      <!-- Files -->
                      <div class="cex-detail__section">
                        <div class="cex-detail__label">Files ({expanded.files.length})</div>
                        <div class="cex-files-list">
                          {#each expanded.files as f}
                            <div class="cex-file-row">
                              <span class="cex-file-badge cex-file-badge--{f.category}">{f.category}</span>
                              <span class="cex-file-type">{f.type}</span>
                              <span class="cex-file-size">{formatBytes(f.size)}</span>
                              <code class:cex-file-hash--placeholder={isMissingHash(f.hash)} class="cex-file-hash">{displayFileHash(f.hash)}</code>
                            </div>
                          {/each}
                        </div>
                      </div>

                      <!-- Timeline -->
                      <div class="cex-detail__section">
                        <div class="cex-detail__label">Status Timeline</div>
                        <div class="cex-timeline">
                          {#each expanded.events as ev}
                            <div class="cex-timeline__item">
                              <span class="cex-timeline__dot" style="background: {statusColor(ev.status)}"></span>
                              <span class="cex-timeline__status">{ev.status}</span>
                              <span class="cex-timeline__ts">{fmtTs(ev.ts)}</span>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  {/if}
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>

      <!-- Pagination -->
      {#if totalPages() > 1}
        <div class="cex-pagination">
          <button
            class="cex-page-btn"
            disabled={page === 1}
            on:click={() => goPage(page - 1)}
          >← Prev</button>

          <span class="cex-page-info">Page {page} / {totalPages()}</span>

          <button
            class="cex-page-btn"
            disabled={page >= totalPages()}
            on:click={() => goPage(page + 1)}
          >Next →</button>
        </div>
      {/if}
    {/if}
  </div>

</div>

<style>
  /* ── Root ─────────────────────────────────────────────────────────────────── */
  .cex-root {
    display: flex;
    flex-direction: column;
    gap: var(--space-2xl);
  }

  /* ── Status palette (injected as CSS vars for easy overrides) ── */
  .cex-root {
    --status-completed:    #22c55e;
    --status-transferring: var(--accent);
    --status-connecting:   var(--accent-tertiary);
    --status-waiting:      var(--text-secondary);
    --status-failed:       var(--accent-secondary);
  }

  /* ── Chain ID panel ───────────────────────────────────────────────────────── */
  .cex-identity {
    background: var(--bg-card);
    border: var(--border-thick) solid var(--border-bold);
    box-shadow: var(--shadow-md) var(--shadow-color);
    padding: var(--space-2xl);
  }

  .cex-identity__inner {
    max-width: 640px;
  }

  .cex-identity__label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--accent-text);
    margin-bottom: var(--space-sm);
  }

  .cex-identity__id {
    font-family: var(--font-mono);
    font-size: clamp(1.1rem, 2.5vw, 1.5rem);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    letter-spacing: 0.05em;
    word-break: break-all;
    background: var(--accent-muted);
    border: var(--border-medium) solid var(--accent);
    padding: var(--space-md) var(--space-lg);
    margin-bottom: var(--space-md);
  }

  .cex-identity__note {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
    line-height: var(--leading-relaxed);
  }

  /* ── Stats row ────────────────────────────────────────────────────────────── */
  .cex-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: var(--border-thick) solid var(--border-bold);
    box-shadow: var(--shadow-md) var(--shadow-color);
  }

  .cex-stat {
    padding: var(--space-xl) var(--space-2xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    border-right: var(--border-thick) solid var(--border-bold);
    background: var(--bg-card);
  }

  .cex-stat:last-child { border-right: none; }

  .cex-stat__value {
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 3.5vw, 2.8rem);
    font-weight: var(--weight-bold);
    color: var(--accent-text);
    line-height: 1;
  }

  .cex-stat__label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
    color: var(--text-secondary);
  }

  /* ── Table wrapper ────────────────────────────────────────────────────────── */
  .cex-table-wrap {
    background: var(--bg-card);
    border: var(--border-thick) solid var(--border-bold);
    box-shadow: var(--shadow-md) var(--shadow-color);
    overflow: auto;
  }

  .cex-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .cex-table thead th {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
    color: var(--text-secondary);
    padding: var(--space-md) var(--space-lg);
    text-align: left;
    background: var(--bg-tertiary);
    border-bottom: var(--border-thick) solid var(--border-bold);
    white-space: nowrap;
  }

  /* ── Rows ─────────────────────────────────────────────────────────────────── */
  .cex-row {
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-out);
    border-bottom: var(--border-thin) solid var(--border-color);
  }

  .cex-row:hover { background: var(--bg-card-hover); }

  .cex-row--mine {
    background: var(--accent-muted);
  }

  .cex-row--mine:hover {
    background: rgba(200, 255, 0, 0.1);
  }

  .cex-row--expanded {
    border-bottom: none;
  }

  .cex-cell {
    padding: var(--space-md) var(--space-lg);
    color: var(--text-primary);
    vertical-align: middle;
    white-space: nowrap;
  }

  .cex-cell--index {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    width: 3rem;
  }

  .cex-cell--chain { max-width: 9rem; overflow: hidden; text-overflow: ellipsis; }
  .cex-cell--time  { color: var(--text-tertiary); font-size: var(--text-xs); }

  /* ── Chain IDs ────────────────────────────────────────────────────────────── */
  .cex-chain-id {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
  }

  .cex-chain-id--mine {
    background: var(--accent);
    color: #0a0a0a;
    border-color: #0a0a0a;
    font-weight: var(--weight-bold);
  }

  .cex-dash { color: var(--text-tertiary); }

  /* ── Route ────────────────────────────────────────────────────────────────── */
  .cex-route {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--text-secondary);
  }

  /* ── File badges ──────────────────────────────────────────────────────────── */
  .cex-files {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .cex-file-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .cex-file-badge--image    { border-color: #3b82f6; color: #3b82f6; }
  .cex-file-badge--pdf      { border-color: #ef4444; color: #ef4444; }
  .cex-file-badge--document { border-color: #8b5cf6; color: #8b5cf6; }
  .cex-file-badge--video    { border-color: #f59e0b; color: #f59e0b; }
  .cex-file-badge--audio    { border-color: #06b6d4; color: #06b6d4; }
  .cex-file-badge--archive  { border-color: #f97316; color: #f97316; }
  .cex-file-badge--other    { border-color: var(--border-color); }

  /* ── Status ───────────────────────────────────────────────────────────────── */
  .cex-status {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    font-weight: var(--weight-bold);
  }

  /* ── Detail rows ──────────────────────────────────────────────────────────── */
  .cex-detail-row {
    background: var(--bg-secondary);
    border-bottom: var(--border-thick) solid var(--border-bold);
  }

  .cex-detail-loading {
    padding: var(--space-lg) var(--space-xl);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .cex-detail {
    padding: var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .cex-detail__section { display: flex; flex-direction: column; gap: var(--space-sm); }

  .cex-detail__label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--accent-text);
  }

  /* Hashes */
  .cex-hash-pair { display: flex; flex-direction: column; gap: 6px; }

  .cex-hash {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-xs);
  }

  .cex-hash__key {
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
    color: var(--text-tertiary);
    min-width: 3rem;
  }

  .cex-hash__val {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-secondary);
    word-break: break-all;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cex-hash__val--placeholder {
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* Files list */
  .cex-files-list { display: flex; flex-direction: column; gap: 6px; }

  .cex-file-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-sm);
    flex-wrap: wrap;
  }

  .cex-file-type  { color: var(--text-secondary); font-size: var(--text-xs); font-family: var(--font-mono); }
  .cex-file-size  { color: var(--text-tertiary);  font-size: var(--text-xs); margin-left: auto; }
  .cex-file-hash  { font-size: 10px; color: var(--text-tertiary); font-family: var(--font-mono); }
  .cex-file-hash--placeholder { text-transform: uppercase; letter-spacing: 0.08em; }

  /* Timeline */
  .cex-timeline { display: flex; flex-direction: column; gap: 6px; }

  .cex-timeline__item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-sm);
  }

  .cex-timeline__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .cex-timeline__status {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--text-primary);
    min-width: 9rem;
  }

  .cex-timeline__ts { font-size: var(--text-xs); color: var(--text-tertiary); }

  /* ── Pagination ───────────────────────────────────────────────────────────── */
  .cex-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-lg);
    padding: var(--space-lg);
    border-top: var(--border-thick) solid var(--border-bold);
  }

  .cex-page-btn {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
    padding: 0.5rem 1.25rem;
    border: var(--border-medium) solid var(--border-bold);
    background: var(--bg-card);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm) var(--shadow-color);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .cex-page-btn:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-md) var(--shadow-color);
  }

  .cex-page-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }

  .cex-page-info {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
    color: var(--text-secondary);
  }

  /* ── States ───────────────────────────────────────────────────────────────── */
  .cex-loading {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-3xl);
    justify-content: center;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .cex-loading__ring {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .cex-error {
    padding: var(--space-2xl);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--accent-secondary);
    text-align: center;
  }

  .cex-empty {
    padding: var(--space-3xl);
    text-align: center;
    color: var(--text-secondary);
    font-size: var(--text-base);
  }

  .cex-empty__sub {
    margin-top: var(--space-sm);
    font-size: var(--text-sm);
    color: var(--text-tertiary);
    font-family: var(--font-mono);
  }

  /* ── Responsive ───────────────────────────────────────────────────────────── */
  @media (max-width: 767px) {
    .cex-stats {
      grid-template-columns: repeat(3, 1fr);
    }

    .cex-stat {
      padding: var(--space-md);
    }

    .cex-stat__value {
      font-size: 1.6rem;
    }

    .cex-table thead th:nth-child(n+7),
    .cex-cell:nth-child(n+7) {
      display: none;
    }

    .cex-identity__id {
      font-size: 0.9rem;
    }
  }
</style>
