import { describe, expect, it } from 'vitest'

import {
  MAX_TOPICS_PER_CONNECTION,
  TopicRouter,
  validTopics,
} from './topic-router'

/**
 * Vault's cross-device sync connects y-webrtc to this worker, which used to
 * serve only /room/:code — so the upgrade 404'd and sync never connected at
 * all. These cover the routing that makes it work, and the properties that
 * keep it a fan-out router rather than a participant.
 */

/** A member that records what it was sent. */
function member(name = 'peer') {
  const inbox: string[] = []
  return { name, inbox, send(data: string) { inbox.push(data) } }
}

describe('validTopics', () => {
  it('accepts plain topic names', () => {
    expect(validTopics(['vault:abc', 'vault:def'])).toEqual(['vault:abc', 'vault:def'])
  })

  it('ignores anything that is not an array of strings', () => {
    expect(validTopics(undefined)).toEqual([])
    expect(validTopics('vault:abc')).toEqual([])
    expect(validTopics([1, null, {}, true])).toEqual([])
  })

  it('drops blank and over-long names', () => {
    expect(validTopics(['', '   ', 'a'.repeat(300), 'ok'])).toEqual(['ok'])
  })

  it('de-duplicates, so a repeated subscribe cannot inflate the set', () => {
    expect(validTopics(['t', 't', ' t '])).toEqual(['t'])
  })
})

describe('TopicRouter', () => {
  it('delivers a publish to the other members of the topic', () => {
    const r = new TopicRouter()
    const a = member('a'), b = member('b')
    r.add(a); r.add(b)
    r.subscribe(a, ['room']); r.subscribe(b, ['room'])

    expect(r.publish(a, 'room', 'signal')).toBe(1)
    expect(b.inbox).toEqual(['signal'])
  })

  it('never echoes a publish back to its sender', () => {
    const r = new TopicRouter()
    const a = member('a'), b = member('b')
    r.add(a); r.add(b)
    r.subscribe(a, ['room']); r.subscribe(b, ['room'])

    r.publish(a, 'room', 'signal')
    expect(a.inbox).toEqual([])
  })

  it('keeps topics isolated from each other', () => {
    const r = new TopicRouter()
    const a = member('a'), b = member('b')
    r.add(a); r.add(b)
    r.subscribe(a, ['one']); r.subscribe(b, ['two'])

    expect(r.publish(a, 'one', 'x')).toBe(0)
    expect(b.inbox).toEqual([])
  })

  it('stops delivering after an unsubscribe', () => {
    const r = new TopicRouter()
    const a = member('a'), b = member('b')
    r.add(a); r.add(b)
    r.subscribe(a, ['room']); r.subscribe(b, ['room'])

    r.unsubscribe(b, ['room'])
    expect(r.publish(a, 'room', 'x')).toBe(0)
    expect(b.inbox).toEqual([])
  })

  it('forgets a member entirely on remove', () => {
    const r = new TopicRouter()
    const a = member('a'), b = member('b')
    r.add(a); r.add(b)
    r.subscribe(a, ['room']); r.subscribe(b, ['room'])

    r.remove(b)
    expect(r.publish(a, 'room', 'x')).toBe(0)
    expect(r.topicsFor(b)).toEqual([])
  })

  it('drops the topic once its last member leaves, so the map cannot grow forever', () => {
    const r = new TopicRouter()
    const a = member('a')
    r.add(a)
    r.subscribe(a, ['room'])
    expect(r.topicCount()).toBe(1)

    r.remove(a)
    expect(r.topicCount()).toBe(0)
  })

  it('drops a member whose send throws rather than retrying it', () => {
    const r = new TopicRouter()
    const a = member('a')
    const dead = { send() { throw new Error('socket closed') } }
    r.add(a); r.add(dead)
    r.subscribe(a, ['room']); r.subscribe(dead, ['room'])

    expect(r.publish(a, 'room', 'x')).toBe(0)
    expect(r.memberCount('room')).toBe(1) // only `a` remains
  })

  it('ignores a publish to a topic nobody joined', () => {
    const r = new TopicRouter()
    const a = member('a')
    r.add(a)
    expect(r.publish(a, 'nobody-here', 'x')).toBe(0)
  })

  it('ignores a publish with no usable topic', () => {
    const r = new TopicRouter()
    const a = member('a')
    r.add(a)
    r.subscribe(a, ['room'])
    expect(r.publish(a, undefined, 'x')).toBe(0)
    expect(r.publish(a, '', 'x')).toBe(0)
    expect(r.publish(a, 42, 'x')).toBe(0)
  })

  it('caps how many topics one connection may hold', () => {
    const r = new TopicRouter()
    const a = member('a')
    r.add(a)
    r.subscribe(a, Array.from({ length: MAX_TOPICS_PER_CONNECTION + 25 }, (_, i) => `t${i}`))
    expect(r.topicsFor(a).length).toBeLessThanOrEqual(MAX_TOPICS_PER_CONNECTION)
  })

  it('ignores a subscribe from a member it has never seen', () => {
    const r = new TopicRouter()
    const stranger = member('stranger')
    r.subscribe(stranger, ['room'])
    expect(r.topicCount()).toBe(0)
  })

  it('fans out to every other member, not just the first', () => {
    const r = new TopicRouter()
    const a = member('a'), b = member('b'), c = member('c')
    for (const m of [a, b, c]) { r.add(m); r.subscribe(m, ['room']) }

    expect(r.publish(a, 'room', 'signal')).toBe(2)
    expect(b.inbox).toEqual(['signal'])
    expect(c.inbox).toEqual(['signal'])
  })
})
