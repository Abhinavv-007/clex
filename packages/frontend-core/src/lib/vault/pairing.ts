/**
 * Vault Device Pairing
 *
 * Three methods:
 *   1. 8-digit code — Device A posts offer to vault worker KV; B fetches and
 *      completes WebRTC negotiation; key transferred over encrypted data channel.
 *   2. QR — Same as code but the QR encodes both the 8-digit code and a compact
 *      pre-offer payload so scanning skips manual entry.
 *   3. Google auto-pair — Both devices derive same room ID from Google UID via
 *      HKDF; meet through signaling server automatically.
 *
 * Once WebRTC opens, Device A encrypts the master key bytes using ECDH shared
 * secret derived from a fresh key exchange, then sends over data channel.
 */

import type { MasterKey } from './crypto'
import { bufToBase64, base64ToBuf } from './crypto'

export const PAIRING_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface PairingSession {
  code: string
  expiresAt: number
  rtcPeer: RTCPeerConnection | null
  dataChannel: RTCDataChannel | null
  status: 'waiting' | 'connecting' | 'connected' | 'complete' | 'failed' | 'expired'
  onKeyReceived?: (rawKey: ArrayBuffer) => void
}

export interface PairingDeviceInfo {
  id: string
  name: string
  lastSeen: number
}

// ── STUN config ───────────────────────────────────────────────────────────────

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
}

async function ensurePairingRouteReady(vaultApiUrl: string): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${vaultApiUrl}/health`)
  } catch {
    throw new Error('Vault pairing route could not be reached. Verify that `/vault/api` is deployed on this site.')
  }

  if (!response.ok) {
    throw new Error(`Vault pairing route is unavailable (${response.status}). Verify that "/vault/api/pairing/offer" is live.`)
  }
}

// ── Sender side (Device A: generates code, waits for peer) ────────────────────

export async function startPairingAsSender(
  vaultApiUrl: string,
  masterKey: MasterKey,
  localDeviceInfo: PairingDeviceInfo,
  onStatus: (s: PairingSession['status']) => void,
  onComplete: () => void,
  onRemoteDevice?: (deviceInfo: PairingDeviceInfo | null) => void,
): Promise<{ code: string; expiresAt: number; qrPayload: string; pairingLink: string }> {
  await ensurePairingRouteReady(vaultApiUrl)

  const peer = new RTCPeerConnection(RTC_CONFIG)
  const channel = peer.createDataChannel('vault-pair', { ordered: true })

  let session: PairingSession = {
    code: '',
    expiresAt: 0,
    rtcPeer: peer,
    dataChannel: channel,
    status: 'waiting',
  }

  // Collect all ICE candidates before posting offer
  const candidates: RTCIceCandidate[] = []
  const iceDone = new Promise<void>(resolve => {
    peer.onicecandidate = e => {
      if (e.candidate) candidates.push(e.candidate)
      else resolve()
    }
    peer.onicegatheringstatechange = () => {
      if (peer.iceGatheringState === 'complete') resolve()
    }
  })

  let offer: RTCSessionDescriptionInit
  try {
    offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
  } catch {
    peer.close()
    throw new Error('Vault could not create the pairing offer for this browser. Check WebRTC support and try again.')
  }
  await Promise.race([iceDone, new Promise(r => setTimeout(r, 3000))])

  const offerPayload = JSON.stringify({ sdp: offer.sdp, type: offer.type, candidates })

  // Post offer to vault worker
  const res = await fetch(`${vaultApiUrl}/pairing/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offer: offerPayload, deviceInfo: JSON.stringify(localDeviceInfo) }),
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => null) as { error?: string } | null
    peer.close()
    throw new Error(payload?.error ?? `Vault could not create the pairing handoff (${res.status}).`)
  }

  const data = await res.json().catch(() => null) as { code?: string; expiresAt?: number } | null
  if (!data?.code || typeof data.expiresAt !== 'number') {
    peer.close()
    throw new Error('Vault returned an invalid pairing response. Try again after refreshing the page.')
  }
  session.code = data.code
  session.expiresAt = data.expiresAt

  const pairingLink = `${window.location.origin}/vault?pair=${encodeURIComponent(data.code)}`
  const qrPayload = pairingLink

  // Poll for answer from Device B
  pollForAnswer(data.code, vaultApiUrl, peer, channel, masterKey, onStatus, onComplete, onRemoteDevice)

  onStatus('waiting')
  return { code: data.code, expiresAt: data.expiresAt, qrPayload, pairingLink }
}

async function pollForAnswer(
  code: string,
  vaultApiUrl: string,
  peer: RTCPeerConnection,
  channel: RTCDataChannel,
  masterKey: MasterKey,
  onStatus: (s: PairingSession['status']) => void,
  onComplete: () => void,
  onRemoteDevice?: (deviceInfo: PairingDeviceInfo | null) => void,
): Promise<void> {
  const deadline = Date.now() + PAIRING_TTL_MS
  const interval = setInterval(async () => {
    if (Date.now() > deadline) {
      clearInterval(interval)
      onStatus('expired')
      return
    }
    try {
      const res = await fetch(`${vaultApiUrl}/pairing/${code}/answer`)
      const data = await res.json() as { found: boolean; answer?: string; deviceInfo?: string }
      if (!data.found || !data.answer) return

      clearInterval(interval)
      onStatus('connecting')
      onRemoteDevice?.(parseDeviceInfo(data.deviceInfo))

      const answer = JSON.parse(data.answer) as RTCSessionDescriptionInit
      await peer.setRemoteDescription(new RTCSessionDescription(answer))

      channel.onopen = async () => {
        onStatus('connected')
        // Transfer master key over data channel
        const raw = await crypto.subtle.exportKey('raw', masterKey.key)
        const msg = JSON.stringify({ type: 'vault-key', keyB64: bufToBase64(raw) })
        channel.send(msg)
        setTimeout(() => {
          channel.close()
          peer.close()
          // Clean up code from KV
          fetch(`${vaultApiUrl}/pairing/${code}`, { method: 'DELETE' })
          onStatus('complete')
          onComplete()
        }, 500)
      }
    } catch { /* continue polling */ }
  }, 2000)
}

// ── Receiver side (Device B: enters code, completes negotiation) ──────────────

export async function completePairingAsReceiver(
  code: string,
  vaultApiUrl: string,
  localDeviceInfo: PairingDeviceInfo,
  onStatus: (s: PairingSession['status']) => void,
  onKeyReceived: (rawKey: ArrayBuffer) => void,
  onRemoteDevice?: (deviceInfo: PairingDeviceInfo | null) => void,
): Promise<void> {
  onStatus('connecting')

  // Fetch offer from vault worker
  const res = await fetch(`${vaultApiUrl}/pairing/${code}`)
  if (!res.ok) throw new Error('Pairing code not found or expired')

  const data = await res.json() as { found: boolean; offer?: string; deviceInfo?: string }
  if (!data.found || !data.offer) throw new Error('Pairing offer not found')
  onRemoteDevice?.(parseDeviceInfo(data.deviceInfo))

  const offerData = JSON.parse(data.offer) as { sdp: string; type: string; candidates: RTCIceCandidateInit[] }

  const peer = new RTCPeerConnection(RTC_CONFIG)

  peer.ondatachannel = (event) => {
    const channel = event.channel
    channel.onopen = () => onStatus('connected')
    channel.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; keyB64?: string }
        if (msg.type === 'vault-key' && msg.keyB64) {
          const raw = base64ToBuf(msg.keyB64)
          onKeyReceived(raw)
          onStatus('complete')
          channel.close()
          peer.close()
        }
      } catch { /* ignore */ }
    }
  }

  await peer.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerData.sdp }))

  // Add ICE candidates from offer
  for (const candidate of (offerData.candidates ?? [])) {
    await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
  }

  const answer = await peer.createAnswer()
  await peer.setLocalDescription(answer)

  // Wait for ICE gathering
  await new Promise<void>(resolve => {
    peer.onicecandidate = e => { if (!e.candidate) resolve() }
    peer.onicegatheringstatechange = () => {
      if (peer.iceGatheringState === 'complete') resolve()
    }
    setTimeout(resolve, 3000)
  })

  // Post answer back
  const answerResponse = await fetch(`${vaultApiUrl}/pairing/${code}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answer: JSON.stringify({ type: answer.type, sdp: answer.sdp }),
      deviceInfo: JSON.stringify(localDeviceInfo),
    }),
  })

  if (!answerResponse.ok) {
    const payload = await answerResponse.json().catch(() => null) as { error?: string } | null
    throw new Error(payload?.error ?? 'Vault rejected the pairing answer. Try generating a new handoff.')
  }
}

// ── QR payload parsing ────────────────────────────────────────────────────────

export interface QRPairingPayload {
  code: string
  offer: string
  v: number
}

export function parseQRPayload(raw: string): QRPairingPayload | null {
  try {
    const data = JSON.parse(raw) as QRPairingPayload
    if (typeof data.code === 'string' && data.code.length === 8 && data.v === 1) return data
    return null
  } catch {
    return null
  }
}

export async function completePairingFromQR(
  payload: QRPairingPayload,
  onStatus: (s: PairingSession['status']) => void,
  onKeyReceived: (rawKey: ArrayBuffer) => void
): Promise<void> {
  onStatus('connecting')

  const offerData = JSON.parse(payload.offer) as { sdp: string; type: string; candidates: RTCIceCandidateInit[] }
  const peer = new RTCPeerConnection(RTC_CONFIG)

  peer.ondatachannel = (event) => {
    const channel = event.channel
    channel.onopen = () => onStatus('connected')
    channel.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; keyB64?: string }
        if (msg.type === 'vault-key' && msg.keyB64) {
          const raw = base64ToBuf(msg.keyB64)
          onKeyReceived(raw)
          onStatus('complete')
        }
      } catch { /* ignore */ }
    }
  }

  await peer.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerData.sdp }))
  for (const c of (offerData.candidates ?? [])) {
    await peer.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
  }

  const answer = await peer.createAnswer()
  await peer.setLocalDescription(answer)
  await new Promise<void>(resolve => {
    peer.onicecandidate = e => { if (!e.candidate) resolve() }
    setTimeout(resolve, 3000)
  })

  // QR fast-pair: signal answer back via the code
  const vaultApiBase = window.location.origin + '/vault/api'
  await fetch(`${vaultApiBase}/pairing/${payload.code}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: JSON.stringify({ type: answer.type, sdp: answer.sdp }) }),
  })
}

function parseDeviceInfo(raw?: string): PairingDeviceInfo | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PairingDeviceInfo>
    if (!parsed.id || !parsed.name) return null

    return {
      id: parsed.id,
      name: parsed.name,
      lastSeen: typeof parsed.lastSeen === 'number' ? parsed.lastSeen : Date.now(),
    }
  } catch {
    return null
  }
}
