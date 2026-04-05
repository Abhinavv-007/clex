<script lang="ts">
  export let variant: 'default' | 'violet' | 'cyan' | 'amber' | 'green' | 'red' = 'default'
  export let size: 'sm' | 'md' = 'sm'

  const classes = {
    default: 'badge',
    violet: 'badge badge-violet',
    cyan: 'badge badge-cyan',
    amber: 'badge badge-amber',
    green: 'badge badge-green',
    red: 'badge badge-red',
  }
</script>

<span
  class="{classes[variant]} {size === 'md' ? 'text-xs px-3 py-1' : 'text-[11px] px-2 py-0.5'}"
>
  <slot />
</span>
