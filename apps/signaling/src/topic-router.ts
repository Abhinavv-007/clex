/**
 * Topic bookkeeping for y-webrtc signalling, split out from the Durable Object
 * so it can be tested without a WebSocket — the same split as
 * `room-session.ts` beside `room.ts`.
 *
 * A y-webrtc peer subscribes to topics (one per document room) and publishes
 * its WebRTC offer/answer traffic to them. The server never inspects a
 * payload; it only fans it out to the topic's *other* members. That is what
 * keeps this a router rather than a party to the session.
 */

/** Anything that can receive a frame. Narrow so tests can pass a plain object. */
export interface TopicMember {
  send(data: string): void
}

/** Bounds so a single connection cannot exhaust the room's memory. */
export const MAX_TOPIC_LENGTH = 256
export const MAX_TOPICS_PER_CONNECTION = 64

export function validTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const topic = entry.trim()
    if (!topic || topic.length > MAX_TOPIC_LENGTH) continue
    seen.add(topic)
  }
  return [...seen]
}

export class TopicRouter<M extends TopicMember = TopicMember> {
  private readonly topics = new Map<string, Set<M>>()
  private readonly joined = new Map<M, Set<string>>()

  add(member: M): void {
    if (!this.joined.has(member)) this.joined.set(member, new Set())
  }

  subscribe(member: M, rawTopics: unknown): void {
    const mine = this.joined.get(member)
    if (!mine) return
    for (const topic of validTopics(rawTopics)) {
      if (mine.size >= MAX_TOPICS_PER_CONNECTION && !mine.has(topic)) break
      mine.add(topic)
      let members = this.topics.get(topic)
      if (!members) {
        members = new Set()
        this.topics.set(topic, members)
      }
      members.add(member)
    }
  }

  unsubscribe(member: M, rawTopics: unknown): void {
    const mine = this.joined.get(member)
    if (!mine) return
    for (const topic of validTopics(rawTopics)) {
      mine.delete(topic)
      this.detach(topic, member)
    }
  }

  /**
   * Sends `raw` to every other member of `topic`.
   * Returns how many received it, which is what the tests assert on.
   */
  publish(from: M, topic: unknown, raw: string): number {
    if (typeof topic !== 'string' || !topic) return 0
    const members = this.topics.get(topic)
    if (!members) return 0
    let delivered = 0
    for (const member of [...members]) {
      if (member === from) continue // never echo a peer's own signal back
      try {
        member.send(raw)
        delivered++
      } catch {
        this.remove(member) // a dead socket is dropped, not retried
      }
    }
    return delivered
  }

  /** Forgets a member entirely — used on close and on a failed send. */
  remove(member: M): void {
    const mine = this.joined.get(member)
    if (mine) for (const topic of mine) this.detach(topic, member)
    this.joined.delete(member)
  }

  private detach(topic: string, member: M): void {
    const members = this.topics.get(topic)
    if (!members) return
    members.delete(member)
    if (members.size === 0) this.topics.delete(topic)
  }

  // ── Introspection, for tests and diagnostics ─────────────────────────────
  topicCount(): number {
    return this.topics.size
  }

  memberCount(topic: string): number {
    return this.topics.get(topic)?.size ?? 0
  }

  topicsFor(member: M): string[] {
    return [...(this.joined.get(member) ?? [])]
  }
}
