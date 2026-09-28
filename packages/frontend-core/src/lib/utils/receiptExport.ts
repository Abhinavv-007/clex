/**
 * A transfer receipt as something you can keep: plain text to paste, and a
 * PNG that looks like the paper receipt on screen, to save or share. Both
 * carry only what the receipt itself holds — never a file name or content.
 */
import type { TransferReceipt } from '../transfer/types'
import { formatBytes, formatDuration } from './format'

export interface ReceiptLine {
  label: string
  value: string
}

export function receiptNumber(receipt: TransferReceipt): string {
  const id = receipt.transferId.replace(/[^a-z0-9]/gi, '').toUpperCase()
  return `${id.slice(0, 4)}-${id.slice(4, 8) || '0000'}`
}

export function receiptDate(receipt: TransferReceipt): string {
  const d = new Date(receipt.completedAt || Date.now())
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

export function receiptLines(receipt: TransferReceipt): ReceiptLine[] {
  return [
    { label: 'Receipt', value: receiptNumber(receipt) },
    { label: 'Date', value: receiptDate(receipt) },
    { label: 'Route', value: receipt.route.charAt(0).toUpperCase() + receipt.route.slice(1) },
    { label: 'Files', value: String(receipt.fileCount) },
    { label: 'Size', value: formatBytes(receipt.totalSize) },
    { label: 'Chunks', value: `${receipt.totalChunks} × ${formatBytes(receipt.chunkSize)}` },
    { label: 'Duration', value: formatDuration(receipt.durationMs) },
    { label: 'Retries', value: String(receipt.retryCount) },
    { label: 'Failed', value: String(receipt.failedChunkCount) },
    { label: 'Health', value: `${receipt.healthScore}/100` },
  ]
}

const FOOTER = 'No file names or contents recorded'

export function receiptText(receipt: TransferReceipt): string {
  const lines = receiptLines(receipt)
  const pad = Math.max(...lines.map((l) => l.label.length)) + 3
  const out = [
    'CLEX · TRANSFER RECEIPT',
    '',
    ...lines.map((l) => `${l.label.padEnd(pad)}${l.value}`),
  ]
  if (receipt.rootHash) out.push(`${'Proof root'.padEnd(pad)}${receipt.rootHash}`)
  out.push('', receipt.verified ? `Verified. ${FOOTER}.` : `Not verified. ${FOOTER}.`, 'https://clex.in/chain')
  return out.join('\n')
}

/** Bar widths for a barcode derived from the receipt, stable per receipt. */
export function receiptBars(receipt: TransferReceipt, count = 42): number[] {
  const seed = receipt.rootHash || receipt.transferId
  const bars: number[] = []
  for (let i = 0; i < count; i += 1) {
    const c = seed.charCodeAt(i % seed.length) + i * 7
    bars.push(c % 5 === 0 ? 0 : (c % 3) + 1)
  }
  return bars
}

/** Draws the receipt on a canvas and returns it as a PNG. */
export async function receiptPng(receipt: TransferReceipt): Promise<Blob> {
  const scale = 2
  const W = 360
  const lines = receiptLines(receipt)
  const H = 190 + lines.length * 24 + (receipt.rootHash ? 44 : 0) + 64
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.scale(scale, scale)

  try {
    await document.fonts?.ready
  } catch {
    // fonts are a nicety here
  }
  const mono = `"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace`
  const sans = `"Geist", ui-sans-serif, system-ui, sans-serif`

  // Paper with torn edges top and bottom.
  const tooth = 8
  ctx.fillStyle = '#fbfaf5'
  ctx.beginPath()
  ctx.moveTo(0, tooth)
  for (let x = 0; x < W; x += tooth * 2) {
    ctx.lineTo(x + tooth, 0)
    ctx.lineTo(Math.min(W, x + tooth * 2), tooth)
  }
  ctx.lineTo(W, H - tooth)
  for (let x = W; x > 0; x -= tooth * 2) {
    ctx.lineTo(x - tooth, H)
    ctx.lineTo(Math.max(0, x - tooth * 2), H - tooth)
  }
  ctx.closePath()
  ctx.fill()

  const ink = '#2a2823'
  const mute = '#6b665c'
  const jade = '#2e6a4f'
  let y = 52
  ctx.textAlign = 'center'
  ctx.fillStyle = ink
  ctx.font = `700 22px ${sans}`
  ctx.fillText('C L E X', W / 2, y)
  y += 22
  ctx.fillStyle = mute
  ctx.font = `11px ${mono}`
  ctx.fillText('T R A N S F E R   R E C E I P T', W / 2, y)
  y += 22

  const rule = () => {
    ctx.strokeStyle = '#b9b3a8'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(24, y)
    ctx.lineTo(W - 24, y)
    ctx.stroke()
    ctx.setLineDash([])
  }
  rule()
  y += 28

  ctx.font = `13px ${mono}`
  for (const line of lines) {
    ctx.textAlign = 'left'
    ctx.fillStyle = mute
    ctx.fillText(line.label, 28, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = ink
    ctx.fillText(line.value, W - 28, y)
    y += 24
  }
  y -= 6
  rule()
  y += 26

  if (receipt.rootHash) {
    ctx.textAlign = 'left'
    ctx.fillStyle = mute
    ctx.fillText('Proof root', 28, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = jade
    const h = receipt.rootHash
    ctx.fillText(h.length > 22 ? `${h.slice(0, 12)}…${h.slice(-8)}` : h, W - 28, y)
    y += 30
  }

  // Barcode.
  const bars = receiptBars(receipt)
  const unit = (W - 60) / bars.reduce((a, b) => a + Math.max(1, b) + 1, 0)
  let x = 30
  ctx.fillStyle = ink
  for (const b of bars) {
    if (b) ctx.fillRect(x, y, b * unit, 34)
    x += (Math.max(1, b) + 1) * unit
  }
  y += 58

  // Stamp.
  ctx.save()
  ctx.translate(W / 2, y)
  ctx.rotate(-0.05)
  ctx.strokeStyle = receipt.verified ? jade : '#93650f'
  ctx.fillStyle = receipt.verified ? jade : '#93650f'
  ctx.lineWidth = 2
  const label = receipt.verified ? 'VERIFIED · NO CONTENT KEPT' : 'NOT VERIFIED'
  ctx.font = `700 11px ${mono}`
  const tw = ctx.measureText(label).width + 24
  ctx.strokeRect(-tw / 2, -15, tw, 26)
  ctx.textAlign = 'center'
  ctx.fillText(label, 0, 3)
  ctx.restore()
  y += 34

  ctx.textAlign = 'center'
  ctx.fillStyle = mute
  ctx.font = `10px ${mono}`
  ctx.fillText('clex.in/chain', W / 2, y)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not make the image'))), 'image/png')
  })
}

export function receiptFileName(receipt: TransferReceipt): string {
  return `clex-receipt-${receiptNumber(receipt).toLowerCase()}.png`
}
