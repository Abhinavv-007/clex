<script lang="ts">
  import { transferStore } from '$stores/transfer'
  import { formatBytes, formatSpeed, formatETA } from '$utils/format'

  $: progress = $transferStore.progress
  $: speed = $transferStore.speedBps
  $: bytesTotal = $transferStore.bytesTotal
  $: bytesSent = $transferStore.bytesSent

  $: eta = formatETA(bytesTotal - bytesSent, speed)
</script>

<div class="flex flex-col gap-3">
  <!-- Transfer beam visualization -->
  <div class="relative h-12 rounded-xl overflow-hidden"
       style="background: rgba(124,58,237,0.05); border: 1px solid rgba(124,58,237,0.15);">
    <!-- Fill -->
    <div
      class="absolute inset-y-0 left-0 rounded-xl transition-all duration-300"
      style="width: {progress}%; background: linear-gradient(90deg, rgba(124,58,237,0.3), rgba(34,211,238,0.3));"
    />
    <!-- Beam sweep -->
    <div
      class="absolute inset-y-0 w-[40%] animate-beam"
      style="background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);"
    />
    <!-- Labels -->
    <div class="absolute inset-0 flex items-center justify-between px-4">
      <span class="text-xs font-mono text-slate-300 z-10">{progress}%</span>
      <span class="text-xs font-mono text-slate-400 z-10">
        {formatBytes(bytesSent)} / {formatBytes(bytesTotal)}
      </span>
    </div>
  </div>

  <!-- Speed + ETA -->
  <div class="flex items-center justify-between text-[11px] text-slate-500">
    <span>{formatSpeed(speed)}</span>
    <span class="flex items-center gap-1">
      <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      ETA {eta}
    </span>
  </div>
</div>
