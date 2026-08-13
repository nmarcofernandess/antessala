import { describe, it, expect } from 'vitest'
import { createFlowKitMcpServer } from '../../src/mcp/server'

describe('createFlowKitMcpServer', () => {
  it('returns an McpServer instance without crashing', () => {
    const server = createFlowKitMcpServer()
    expect(server).toBeDefined()
    expect(server).not.toBeNull()
  })

  it('returned server is a valid McpServer (has expected shape)', () => {
    const server = createFlowKitMcpServer()
    // McpServer from @modelcontextprotocol/sdk exposes .tool() and .resource() methods
    expect(typeof server.tool).toBe('function')
    expect(typeof server.resource).toBe('function')
  })
})
