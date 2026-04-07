<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { wordCount, readTimeMins } from '$stores/vault'
  import { fade } from 'svelte/transition'

  export let value = ''
  export let placeholder = 'Start writing…'
  export let mode: 'edit' | 'preview' = 'edit'
  export let autofocus = false

  const dispatch = createEventDispatcher<{ input: string; save: string }>()

  let textarea: HTMLTextAreaElement
  let lastSaved = 0
  let saveTimer: ReturnType<typeof setTimeout>
  let savedSelectionStart = 0
  let savedSelectionEnd = 0

  $: wc = wordCount(value)
  $: rt = readTimeMins(value)

  // ── Autosave ──────────────────────────────────────────────────────────────
  function scheduleAutosave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      lastSaved = Date.now()
      dispatch('save', value)
    }, 800)
  }

  function handleInput(e: Event) {
    value = (e.target as HTMLTextAreaElement).value
    syncSelectionFromTextarea()
    dispatch('input', value)
    scheduleAutosave()
  }

  function applyEditorChange(nextText: string, selectionStart: number, selectionEnd = selectionStart) {
    value = nextText
    savedSelectionStart = selectionStart
    savedSelectionEnd = selectionEnd
    dispatch('input', nextText)
    scheduleAutosave()
    setTimeout(() => {
      if (!textarea) return
      textarea.focus()
      textarea.selectionStart = selectionStart
      textarea.selectionEnd = selectionEnd
      syncSelectionFromTextarea()
    }, 0)
  }

  function syncSelectionFromTextarea() {
    if (!textarea) return
    savedSelectionStart = textarea.selectionStart
    savedSelectionEnd = textarea.selectionEnd
  }

  function getSelectionRange(): { start: number; end: number } {
    if (textarea) {
      syncSelectionFromTextarea()
    }

    return {
      start: savedSelectionStart,
      end: savedSelectionEnd,
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey

    // Cmd+B — bold
    if (mod && e.key === 'b') {
      e.preventDefault()
      wrapSelection('**', '**')
      return
    }

    // Cmd+I — italic
    if (mod && e.key === 'i') {
      e.preventDefault()
      wrapSelection('*', '*')
      return
    }

    // Cmd+K — link
    if (mod && e.key === 'k') {
      e.preventDefault()
      wrapSelection('[', '](url)')
      return
    }

    // Cmd+` — inline code
    if (mod && e.key === '`') {
      e.preventDefault()
      wrapSelection('`', '`')
      return
    }

    // Tab — indent (2 spaces)
    if (e.key === 'Tab') {
      e.preventDefault()
      insertAtCursor('  ')
      return
    }

    // Markdown inline shortcuts after space
    if (e.key === ' ') {
      const text = textarea.value
      const pos = textarea.selectionStart
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1
      const lineText = text.slice(lineStart, pos)

      // ## + space → H2, ### → H3, # → H1
      if (/^#{1,3}$/.test(lineText)) return // let it go through naturally

      // > + space → blockquote (already handled by the chars)
      // - or * + space → bullet list (already handled)
      // 1. + space → ordered list (handled)
      // ``` → code block
      if (lineText === '```') {
        e.preventDefault()
        const before = text.slice(0, lineStart)
        const after = text.slice(pos)
        const newText = `${before}\`\`\`\n\n\`\`\`${after}`
        applyEditorChange(newText, lineStart + 4)
        return
      }
    }

    // Enter — continue list items
    if (e.key === 'Enter') {
      const text = textarea.value
      const pos = textarea.selectionStart
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1
      const lineText = text.slice(lineStart, pos)

      // Bullet list
      const bulletMatch = lineText.match(/^(\s*)([-*+])\s(.*)$/)
      if (bulletMatch) {
        if (bulletMatch[3] === '') {
          // Empty item — end list
          e.preventDefault()
          const before = text.slice(0, lineStart)
          const after = text.slice(pos)
          applyEditorChange(`${before}${after}`, lineStart)
        } else {
          e.preventDefault()
          insertAtCursor(`\n${bulletMatch[1]}${bulletMatch[2]} `)
        }
        return
      }

      // Numbered list
      const numMatch = lineText.match(/^(\s*)(\d+)\.\s(.*)$/)
      if (numMatch) {
        if (numMatch[3] === '') {
          e.preventDefault()
          const before = text.slice(0, lineStart)
          const after = text.slice(pos)
          applyEditorChange(`${before}${after}`, lineStart)
        } else {
          e.preventDefault()
          insertAtCursor(`\n${numMatch[1]}${parseInt(numMatch[2]) + 1}. `)
        }
        return
      }

      // Task list
      const taskMatch = lineText.match(/^(\s*)-\s\[[ x]\]\s(.*)$/)
      if (taskMatch) {
        if (taskMatch[2] === '') {
          e.preventDefault()
          const before = text.slice(0, lineStart)
          const after = text.slice(pos)
          applyEditorChange(`${before}${after}`, lineStart)
        } else {
          e.preventDefault()
          insertAtCursor(`\n${taskMatch[1]}- [ ] `)
        }
        return
      }
    }
  }

  function wrapSelection(before: string, after: string) {
    const { start, end } = getSelectionRange()
    const text = textarea?.value ?? value
    const selected = text.slice(start, end)
    const newText = text.slice(0, start) + before + selected + after + text.slice(end)
    applyEditorChange(newText, start + before.length, end + before.length)
  }

  function insertAtCursor(text: string) {
    const { start: pos } = getSelectionRange()
    const current = textarea?.value ?? value
    const newText = current.slice(0, pos) + text + current.slice(pos)
    applyEditorChange(newText, pos + text.length)
  }

  function prefixSelectedLines(prefix: string) {
    const text = textarea?.value ?? value
    const { start, end } = getSelectionRange()
    const blockStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const blockEndRaw = text.indexOf('\n', end)
    const blockEnd = blockEndRaw === -1 ? text.length : blockEndRaw
    const block = text.slice(blockStart, blockEnd)
    const nextBlock = block
      .split('\n')
      .map((line) => `${prefix}${line}`)
      .join('\n')
    const nextText = text.slice(0, blockStart) + nextBlock + text.slice(blockEnd)
    applyEditorChange(nextText, blockStart, blockStart + nextBlock.length)
  }

  function wrapBlock(prefix: string, suffix: string) {
    const { start, end } = getSelectionRange()
    const text = textarea?.value ?? value
    const selected = text.slice(start, end)
    const body = selected || 'code'
    const leadingBreak = start > 0 && text[start - 1] !== '\n' ? '\n' : ''
    const trailingBreak = end < text.length && text[end] !== '\n' ? '\n' : ''
    const replacement = `${leadingBreak}${prefix}${body}${suffix}${trailingBreak}`
    const nextText = text.slice(0, start) + replacement + text.slice(end)
    const cursorStart = start + leadingBreak.length + prefix.length
    applyEditorChange(nextText, cursorStart, cursorStart + body.length)
  }

  function insertLinkTemplate() {
    const { start, end } = getSelectionRange()
    const text = textarea?.value ?? value
    const selected = text.slice(start, end) || 'link text'
    const replacement = `[${selected}](https://)`
    const nextText = text.slice(0, start) + replacement + text.slice(end)
    const urlStart = start + selected.length + 4
    applyEditorChange(nextText, urlStart, urlStart + 8)
  }

  function applyTool(tool: 'h1' | 'h2' | 'bold' | 'italic' | 'highlight' | 'quote' | 'checklist' | 'code' | 'link') {
    if (mode !== 'edit') return

    if (tool === 'h1') {
      prefixSelectedLines('# ')
      return
    }
    if (tool === 'h2') {
      prefixSelectedLines('## ')
      return
    }
    if (tool === 'bold') {
      wrapSelection('**', '**')
      return
    }
    if (tool === 'italic') {
      wrapSelection('*', '*')
      return
    }
    if (tool === 'highlight') {
      wrapSelection('==', '==')
      return
    }
    if (tool === 'quote') {
      prefixSelectedLines('> ')
      return
    }
    if (tool === 'checklist') {
      prefixSelectedLines('- [ ] ')
      return
    }
    if (tool === 'code') {
      wrapBlock('```\n', '\n```')
      return
    }

    insertLinkTemplate()
  }

  // ── Markdown renderer ─────────────────────────────────────────────────────
  function renderMarkdown(md: string): string {
    let html = escapeHtml(md)

    // Code blocks (must be before inline code)
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="ve-code-block"><code class="${lang ? `language-${lang}` : ''}">${code}</code></pre>`
    })

    // Headings
    html = html.replace(/^######\s+(.+)$/gm, '<h6 class="ve-h6">$1</h6>')
    html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="ve-h5">$1</h5>')
    html = html.replace(/^####\s+(.+)$/gm, '<h4 class="ve-h4">$1</h4>')
    html = html.replace(/^###\s+(.+)$/gm, '<h3 class="ve-h3">$1</h3>')
    html = html.replace(/^##\s+(.+)$/gm, '<h2 class="ve-h2">$1</h2>')
    html = html.replace(/^#\s+(.+)$/gm, '<h1 class="ve-h1">$1</h1>')

    // Blockquotes
    html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="ve-blockquote">$1</blockquote>')

    // Horizontal rule
    html = html.replace(/^---+$/gm, '<hr class="ve-hr" />')

    // Task lists (before unordered)
    html = html.replace(/^(\s*)-\s\[x\]\s+(.+)$/gm, (_, indent, text) =>
      `<div class="ve-task ve-task--done" style="margin-left:${indent.length * 12}px"><span class="ve-task-box ve-task-box--checked">✓</span><span>${text}</span></div>`)
    html = html.replace(/^(\s*)-\s\[ \]\s+(.+)$/gm, (_, indent, text) =>
      `<div class="ve-task" style="margin-left:${indent.length * 12}px"><span class="ve-task-box">○</span><span>${text}</span></div>`)

    // Unordered lists
    html = html.replace(/^(\s*)[-*+]\s+(.+)$/gm, (_, indent, text) =>
      `<li class="ve-li" style="margin-left:${indent.length * 12}px">• ${text}</li>`)
    html = html.replace(/(<li class="ve-li"[^>]*>.*<\/li>(\n|$))+/g, (m) => `<ul class="ve-ul">${m}</ul>`)

    // Ordered lists
    html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, (_, indent, text) =>
      `<li class="ve-li ve-li--ol" style="margin-left:${indent.length * 12}px">${text}</li>`)

    // Inline code
    html = html.replace(/`([^`\n]+)`/g, '<code class="ve-inline-code">$1</code>')

    // Bold + italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')
    html = html.replace(/==(.+?)==/g, '<mark class="ve-mark">$1</mark>')

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="ve-link" target="_blank" rel="noopener">$1</a>')

    // Paragraphs — wrap bare lines
    html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p class="ve-p">$1</p>')

    // Line breaks
    html = html.replace(/\n\n/g, '<br/>')

    return html
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  onMount(() => {
    if (autofocus && textarea) textarea.focus()
  })

  onDestroy(() => {
    clearTimeout(saveTimer)
  })

  $: saveDot = Date.now() - lastSaved < 2000
</script>

<div class="ve-root">
  {#if mode === 'edit'}
    <div class="ve-toolbar">
      <div class="ve-toolgroup">
        <button class="ve-tool" type="button" on:mousedown|preventDefault={() => applyTool('h1')}>H1</button>
        <button class="ve-tool" type="button" on:mousedown|preventDefault={() => applyTool('h2')}>H2</button>
        <button class="ve-tool" type="button" on:mousedown|preventDefault={() => applyTool('bold')}>Bold</button>
        <button class="ve-tool" type="button" on:mousedown|preventDefault={() => applyTool('italic')}>Italic</button>
        <button class="ve-tool" type="button" on:mousedown|preventDefault={() => applyTool('highlight')}>Highlight</button>
      </div>

      <div class="ve-toolgroup">
        <button class="ve-tool" type="button" on:mousedown|preventDefault={() => applyTool('quote')}>Quote</button>
        <button class="ve-tool" type="button" on:mousedown|preventDefault={() => applyTool('checklist')}>Checklist</button>
        <button class="ve-tool" type="button" on:mousedown|preventDefault={() => applyTool('code')}>Code</button>
        <button class="ve-tool" type="button" on:mousedown|preventDefault={() => applyTool('link')}>Link</button>
      </div>
    </div>
  {/if}

  {#if mode === 'edit'}
    <textarea
      bind:this={textarea}
      class="ve-textarea scroll-thin"
      {placeholder}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:click={syncSelectionFromTextarea}
      on:focus={syncSelectionFromTextarea}
      on:keyup={syncSelectionFromTextarea}
      on:mouseup={syncSelectionFromTextarea}
      on:select={syncSelectionFromTextarea}
      spellcheck="true"
      autocorrect="on"
      autocapitalize="sentences"
    >{value}</textarea>
  {:else}
    <div
      class="ve-preview scroll-thin"
      transition:fade={{ duration: 150 }}
    >
      {@html renderMarkdown(value)}
    </div>
  {/if}
</div>

<div class="ve-footer">
  <span class="ve-meta">{wc} words · {rt} min read</span>
  {#if lastSaved > 0}
    <span class="ve-save-dot" class:ve-save-dot--fresh={saveDot}>Saved</span>
  {/if}
</div>

<style>
  .ve-root {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
    gap: 12px;
  }

  .ve-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1.5px solid var(--border-hard);
    background: color-mix(in srgb, var(--surface-2) 82%, var(--surface));
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .ve-toolgroup {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ve-tool {
    min-height: 34px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    box-shadow: 2px 2px 0 var(--border-hard);
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    color: var(--text-1);
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  .ve-tool:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .ve-textarea {
    flex: 1 1 0;
    width: 100%;
    min-height: 0;
    resize: none;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-1);
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.7;
    padding: 0;
    caret-color: var(--accent);
  }

  .ve-textarea::placeholder {
    color: var(--text-3);
  }

  .ve-preview {
    flex: 1 1 0;
    overflow-y: auto;
    color: var(--text-1);
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.7;
  }

  /* Preview styles */
  :global(.ve-h1) { font-family: var(--font-display); font-size: 28px; font-weight: 700; letter-spacing: -0.03em; margin: 20px 0 10px; color: var(--text-1); }
  :global(.ve-h2) { font-family: var(--font-display); font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin: 18px 0 8px; color: var(--text-1); }
  :global(.ve-h3) { font-family: var(--font-display); font-size: 18px; font-weight: 600; margin: 16px 0 8px; color: var(--text-1); }
  :global(.ve-h4) { font-size: 16px; font-weight: 600; margin: 14px 0 6px; color: var(--text-1); }
  :global(.ve-p) { margin: 0 0 12px; color: var(--text-1); }
  :global(.ve-ul) { margin: 0 0 12px; padding: 0; list-style: none; }
  :global(.ve-li) { margin: 4px 0; color: var(--text-1); }
  :global(.ve-blockquote) {
    border-left: 3px solid var(--accent);
    padding: 8px 16px;
    margin: 12px 0;
    color: var(--text-2);
    font-style: italic;
  }
  :global(.ve-code-block) {
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
    margin: 12px 0;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-1);
  }
  :global(.ve-inline-code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px 6px;
    color: var(--cyan);
  }
  :global(.ve-mark) {
    background: color-mix(in srgb, var(--accent) 40%, transparent);
    color: var(--text-1);
    border-radius: 4px;
    padding: 0 3px;
  }
  :global(.ve-link) { color: var(--cyan); text-decoration: underline; text-underline-offset: 3px; }
  :global(.ve-hr) { border: none; height: 2px; background: var(--border); margin: 20px 0; }
  :global(.ve-task) { display: flex; align-items: flex-start; gap: 8px; margin: 6px 0; color: var(--text-2); }
  :global(.ve-task--done) { color: var(--text-3); text-decoration: line-through; }
  :global(.ve-task-box) {
    width: 16px; height: 16px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px;
    border: 1.5px solid var(--border-strong);
    border-radius: 4px;
    margin-top: 2px;
  }
  :global(.ve-task-box--checked) { background: var(--accent); color: #000; border-color: var(--accent); font-weight: 700; }

  .ve-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    margin-top: 8px;
    flex-shrink: 0;
  }

  .ve-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }

  .ve-save-dot {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.04em;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .ve-save-dot::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border-strong);
    transition: background 0.3s;
  }

  .ve-save-dot--fresh::before {
    background: var(--green);
  }

  @media (max-width: 767px) {
    .ve-toolbar {
      padding: 10px;
    }

    .ve-toolgroup {
      width: 100%;
    }

    .ve-tool {
      flex: 1 1 auto;
      justify-content: center;
    }
  }
</style>
