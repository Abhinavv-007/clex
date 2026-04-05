<script lang="ts">
  import { filesStore, hasFiles } from '$stores/files'
  import { toolsStore, type ToolId } from '$stores/tools'
  import { uiStore } from '$stores/ui'
  import { TOOLS, getSuggestions } from '$tools/chain'
  import { toolAcceptsFile, getFileCategory } from '$utils/fileType'
  import ToolCard from '$components/tools/ToolCard.svelte'
  import ToolResult from '$components/tools/ToolResult.svelte'

  async function runTool(toolId: ToolId) {
    const files = $filesStore
    if (!files.length) return

    toolsStore.startTool(toolId)

    try {
      let outputBlob: Blob
      let outputName: string
      let outputType: string

      switch (toolId) {
        case 'image-compress': {
          const { compressImage } = await import('$tools/imageCompress')
          const file = files[0].file
          outputBlob = await compressImage(file, { maxSizeMB: 1 }, p => toolsStore.setProgress(p))
          outputType = 'image/jpeg'
          outputName = file.name.replace(/\.[^.]+$/, '_compressed.jpg')
          break
        }
        case 'image-convert': {
          const { convertImageFormat, formatToExtension, swapExtension } = await import('$tools/imageConvert')
          const file = files[0].file
          const targetFmt = 'image/webp' as const
          outputBlob = await convertImageFormat(file, targetFmt)
          toolsStore.setProgress(100)
          outputType = targetFmt
          outputName = swapExtension(file.name, formatToExtension(targetFmt))
          break
        }
        case 'pdf-merge': {
          const { mergePdfs } = await import('$tools/pdfMerge')
          const pdfFiles = files.filter(f => f.type === 'application/pdf').map(f => f.file)
          if (pdfFiles.length < 2) throw new Error('Select at least 2 PDF files to merge')
          outputBlob = await mergePdfs(pdfFiles, p => toolsStore.setProgress(p))
          outputType = 'application/pdf'
          outputName = 'merged.pdf'
          break
        }
        case 'pdf-split': {
          const { splitPdfByPage } = await import('$tools/pdfSplit')
          const file = files[0].file
          const pages = await splitPdfByPage(file, p => toolsStore.setProgress(p))
          const { zipFiles } = await import('$tools/zip')
          outputBlob = await zipFiles(pages, 'split_pages.zip')
          outputType = 'application/zip'
          outputName = `${file.name.replace(/\.pdf$/i, '')}_pages.zip`
          break
        }
        case 'pdf-to-image': {
          const { pdfToImages } = await import('$tools/pdfToImage')
          const file = files[0].file
          const images = await pdfToImages(file, 'image/jpeg', 2, p => toolsStore.setProgress(p))
          if (images.length === 1) {
            outputBlob = images[0].blob
            outputType = 'image/jpeg'
            outputName = images[0].name
          } else {
            const { zipFiles } = await import('$tools/zip')
            outputBlob = await zipFiles(images)
            outputType = 'application/zip'
            outputName = `${file.name.replace(/\.pdf$/i, '')}_images.zip`
          }
          break
        }
        case 'word-to-pdf': {
          const { wordToPdf } = await import('$tools/wordToPdf')
          const file = files[0].file
          outputBlob = await wordToPdf(file, p => toolsStore.setProgress(p))
          outputType = 'application/pdf'
          outputName = file.name.replace(/\.(doc|docx)$/i, '.pdf')
          break
        }
        case 'zip': {
          const { zipFiles } = await import('$tools/zip')
          const items = files.map(f => ({ blob: f.file, name: f.name }))
          outputBlob = await zipFiles(items, 'clex-files.zip', p => toolsStore.setProgress(p))
          outputType = 'application/zip'
          outputName = 'clex-files.zip'
          break
        }
        default:
          throw new Error(`Unknown tool: ${toolId}`)
      }

      toolsStore.setResult({
        toolId,
        inputFileIds: files.map(f => f.id),
        outputBlob,
        outputName,
        outputType,
        suggestions: getSuggestions(outputType, 1),
      })

    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      toolsStore.setError(message)
      uiStore.toast({ type: 'error', message })
    }
  }

  $: availableTools = TOOLS.filter(tool => {
    if (!$hasFiles) return false
    if (tool.accepts.includes('*')) return true
    return $filesStore.some(f => {
      const cat = getFileCategory(f.type, f.name)
      return toolAcceptsFile(tool.id as ToolId, cat, f.type)
    })
  })

  function handleToolSelect(e: CustomEvent<typeof TOOLS[0]>) {
    runTool(e.detail.id as ToolId)
  }

  function handleShareFromResult() {
    uiStore.setPanel('share')
  }

  function handleSelectToolFromChain(e: CustomEvent<string>) {
    runTool(e.detail as ToolId)
  }

  $: activeTool = TOOLS.find(t => t.id === $toolsStore.activeTool)
</script>

<div class="tc-root">
  <!-- Header -->
  <div class="tc-header">
    <h2 class="tc-title">Prepare</h2>
    <p class="tc-sub">Process files before sharing</p>
  </div>

  <!-- States -->
  {#if $toolsStore.result}
    <ToolResult
      result={$toolsStore.result}
      on:selectTool={handleSelectToolFromChain}
      on:share={handleShareFromResult}
    />

  {:else if $toolsStore.isProcessing}
    <div class="tc-processing">
      <div class="tc-proc-icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 2"/>
        </svg>
      </div>
      <p class="tc-proc-name">{activeTool?.name ?? 'Processing'}…</p>
      <div class="tc-prog-bar">
        <div class="tc-prog-fill" style="width: {$toolsStore.progress}%" />
      </div>
      <span class="tc-prog-pct">{$toolsStore.progress}%</span>
    </div>

  {:else if $toolsStore.error}
    <div class="tc-error">
      <div class="tc-err-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M7 4.5V7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <circle cx="7" cy="9.5" r=".6" fill="currentColor"/>
        </svg>
      </div>
      <div class="tc-err-body">
        <p class="tc-err-msg">{$toolsStore.error}</p>
        <button class="tc-err-dismiss" on:click={() => toolsStore.clear()}>Dismiss</button>
      </div>
    </div>

  {:else if !$hasFiles}
    <div class="tc-empty">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="9" stroke="currentColor" stroke-width="1.3" stroke-dasharray="3 2.5"/>
        <path d="M14 10v4M14 17.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
      <p>Add files to see available tools</p>
    </div>

  {:else if availableTools.length === 0}
    <div class="tc-empty">
      <p>No tools available for these file types</p>
    </div>

  {:else}
    <div class="tc-tool-list">
      {#each availableTools as tool (tool.id)}
        <ToolCard {tool} enabled={true} on:select={handleToolSelect} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .tc-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
  }

  .tc-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .tc-sub {
    font-size: 12px;
    color: var(--text-3);
    margin-top: 2px;
  }

  /* Processing */
  .tc-processing {
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }

  .tc-proc-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-1);
    animation: spinSlowly 4s linear infinite;
  }

  @keyframes spinSlowly {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .tc-proc-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .tc-prog-bar {
    width: 100%;
    height: 3px;
    background: var(--border);
    border-radius: 100px;
    overflow: hidden;
  }

  .tc-prog-fill {
    height: 100%;
    background: var(--text-1);
    border-radius: 100px;
    transition: width 0.3s ease;
  }

  .tc-prog-pct {
    font-size: 11px;
    color: var(--text-3);
    font-weight: 500;
  }

  /* Error */
  .tc-error {
    background: var(--raised);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .tc-err-icon {
    color: #ef4444;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .tc-err-body { display: flex; flex-direction: column; gap: 4px; }

  .tc-err-msg {
    font-size: 13px;
    font-weight: 500;
    color: #ef4444;
  }

  .tc-err-dismiss {
    font-size: 11px;
    color: var(--text-3);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    text-align: left;
    transition: color 0.15s;
  }

  .tc-err-dismiss:hover { color: var(--text-1); }

  /* Empty */
  .tc-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 48px 24px;
    color: var(--text-3);
    font-size: 12px;
    text-align: center;
  }

  .tc-empty svg { opacity: 0.25; }

  /* Tool list */
  .tc-tool-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    max-height: calc(100vh - 260px);
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }

  .tc-tool-list::-webkit-scrollbar { width: 4px; }
  .tc-tool-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }
</style>
