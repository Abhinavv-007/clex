export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)
  return `${mins}m ${secs}s`
}

export function formatETA(bytesRemaining: number, speedBps: number): string {
  if (speedBps <= 0) return '...'
  const secs = bytesRemaining / speedBps
  if (secs < 60) return `${Math.ceil(secs)}s`
  const mins = Math.floor(secs / 60)
  return `${mins}m ${Math.ceil(secs % 60)}s`
}

export function truncateName(name: string, maxLength = 32): string {
  if (name.length <= maxLength) return name
  const ext = name.lastIndexOf('.')
  if (ext > 0) {
    const base = name.slice(0, ext)
    const extension = name.slice(ext)
    const truncated = base.slice(0, maxLength - extension.length - 3)
    return `${truncated}...${extension}`
  }
  return `${name.slice(0, maxLength - 3)}...`
}
