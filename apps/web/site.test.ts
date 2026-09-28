import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// @ts-expect-error — plain ESM module without type declarations
import { inkify } from './scripts/handwriting.mjs'

const webDir = resolve(__dirname)
const read = (p: string) => readFileSync(resolve(webDir, p), 'utf8')

/** Every page source (index.html files), not the build output. */
function pages(dir = webDir, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'public', 'partials'].includes(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) pages(full, out)
    else if (name === 'index.html') out.push(full)
  }
  return out
}

const text = (html: string) =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

describe('headings and subheadings', () => {
  // House style: headings and the lines under them carry no full stop at the
  // end and no dashes. It reads calmer, and it was asked for explicitly.
  const selectors = [
    /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g,
    /<p class="lede[^"]*"[^>]*>([\s\S]*?)<\/p>/g,
  ]

  for (const file of pages()) {
    const rel = file.slice(webDir.length + 1)
    if (rel.startsWith('admin/')) continue
    it(`${rel} has clean headings`, () => {
      const html = readFileSync(file, 'utf8')
      for (const re of selectors) {
        for (const m of html.matchAll(re)) {
          const t = text(m[1])
          if (!t) continue
          expect(t, `"${t}" in ${rel}`).not.toMatch(/[—–]/)
          expect(t, `"${t}" in ${rel}`).not.toMatch(/\s-\s/)
          expect(t, `"${t}" in ${rel}`).not.toMatch(/\.$/)
        }
      }
    })
  }
})

describe('partials', () => {
  it('every <!-- @name --> marker has a partial', () => {
    for (const file of pages()) {
      const html = readFileSync(file, 'utf8')
      for (const m of html.matchAll(/<!-- @([a-z0-9-]+) -->/g)) {
        expect(existsSync(resolve(webDir, 'partials', `${m[1]}.html`)), `${m[1]} used in ${file}`).toBe(true)
      }
    }
  })

  it('the nav no longer links the retired /workspace and /vault pages', () => {
    const nav = read('partials/nav.html')
    expect(nav).not.toMatch(/href="\/workspace"/)
    expect(nav).not.toMatch(/href="\/vault"/)
  })
})

describe('handwriting', () => {
  it('turns a script word into pen strokes with accessible text', () => {
    const out: string = inkify('<h2>One tab, <span class="script">three moves</span></h2>')
    expect(out).toContain('class="ink-word"')
    expect(out).toContain('<span class="visually-hidden">three moves</span>')
    expect(out).toMatch(/<svg class="ink" viewBox="[-\d ]+"/)
    // Strokes, in writing order, each normalised so it can be drawn on.
    const strokes = out.match(/<path d="M[^"]+" pathLength="1" data-l="\d+"\/>/g) || []
    expect(strokes.length).toBeGreaterThan(3)
    expect(out).toContain('class="ink__pen"')
    expect(out).toContain('data-write')
  })

  it('keeps the attributes a word was given, and scales on request', () => {
    const out: string = inkify('<span class="script" data-write="now" data-delay="400" data-scale="1.5">control</span>')
    expect(out).toContain('data-write="now"')
    expect(out).toContain('data-delay="400"')
    expect(out).not.toContain('data-scale')
  })

  it('drops the old swash attribute rather than drawing an underline', () => {
    const out: string = inkify('<span class="script" data-swash>control</span>')
    expect(out).not.toContain('data-swash')
    expect(out).not.toMatch(/ink__(swash|trail|nib)/)
  })

  it('gives every word on a page its own ids', () => {
    const out: string = inkify('<span class="script">a</span><span class="script">b</span>')
    const ids = [...out.matchAll(/id="(ink\d+)i"/g)].map((m) => m[1])
    expect(new Set(ids).size).toBe(2)
  })

  it('takes its ink from the theme, so it reads on bone and on charcoal', () => {
    const out: string = inkify('<span class="script">ink</span>')
    expect(out).toContain('class="ink__a"')
    expect(out).toContain('class="ink__c"')
    expect(out).not.toMatch(/stop-color="#/)
  })
})
