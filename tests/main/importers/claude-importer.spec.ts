import { describe, it, expect } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { importClaude } from '../../../src/main/importers/claude-importer'

const FIXTURES = path.resolve(__dirname, '../../fixtures')

describe('importClaude', () => {
  it('parses fixture into 1 conversation with 2 messages', () => {
    const filePath = path.join(FIXTURES, 'sample-claude.json')
    const result = importClaude(filePath)

    expect(result.conversations).toHaveLength(1)
    expect(result.conversations[0].messages).toHaveLength(2)
    expect(result.metadata.conversationCount).toBe(1)
    expect(result.metadata.format).toBe('claude')
    expect(result.metadata.fileName).toBe('sample-claude.json')
  })

  it('normalizes human sender to user role', () => {
    const filePath = path.join(FIXTURES, 'sample-claude.json')
    const result = importClaude(filePath)

    const [first, second] = result.conversations[0].messages
    expect(first.role).toBe('user')
    expect(second.role).toBe('assistant')
  })

  it('maps conversation fields correctly', () => {
    const filePath = path.join(FIXTURES, 'sample-claude.json')
    const result = importClaude(filePath)

    const conv = result.conversations[0]
    expect(conv.id).toBe('conv1')
    expect(conv.title).toBe('Test Claude Conversation')
    expect(conv.source).toBe('claude')
    expect(conv.createdAt).toBe(new Date('2024-01-01T00:00:00Z').getTime() / 1000)
  })

  it('maps message ids, content and timestamps correctly', () => {
    const filePath = path.join(FIXTURES, 'sample-claude.json')
    const result = importClaude(filePath)

    const [first, second] = result.conversations[0].messages
    expect(first.id).toBe('msg1')
    expect(first.content).toBe('What is TypeScript?')
    expect(first.timestamp).toBe(new Date('2024-01-01T00:00:01Z').getTime() / 1000)

    expect(second.id).toBe('msg2')
    expect(second.content).toBe('TypeScript is a typed superset of JavaScript.')
  })

  it('handles content array format', () => {
    const tmpFile = path.join(os.tmpdir(), 'test-claude-content-array.json')
    const data = [
      {
        uuid: 'conv-arr',
        name: 'Array Format Test',
        chat_messages: [
          {
            uuid: 'msg-arr-1',
            sender: 'human',
            content: [
              { type: 'text', text: 'Hello from content array' },
              { type: 'text', text: 'Second part' },
            ],
          },
          {
            uuid: 'msg-arr-2',
            sender: 'assistant',
            content: [{ type: 'text', text: 'Got it!' }],
          },
        ],
      },
    ]
    fs.writeFileSync(tmpFile, JSON.stringify(data))

    try {
      const result = importClaude(tmpFile)
      expect(result.conversations).toHaveLength(1)
      expect(result.conversations[0].messages).toHaveLength(2)
      expect(result.conversations[0].messages[0].content).toBe('Hello from content array\nSecond part')
      expect(result.conversations[0].messages[1].content).toBe('Got it!')
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('handles single conversation (non-array) export', () => {
    const tmpFile = path.join(os.tmpdir(), 'test-claude-single.json')
    const data = {
      uuid: 'single-conv',
      name: 'Single Conv',
      chat_messages: [
        { uuid: 'm1', sender: 'human', text: 'Hi' },
        { uuid: 'm2', sender: 'assistant', text: 'Hello!' },
      ],
    }
    fs.writeFileSync(tmpFile, JSON.stringify(data))

    try {
      const result = importClaude(tmpFile)
      expect(result.conversations).toHaveLength(1)
      expect(result.conversations[0].messages).toHaveLength(2)
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('skips conversations with no valid messages', () => {
    const tmpFile = path.join(os.tmpdir(), 'test-claude-empty-msgs.json')
    const data = [
      {
        uuid: 'conv-empty',
        name: 'Empty',
        chat_messages: [
          { uuid: 'm1', sender: 'system', text: 'System message — skipped' },
        ],
      },
    ]
    fs.writeFileSync(tmpFile, JSON.stringify(data))

    try {
      const result = importClaude(tmpFile)
      expect(result.conversations).toHaveLength(0)
      expect(result.metadata.conversationCount).toBe(0)
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('skips conversations with missing chat_messages', () => {
    const tmpFile = path.join(os.tmpdir(), 'test-claude-no-msgs.json')
    const data = [{ uuid: 'conv-no-msgs', name: 'No msgs' }]
    fs.writeFileSync(tmpFile, JSON.stringify(data))

    try {
      const result = importClaude(tmpFile)
      expect(result.conversations).toHaveLength(0)
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('uses fallback title when name is absent', () => {
    const tmpFile = path.join(os.tmpdir(), 'test-claude-no-title.json')
    const data = [
      {
        uuid: 'conv-notitle',
        chat_messages: [{ uuid: 'm1', sender: 'human', text: 'Hi' }],
      },
    ]
    fs.writeFileSync(tmpFile, JSON.stringify(data))

    try {
      const result = importClaude(tmpFile)
      expect(result.conversations[0].title).toBe('Sem titulo')
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })
})
