import { describe, expect, it } from 'vitest'
import { readItem } from './accountSync'

describe('account sync items', () => {
  const now = Date.now()

  it('accepts an encrypted note', () => {
    expect(readItem({ kind: 'note', id: 'a1b2-c3', updatedAt: now, deleted: false, payload: '{"ciphertextB64":"x","ivB64":"y"}' }))
      .toEqual({ kind: 'note', id: 'a1b2-c3', updatedAt: now, deleted: false, payload: '{"ciphertextB64":"x","ivB64":"y"}' })
  })

  it('accepts a deletion without a payload, and drops any payload sent with one', () => {
    expect(readItem({ kind: 'folder', id: 'f1', updatedAt: now, deleted: true, payload: 'ignored' }))
      .toEqual({ kind: 'folder', id: 'f1', updatedAt: now, deleted: true, payload: null })
  })

  it('rejects unknown kinds, bad ids and missing payloads', () => {
    expect(readItem({ kind: 'attachment', id: 'x', updatedAt: now, payload: 'p' })).toBe('kind must be note or folder')
    expect(readItem({ kind: 'note', id: '../../etc', updatedAt: now, payload: 'p' })).toBe('id is not valid')
    expect(readItem({ kind: 'note', id: 'x', updatedAt: now })).toBe('payload is required')
    expect(readItem(null)).toBe('item must be an object')
  })

  it('refuses a timestamp from the future, which would win every conflict', () => {
    expect(readItem({ kind: 'note', id: 'x', updatedAt: now + 3 * 24 * 3600 * 1000, payload: 'p' })).toBe('updatedAt is in the future')
  })

  it('caps the size of one item', () => {
    expect(readItem({ kind: 'note', id: 'x', updatedAt: now, payload: 'x'.repeat(256 * 1024 + 1) })).toBe('payload is too large')
  })
})
