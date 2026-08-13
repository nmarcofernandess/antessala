import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('FlowKit MCP health resource', () => {
  it('registers app://health resource', () => {
    const source = readFileSync(path.resolve(root, 'src/mcp/server.ts'), 'utf-8')
    expect(source).toContain("server.resource('app-health', 'app://health'")
    expect(source).toContain('resolveToolServerUrl')
    expect(source).toContain('fetchJson(`${TOOL_SERVER}/health`)')
  })

  it('registers terminal harness tools', () => {
    const source = readFileSync(path.resolve(root, 'src/mcp/server.ts'), 'utf-8')
    expect(source).toContain("server.tool(\n    'terminal_exec'")
    expect(source).toContain("postJson('/terminal/exec'")
    expect(source).toContain("server.tool(\n    'terminal_read_file'")
    expect(source).toContain("postJson('/terminal/read-file'")
  })
})
