import { describe, expect, it } from 'vitest'
import { highlight } from './search'

describe('highlight', () => {
  it('escapes note text so it cannot inject markup', () => {
    const out = highlight('<img src=x onerror=alert(1)> hello', ['hello'])
    expect(out).toBe('&lt;img src=x onerror=alert(1)&gt; <mark>hello</mark>')
  })

  it('escapes text even when nothing matches', () => {
    expect(highlight('<b>x</b>', [])).toBe('&lt;b&gt;x&lt;/b&gt;')
  })

  it('keeps the original casing of a match', () => {
    expect(highlight('Hello there', ['hello'])).toBe('<mark>Hello</mark> there')
  })
})
