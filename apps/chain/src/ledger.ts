/**
 * ChainLedger — Durable Object
 *
 * Maintains a global append-only hash chain. Every new record gets:
 *   ledger_index  — monotonically increasing (1-based)
 *   previous_hash — hash of the prior record (genesis: 64 zeros)
 *   record_hash   — SHA-256(ledger_index + ":" + previous_hash + ":" + data)
 *
 * Because the DO is single-threaded, concurrent writes are automatically
 * serialised — no lock needed.
 */

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export class ChainLedger implements DurableObject {
  private readonly state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    let body: { data: string }
    try {
      body = await request.json<{ data: string }>()
    } catch {
      return new Response('Bad JSON', { status: 400 })
    }

    const count = (await this.state.storage.get<number>('count')) ?? 0
    const lastHash = (await this.state.storage.get<string>('last_hash')) ?? '0'.repeat(64)

    const nextIndex = count + 1
    const recordHash = await sha256hex(`${nextIndex}:${lastHash}:${body.data}`)

    await this.state.storage.put('count', nextIndex)
    await this.state.storage.put('last_hash', recordHash)

    return Response.json({
      ledger_index: nextIndex,
      previous_hash: lastHash,
      record_hash: recordHash,
    })
  }
}
