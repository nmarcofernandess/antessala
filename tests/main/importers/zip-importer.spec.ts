import { describe, it, expect } from 'vitest'
import AdmZip from 'adm-zip'
import { importZip } from '../../../src/main/importers/zip-importer'
import path from 'path'
import fs from 'fs'
import os from 'os'

function createTestZip(files: Array<{ name: string; content: string }>): string {
  const zip = new AdmZip()
  for (const f of files) {
    zip.addFile(f.name, Buffer.from(f.content, 'utf-8'))
  }
  const tmpPath = path.join(os.tmpdir(), `test-zip-${Date.now()}.zip`)
  zip.writeZip(tmpPath)
  return tmpPath
}

const sampleChatGptConv = JSON.stringify([
  {
    id: 'conv1',
    title: 'ChatGPT Conv',
    create_time: 1700000000,
    mapping: {
      root: { id: 'root', message: null, parent: null, children: ['m1'] },
      m1: {
        id: 'm1',
        message: { id: 'm1', author: { role: 'user' }, content: { parts: ['Hello from ChatGPT'] }, create_time: 1700000001 },
        parent: 'root',
        children: ['m2'],
      },
      m2: {
        id: 'm2',
        message: { id: 'm2', author: { role: 'assistant' }, content: { parts: ['Hi back!'] }, create_time: 1700000002 },
        parent: 'm1',
        children: [],
      },
    },
  },
])

const sampleClaudeConv = JSON.stringify([
  {
    uuid: 'claude1',
    name: 'Claude Conv',
    created_at: '2024-01-01T00:00:00Z',
    chat_messages: [
      { uuid: 'cm1', sender: 'human', text: 'Hello from Claude', created_at: '2024-01-01T00:00:01Z' },
      { uuid: 'cm2', sender: 'assistant', text: 'Hi from Claude!', created_at: '2024-01-01T00:00:02Z' },
    ],
  },
])

describe('zip-importer', () => {
  it('extracts ChatGPT conversations from ZIP', async () => {
    const zipPath = createTestZip([
      { name: 'conversations.json', content: sampleChatGptConv },
    ])

    try {
      const result = await importZip(zipPath)
      expect(result.type).toBe('conversations')
      if (result.type !== 'conversations') throw new Error('unexpected')

      expect(result.data.conversations).toHaveLength(1)
      expect(result.data.conversations[0].title).toBe('ChatGPT Conv')
      expect(result.data.conversations[0].messages).toHaveLength(2)
      expect(result.data.conversations[0].messages[0].content).toBe('Hello from ChatGPT')
    } finally {
      fs.unlinkSync(zipPath)
    }
  })

  it('extracts Claude conversations from ZIP', async () => {
    const zipPath = createTestZip([
      { name: 'export.json', content: sampleClaudeConv },
    ])

    try {
      const result = await importZip(zipPath)
      expect(result.type).toBe('conversations')
      if (result.type !== 'conversations') throw new Error('unexpected')

      expect(result.data.conversations).toHaveLength(1)
      expect(result.data.conversations[0].title).toBe('Claude Conv')
      expect(result.data.conversations[0].source).toBe('claude')
    } finally {
      fs.unlinkSync(zipPath)
    }
  })

  it('handles mixed ChatGPT + Claude files in same ZIP', async () => {
    const zipPath = createTestZip([
      { name: 'chatgpt.json', content: sampleChatGptConv },
      { name: 'claude.json', content: sampleClaudeConv },
    ])

    try {
      const result = await importZip(zipPath)
      expect(result.type).toBe('conversations')
      if (result.type !== 'conversations') throw new Error('unexpected')

      expect(result.data.conversations).toHaveLength(2)
      const sources = result.data.conversations.map(c => c.source)
      expect(sources).toContain('chatgpt')
      expect(sources).toContain('claude')
    } finally {
      fs.unlinkSync(zipPath)
    }
  })

  it('skips non-JSON files silently', async () => {
    const zipPath = createTestZip([
      { name: 'readme.txt', content: 'This is not JSON' },
      { name: 'image.png', content: 'fake png data' },
      { name: 'conversations.json', content: sampleChatGptConv },
    ])

    try {
      const result = await importZip(zipPath)
      expect(result.type).toBe('conversations')
      if (result.type !== 'conversations') throw new Error('unexpected')

      expect(result.data.conversations).toHaveLength(1)
    } finally {
      fs.unlinkSync(zipPath)
    }
  })

  it('returns empty conversations for ZIP with no recognizable JSON', async () => {
    const zipPath = createTestZip([
      { name: 'data.json', content: JSON.stringify({ foo: 'bar' }) },
    ])

    try {
      const result = await importZip(zipPath)
      expect(result.type).toBe('conversations')
      if (result.type !== 'conversations') throw new Error('unexpected')

      expect(result.data.conversations).toHaveLength(0)
    } finally {
      fs.unlinkSync(zipPath)
    }
  })

  it('handles empty ZIP gracefully', async () => {
    const zip = new AdmZip()
    const tmpPath = path.join(os.tmpdir(), `test-empty-zip-${Date.now()}.zip`)
    zip.writeZip(tmpPath)

    try {
      const result = await importZip(tmpPath)
      expect(result.type).toBe('conversations')
      if (result.type !== 'conversations') throw new Error('unexpected')

      expect(result.data.conversations).toHaveLength(0)
    } finally {
      fs.unlinkSync(tmpPath)
    }
  })

  it('reports metadata correctly', async () => {
    const zipPath = createTestZip([
      { name: 'conversations.json', content: sampleChatGptConv },
    ])

    try {
      const result = await importZip(zipPath)
      expect(result.type).toBe('conversations')
      if (result.type !== 'conversations') throw new Error('unexpected')

      expect(result.data.metadata.conversationCount).toBe(1)
      expect(result.data.metadata.fileName).toMatch(/test-zip-.*\.zip/)
    } finally {
      fs.unlinkSync(zipPath)
    }
  })
})
