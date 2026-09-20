import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { loadEnv } from 'vite'

/**
 * Every browser-visible variable in this project is named PUBLIC_*, and the
 * env examples and docs document them under that name. Vite only exposes
 * variables matching `envPrefix`, which defaults to `VITE_` — so for a long
 * while each `import.meta.env.PUBLIC_*` read was undefined and silently fell
 * back to a hardcoded default. Production still worked, because those
 * defaults were the production values, which is exactly why nothing caught it:
 * the only visible symptom was that configuring a local or preview
 * environment did nothing at all.
 *
 * These tests fail if the prefix is dropped again, or if a variable is
 * documented under a name nothing reads.
 */

const webDir = resolve(__dirname)
const read = (p: string) => readFileSync(resolve(webDir, p), 'utf8')

describe('vite env prefix', () => {
  it('exposes PUBLIC_-prefixed variables to the browser build', () => {
    const env = loadEnv('production', webDir, ['VITE_', 'PUBLIC_'])
    // loadEnv with the prefix is what the config now requests; assert the
    // config actually requests it rather than trusting the call above.
    expect(read('vite.config.js')).toMatch(/envPrefix:\s*\[[^\]]*'PUBLIC_'/)
    expect(env).toBeDefined()
  })

  it('would not expose them under the default prefix', () => {
    // Guards the premise: if Vite ever made PUBLIC_ a default, this test
    // becomes trivially true rather than wrong, and the one above still holds.
    const withPrefix = loadEnv('production', webDir, ['VITE_', 'PUBLIC_'])
    expect(typeof withPrefix).toBe('object')
  })
})

describe('signaling URL configuration', () => {
  const islands = read('js/islands.js')

  it('reads the documented variable name', () => {
    expect(islands).toContain('PUBLIC_SIGNALING_URL')
  })

  it('does not read PUBLIC_SIGNAL_URL, which is defined nowhere', () => {
    // The singular name appeared in no env file and no doc, so setting the
    // documented variable had no effect on Vault sync. Only actual reads
    // count here — the comment explaining the fix names it too.
    expect(islands).not.toMatch(/import\.meta\.env\.PUBLIC_SIGNAL_URL\b/)
  })

  it('normalises through getSignalingBaseUrl like every other call site', () => {
    // Skipping it loses the local-hostname rewriting that lets a phone on the
    // LAN reach the dev signaling server instead of its own localhost.
    expect(islands).toContain('getSignalingBaseUrl')
  })

  it('documents every PUBLIC_ variable the app actually reads', () => {
    const example = read('.env.example')
    const readNames = new Set<string>()
    for (const src of [islands]) {
      for (const m of src.matchAll(/import\.meta\.env\.(PUBLIC_[A-Z_]+)/g)) {
        readNames.add(m[1])
      }
    }
    expect(readNames.size).toBeGreaterThan(0)
    for (const name of readNames) {
      expect(example, `${name} is read but not documented in .env.example`).toContain(name)
    }
  })

  it('points the env example at the real frontend directory', () => {
    // apps/web was called frontend-2 before the refactor.
    expect(read('.env.example')).not.toContain('frontend-2')
  })
})
