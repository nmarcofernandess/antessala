#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createFlowKitMcpServer } from './server.js'

async function main() {
  const server = createFlowKitMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[FlowKit MCP] Server running on stdio')
}

main().catch((err) => {
  console.error('[FlowKit MCP] Fatal:', err)
  process.exit(1)
})
