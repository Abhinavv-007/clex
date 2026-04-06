<script lang="ts">
  import { onMount } from 'svelte'

  import WindowChrome from './WindowChrome.svelte'

  interface StatusSpec {
    label: string
    color: string
  }

  interface RouteSpec {
    id: 'p2p' | 'lan' | 'drive'
    label: string
    speed: string
    icon: string
    color: string
  }

  interface QueueFile {
    name: string
    type: 'IMG' | 'PDF' | 'DOC' | 'ZIP'
    size: string
    actionIdx: number
    statusIdx: number
  }

  const statusCycle: StatusSpec[] = [
    { label: 'Classifying', color: 'var(--cyan)' },
    { label: 'Compressing', color: 'var(--green)' },
    { label: 'Merging', color: 'var(--violet)' },
    { label: 'Negotiating', color: 'var(--amber)' },
    { label: 'Packaging', color: 'var(--green)' },
  ]

  const routeModes: RouteSpec[] = [
    { id: 'p2p', label: 'Direct P2P', speed: '12ms handoff', icon: '⟷', color: 'var(--green)' },
    { id: 'lan', label: 'Local Network', speed: 'LAN throughput', icon: '⊡', color: 'var(--cyan)' },
    { id: 'drive', label: 'Drive Fallback', speed: '1-click backup', icon: '↑', color: 'var(--accent)' },
  ]

  const commandChips = ['Compress', 'Convert', 'Merge PDF', 'DOCX→PDF', 'ZIP', 'Share']

  let fileQueue: QueueFile[] = [
    { name: 'hero-shot.jpg', type: 'IMG', size: '4.8 MB', actionIdx: 0, statusIdx: 1 },
    { name: 'launch-brief.pdf', type: 'PDF', size: '3 pages', actionIdx: 2, statusIdx: 2 },
    { name: 'pricing.docx', type: 'DOC', size: '1.2 MB', actionIdx: 3, statusIdx: 0 },
    { name: 'assets-raw.zip', type: 'ZIP', size: '12 files', actionIdx: 4, statusIdx: 4 },
  ]

  let activeFileIdx = 0
  let activeRouteIdx = 0
  let progress = 0
  let paused = false

  $: activeFile = fileQueue[activeFileIdx]
  $: activeRoute = routeModes[activeRouteIdx]
  $: activeStatus = statusCycle[activeFile.statusIdx]

  onMount(() => {
    let tick = 0

    const timer = setInterval(() => {
      if (paused) return

      tick += 1
      progress += Math.random() * 2 + 1

      if (progress >= 100) {
        progress = 0
        activeFileIdx = (activeFileIdx + 1) % fileQueue.length
      }

      if (tick % 60 === 0) {
        activeRouteIdx = (activeRouteIdx + 1) % routeModes.length
      }
    }, 40)

    return () => clearInterval(timer)
  })

  function selectFile(index: number) {
    activeFileIdx = index
    progress = 0
  }

  function selectRoute(index: number) {
    activeRouteIdx = index
  }

  function selectCommand(index: number) {
    fileQueue = fileQueue.map((file, fileIdx) =>
      fileIdx === activeFileIdx ? { ...file, actionIdx: index } : file
    )
  }
</script>

<div
  class="hwm-root"
  role="application"
  aria-label="Interactive workspace mockup"
  on:mouseenter={() => (paused = true)}
  on:mouseleave={() => (paused = false)}
>
  <WindowChrome
    title="Clex Workspace"
    statusLabel={activeStatus.label}
    statusColor={activeStatus.color}
    padded={false}
    bodyMinHeight="480px"
  >
    <div class="hwm-body">
      <div class="hwm-panel">
        <div class="hwm-panel-header">
          <span class="font-mono text-2xs uppercase tracking-widest text-text-3">Queue</span>
          <span class="hwm-badge-count">{fileQueue.length}</span>
        </div>

        <div class="hwm-file-list">
          {#each fileQueue as file, index}
            <button
              type="button"
              class="hwm-file-row"
              class:hwm-file-row--active={activeFileIdx === index}
              on:click={() => selectFile(index)}
            >
              <div class={`hwm-file-icon hwm-file-icon--${file.type.toLowerCase()}`}>{file.type}</div>
              <div class="hwm-file-info">
                <span class="hwm-file-name">{file.name}</span>
                <span class="hwm-file-size">{file.size}</span>
              </div>
              {#if activeFileIdx === index}
                <span class="hwm-file-status">{Math.floor(progress)}%</span>
              {/if}
            </button>
          {/each}
        </div>

        <div class="hwm-progress">
          <div class="hwm-progress-label">
            <span class="font-mono text-2xs text-text-3">Processing {activeFile.name}</span>
            <span class="font-mono text-2xs text-text-1">{Math.floor(progress)}%</span>
          </div>

          <div class="hwm-progress-bar">
            <div class="hwm-progress-fill" style={`width:${progress}%`} />
          </div>
        </div>
      </div>

      <div class="hwm-panel hwm-panel--main">
        <div class="hwm-panel-header">
          <span class="font-mono text-2xs uppercase tracking-widest text-text-3">Transfer</span>

          <div class="hwm-route-badge">
            <span class="hwm-route-badge-dot" style={`background:${activeRoute.color}`} />
            <span class="font-mono text-2xs">{activeRoute.label}</span>
          </div>
        </div>

        <div class="hwm-route-scene">
          <div
            class={`hwm-route-block hwm-route-block--${activeRoute.id}`}
            style={`--hwm-route-color:${activeRoute.color}`}
          >
            <div class="hwm-route-icon">{activeRoute.icon}</div>
            <div class="hwm-route-info">
              <span class="hwm-route-type font-mono">{activeRoute.label}</span>
              <span class="hwm-route-speed font-mono">{activeRoute.speed}</span>
            </div>
          </div>
        </div>

        <div class="hwm-route-pills">
          {#each routeModes as route, index}
            <button
              type="button"
              class="hwm-route-pill"
              class:hwm-route-pill--active={activeRouteIdx === index}
              on:click={() => selectRoute(index)}
            >
              <span class="hwm-route-pill-dot" style={`background:${route.color}`} />
              {route.label}
            </button>
          {/each}
        </div>

        <div class="hwm-command-strip">
          {#each commandChips as command, index}
            <button
              type="button"
              class="hwm-command-chip"
              class:hwm-command-chip--active={activeFile.actionIdx === index}
              on:click={() => selectCommand(index)}
            >
              {command}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </WindowChrome>
</div>

<style>
  .hwm-root {
    width: 100%;
  }

  .hwm-body {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    min-height: 480px;
  }

  .hwm-panel {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .hwm-panel + .hwm-panel {
    border-left: 2px solid var(--border);
  }

  .hwm-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }

  .hwm-badge-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: var(--accent);
    color: #000;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    border: 1px solid #000;
  }

  .hwm-file-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .hwm-file-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1.5px solid var(--border);
    background: var(--surface-2);
    transition: border-color 220ms ease, background 220ms ease, transform 180ms ease, box-shadow 180ms ease;
    cursor: pointer;
    text-align: left;
  }

  .hwm-file-row--active {
    border-color: var(--border-hard);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    transform: translateX(2px);
  }

  .hwm-file-icon {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    border: 1.5px solid #000;
    flex-shrink: 0;
  }

  .hwm-file-icon--img { background: #bff3ff; color: #04131d; }
  .hwm-file-icon--pdf { background: #ffe2b4; color: #3d2200; }
  .hwm-file-icon--doc { background: #ddd6fe; color: #2d1b69; }
  .hwm-file-icon--zip { background: #d1fae5; color: #064e3b; }

  .hwm-file-info {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hwm-file-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hwm-file-size {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
  }

  .hwm-file-status {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--green);
    flex-shrink: 0;
  }

  .hwm-progress {
    margin-top: auto;
  }

  .hwm-progress-label {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 6px;
  }

  .hwm-progress-bar {
    height: 14px;
    border: 2px solid var(--border-hard);
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .hwm-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--green));
    transition: width 120ms linear;
  }

  .hwm-route-scene {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 28px 0;
  }

  .hwm-route-block {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 18px 24px;
    border-radius: 12px;
    border: 2px solid var(--hwm-route-color);
    background: var(--surface-2);
    box-shadow: 4px 4px 0 var(--hwm-route-color);
    transition: transform 180ms ease, box-shadow 180ms ease;
  }

  .hwm-route-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: var(--surface);
    border: 2px solid currentColor;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: var(--text-1);
    flex-shrink: 0;
  }

  .hwm-route-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hwm-route-type {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.02em;
    text-transform: uppercase;
  }

  .hwm-route-speed {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .hwm-route-badge {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .hwm-route-badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    animation: pulse-dot 2s ease-in-out infinite;
  }

  .hwm-route-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .hwm-route-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 8px;
    border: 1.5px solid var(--border);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
    cursor: pointer;
    transition: all 160ms ease;
  }

  .hwm-route-pill:hover {
    border-color: var(--border-strong);
    color: var(--text-1);
  }

  .hwm-route-pill--active {
    border-color: var(--border-hard);
    background: var(--accent);
    color: #000;
    box-shadow: 2px 2px 0 #000;
  }

  .hwm-route-pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .hwm-command-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .hwm-command-chip {
    padding: 6px 11px;
    border-radius: 6px;
    border: 1.5px solid var(--border);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
    cursor: pointer;
    transition: all 200ms ease;
  }

  .hwm-command-chip--active {
    border-color: var(--border-hard);
    background: var(--text-1);
    color: var(--text-inv);
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  @media (max-width: 760px) {
    .hwm-body {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .hwm-panel + .hwm-panel {
      border-left: none;
      border-top: 2px solid var(--border);
    }
  }
</style>
