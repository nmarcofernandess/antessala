import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../../src/main/tipc.ts', import.meta.url), 'utf8')

describe('active main router surface', () => {
  it('binds the router object to the shared closed channel contract', () => {
    expect(source).toContain('satisfies Record<ActiveIpcChannel, unknown>')
  })

  it('does not publish dormant, legacy, filesystem or arbitrary-document handlers', () => {
    expect(source).not.toContain('dormantKnowledgeRouter')
    expect(source).not.toContain("'knowledge.")
    expect(source).not.toContain("'registros.")
    expect(source).not.toContain("'catalogos.")
    expect(source).not.toContain("'export.")
    expect(source).not.toContain("'ia.stt.")
  })
})
