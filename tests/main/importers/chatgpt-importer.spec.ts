import { describe, it, expect } from 'vitest'
import path from 'path'
import { importChatGpt } from '../../../src/main/importers/chatgpt-importer'

const FIXTURE = path.resolve(__dirname, '../../fixtures/sample-chatgpt.json')

describe('chatgpt-importer', () => {
  it('parses fixture with 2 conversations', () => {
    const result = importChatGpt(FIXTURE)

    expect(result.conversations).toHaveLength(2)
    expect(result.metadata.format).toBe('chatgpt')
    expect(result.metadata.conversationCount).toBe(2)
    expect(result.metadata.fileName).toBe('sample-chatgpt.json')
  })

  it('extracts messages in correct order (user, assistant)', () => {
    const result = importChatGpt(FIXTURE)
    const conv1 = result.conversations[0]

    expect(conv1.messages).toHaveLength(2)
    expect(conv1.messages[0].role).toBe('user')
    expect(conv1.messages[0].content).toBe('Hello')
    expect(conv1.messages[1].role).toBe('assistant')
    expect(conv1.messages[1].content).toBe('Hi there!')
  })

  it('preserves conversation metadata', () => {
    const result = importChatGpt(FIXTURE)
    const conv1 = result.conversations[0]

    expect(conv1.id).toBe('conv1')
    expect(conv1.title).toBe('Test Conversation 1')
    expect(conv1.source).toBe('chatgpt')
    expect(conv1.createdAt).toBe(1700000000)
    expect(conv1.updatedAt).toBe(1700000100)
  })

  it('preserves message timestamps', () => {
    const result = importChatGpt(FIXTURE)
    const conv1 = result.conversations[0]

    expect(conv1.messages[0].timestamp).toBe(1700000001)
    expect(conv1.messages[1].timestamp).toBe(1700000002)
  })

  it('handles empty mapping gracefully', () => {
    // Write a temp file with empty mapping
    const fs = require('fs')
    const os = require('os')
    const tmp = path.join(os.tmpdir(), 'chatgpt-empty-mapping.json')
    fs.writeFileSync(tmp, JSON.stringify([{ id: 'empty', mapping: {} }]))

    const result = importChatGpt(tmp)
    expect(result.conversations).toHaveLength(0)
    expect(result.metadata.conversationCount).toBe(0)

    fs.unlinkSync(tmp)
  })

  it('handles missing content gracefully', () => {
    const fs = require('fs')
    const os = require('os')
    const tmp = path.join(os.tmpdir(), 'chatgpt-no-content.json')
    fs.writeFileSync(
      tmp,
      JSON.stringify([
        {
          id: 'no-content',
          title: 'No content conv',
          mapping: {
            root: { id: 'root', message: null, parent: null, children: ['m1'] },
            m1: {
              id: 'm1',
              message: { id: 'm1', author: { role: 'user' }, content: { parts: [] } },
              parent: 'root',
              children: [],
            },
          },
        },
      ]),
    )

    const result = importChatGpt(tmp)
    // Empty parts => no extractable text => conversation skipped
    expect(result.conversations).toHaveLength(0)

    fs.unlinkSync(tmp)
  })

  it('filters system messages with is_visually_hidden_from_conversation', () => {
    const fs = require('fs')
    const os = require('os')
    const tmp = path.join(os.tmpdir(), 'chatgpt-hidden-system.json')
    fs.writeFileSync(
      tmp,
      JSON.stringify([
        {
          id: 'hidden-sys',
          title: 'Hidden system',
          mapping: {
            root: { id: 'root', message: null, parent: null, children: ['sys', 'u1'] },
            sys: {
              id: 'sys',
              message: {
                id: 'sys',
                author: { role: 'system' },
                content: { parts: ['System prompt here'] },
                metadata: { is_visually_hidden_from_conversation: true },
              },
              parent: 'root',
              children: [],
            },
            u1: {
              id: 'u1',
              message: {
                id: 'u1',
                author: { role: 'user' },
                content: { parts: ['Hey'] },
                create_time: 1700002000,
              },
              parent: 'root',
              children: [],
            },
          },
        },
      ]),
    )

    const result = importChatGpt(tmp)
    expect(result.conversations).toHaveLength(1)
    // Only user message, system was hidden
    expect(result.conversations[0].messages).toHaveLength(1)
    expect(result.conversations[0].messages[0].role).toBe('user')

    fs.unlinkSync(tmp)
  })

  it('handles single conversation format (not array)', () => {
    const fs = require('fs')
    const os = require('os')
    const tmp = path.join(os.tmpdir(), 'chatgpt-single.json')
    fs.writeFileSync(
      tmp,
      JSON.stringify({
        id: 'single',
        title: 'Single conv',
        create_time: 1700003000,
        mapping: {
          root: { id: 'root', message: null, parent: null, children: ['m1'] },
          m1: {
            id: 'm1',
            message: {
              id: 'm1',
              author: { role: 'user' },
              content: { parts: ['Solo message'] },
              create_time: 1700003001,
            },
            parent: 'root',
            children: [],
          },
        },
      }),
    )

    const result = importChatGpt(tmp)
    expect(result.conversations).toHaveLength(1)
    expect(result.conversations[0].messages[0].content).toBe('Solo message')

    fs.unlinkSync(tmp)
  })

  it('follows ALL children in branching conversations (DFS)', () => {
    const fs = require('fs')
    const os = require('os')
    const tmp = path.join(os.tmpdir(), 'chatgpt-branching.json')
    fs.writeFileSync(
      tmp,
      JSON.stringify([
        {
          id: 'branching',
          title: 'Branching conv',
          mapping: {
            root: { id: 'root', message: null, parent: null, children: ['u1'] },
            u1: {
              id: 'u1',
              message: {
                id: 'u1',
                author: { role: 'user' },
                content: { parts: ['Question'] },
                create_time: 1700004001,
              },
              parent: 'root',
              children: ['a1', 'a2'],
            },
            a1: {
              id: 'a1',
              message: {
                id: 'a1',
                author: { role: 'assistant' },
                content: { parts: ['Answer branch 1'] },
                create_time: 1700004002,
              },
              parent: 'u1',
              children: [],
            },
            a2: {
              id: 'a2',
              message: {
                id: 'a2',
                author: { role: 'assistant' },
                content: { parts: ['Answer branch 2'] },
                create_time: 1700004003,
              },
              parent: 'u1',
              children: [],
            },
          },
        },
      ]),
    )

    const result = importChatGpt(tmp)
    expect(result.conversations).toHaveLength(1)
    // DFS should capture all 3 messages: user + both branches
    expect(result.conversations[0].messages).toHaveLength(3)
    const contents = result.conversations[0].messages.map((m) => m.content)
    expect(contents).toContain('Question')
    expect(contents).toContain('Answer branch 1')
    expect(contents).toContain('Answer branch 2')

    fs.unlinkSync(tmp)
  })

  it('extracts text from object parts (.text, .value, .content)', () => {
    const fs = require('fs')
    const os = require('os')
    const tmp = path.join(os.tmpdir(), 'chatgpt-obj-parts.json')
    fs.writeFileSync(
      tmp,
      JSON.stringify([
        {
          id: 'obj-parts',
          title: 'Object parts',
          mapping: {
            root: { id: 'root', message: null, parent: null, children: ['m1'] },
            m1: {
              id: 'm1',
              message: {
                id: 'm1',
                author: { role: 'assistant' },
                content: { parts: [{ text: 'From text field' }] },
                create_time: 1700005001,
              },
              parent: 'root',
              children: [],
            },
          },
        },
      ]),
    )

    const result = importChatGpt(tmp)
    expect(result.conversations).toHaveLength(1)
    expect(result.conversations[0].messages[0].content).toBe('From text field')

    fs.unlinkSync(tmp)
  })
})
