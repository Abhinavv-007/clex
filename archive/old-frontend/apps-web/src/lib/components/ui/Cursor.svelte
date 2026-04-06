<script lang="ts">
  import { onMount } from 'svelte'

  let x = -200
  let y = -200
  let expanded = false
  let show = false
  let isMobile = false

  onMount(() => {
    isMobile = window.matchMedia('(pointer: coarse)').matches
    if (isMobile) return
    show = true

    const onMove = (e: MouseEvent) => { x = e.clientX; y = e.clientY }
    const onEnter = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      expanded = !!(
        el.closest('button, a, [role=button], [tabindex], input, textarea, select, label')
      )
    }
    const onLeave = () => { expanded = false }

    document.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseover', onEnter, { passive: true })
    document.addEventListener('mouseout', onLeave, { passive: true })

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onEnter)
      document.removeEventListener('mouseout', onLeave)
    }
  })
</script>

{#if show && !isMobile}
  <!-- Outer ring -->
  <div
    style="
      position: fixed;
      left: {x}px; top: {y}px;
      width: {expanded ? 36 : 22}px;
      height: {expanded ? 36 : 22}px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 1.5px solid {expanded ? 'rgba(59,130,246,0.6)' : 'var(--text-3)'};
      pointer-events: none;
      z-index: 99999;
      transition: width 0.2s cubic-bezier(0.34,1.56,0.64,1), height 0.2s cubic-bezier(0.34,1.56,0.64,1), border-color 0.15s;
      mix-blend-mode: difference;
    "
  />
  <!-- Center dot -->
  <div
    style="
      position: fixed;
      left: {x}px; top: {y}px;
      width: 4px; height: 4px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: var(--text-2);
      pointer-events: none;
      z-index: 99999;
      mix-blend-mode: difference;
    "
  />
{/if}
