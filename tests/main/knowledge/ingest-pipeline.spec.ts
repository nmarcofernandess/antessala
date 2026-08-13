import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

// Mock the DB layer
vi.mock('../../../src/main/db/query', () => {
  let idCounter = 0
  return {
    insertReturningId: vi.fn(async () => ++idCounter),
    execute: vi.fn(async () => 0),
    queryAll: vi.fn(async () => []),
    queryOne: vi.fn(async () => undefined),
    transaction: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  }
})

// Mock embeddings (no ONNX model in test)
vi.mock('../../../src/main/knowledge/embeddings', () => ({
  generatePassageEmbeddings: vi.fn(async (texts: string[]) => texts.map(() => null)),
}))

describe('ingest-pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ingestKnowledge: chunks text and inserts into DB', async () => {
    const { ingestKnowledge } = await import('../../../src/main/knowledge/ingest')
    const { insertReturningId, execute } = await import('../../../src/main/db/query')

    const result = await ingestKnowledge('Test Doc', 'Hello world, this is a test document.', 'high')

    expect(result.source_id).toBeGreaterThan(0)
    expect(result.chunks_count).toBeGreaterThan(0)
    expect(insertReturningId).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalled()
  })

  it('ingestConversations: chunks conversations and persists', async () => {
    const { ingestConversations } = await import('../../../src/main/knowledge/ingest')
    const { insertReturningId, execute } = await import('../../../src/main/db/query')

    const conversations = [
      {
        id: 'conv1',
        title: 'Test Conversation',
        messages: [
          { id: 'm1', role: 'user' as const, content: 'Hello' },
          { id: 'm2', role: 'assistant' as const, content: 'Hi there!' },
        ],
        source: 'chatgpt' as const,
      },
    ]

    const result = await ingestConversations(conversations)

    expect(result.source_id).toBeGreaterThan(0)
    expect(result.chunks_count).toBeGreaterThan(0)
    // Should have created a knowledge_source + inserted chunks
    expect(insertReturningId).toHaveBeenCalled()
    expect(execute).toHaveBeenCalled()
  })

  it('ingestFromFile: routes .md to text pipeline', async () => {
    const { ingestFromFile } = await import('../../../src/main/knowledge/ingest')
    const fixturePath = path.resolve(__dirname, '../../fixtures/sample.md')

    const result = await ingestFromFile(fixturePath)

    expect(result.source_id).toBeGreaterThan(0)
    expect(result.chunks_count).toBeGreaterThan(0)
    // Text files should not have conversations_count
    expect(result.conversations_count).toBeUndefined()
  })

  it('ingestFromFile: routes .json (ChatGPT) to conversation pipeline', async () => {
    const { ingestFromFile } = await import('../../../src/main/knowledge/ingest')
    const fixturePath = path.resolve(__dirname, '../../fixtures/sample-chatgpt.json')

    const result = await ingestFromFile(fixturePath)

    expect(result.source_id).toBeGreaterThan(0)
    expect(result.chunks_count).toBeGreaterThan(0)
    expect(result.conversations_count).toBe(2) // sample fixture has 2 conversations
  })

  it('ingestConversations: returns 0 chunks for empty conversations', async () => {
    const { ingestConversations } = await import('../../../src/main/knowledge/ingest')

    const result = await ingestConversations([])

    expect(result.source_id).toBe(0)
    expect(result.chunks_count).toBe(0)
  })
})
