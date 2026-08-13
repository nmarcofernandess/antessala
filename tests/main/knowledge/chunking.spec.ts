import { describe, it, expect } from 'vitest'
import { chunkText, chunkConversation } from '../../../src/main/knowledge/chunking'

describe('chunkText', () => {
  it('returns empty array for empty text', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   ')).toEqual([])
  })

  it('returns single chunk for short text', () => {
    const result = chunkText('Hello world', 1500, 200)
    expect(result).toEqual(['Hello world'])
  })

  it('splits long text into multiple chunks', () => {
    const text = 'A'.repeat(3000)
    const result = chunkText(text, 1500, 200)
    expect(result.length).toBeGreaterThan(1)
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(1500)
    }
  })
})

describe('chunkConversation', () => {
  it('returns empty array for empty messages', () => {
    const result = chunkConversation({ id: 'c1', title: 'Test', messages: [] })
    expect(result).toEqual([])
  })

  it('creates turn-based blocks', () => {
    const result = chunkConversation({
      id: 'c1',
      title: 'My Conv',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am great!' },
      ],
    })

    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('User: Hello\nAssistant: Hi there!')
    expect(result[1].text).toBe('User: How are you?\nAssistant: I am great!')
    expect(result[0].conversationId).toBe('c1')
    expect(result[0].conversationTitle).toBe('My Conv')
    expect(result[0].position).toBe(0)
    expect(result[1].position).toBe(1)
  })

  it('handles user-only messages', () => {
    const result = chunkConversation({
      id: 'c1',
      title: 'Test',
      messages: [
        { role: 'user', content: 'Hello' },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('User: Hello')
  })

  it('skips system messages', () => {
    const result = chunkConversation({
      id: 'c1',
      title: 'Test',
      messages: [
        { role: 'system', content: 'You are a bot' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('User: Hello\nAssistant: Hi!')
  })

  it('splits large blocks with overlap', () => {
    const longContent = 'A'.repeat(2000)
    const result = chunkConversation(
      {
        id: 'c1',
        title: 'Test',
        messages: [
          { role: 'user', content: longContent },
          { role: 'assistant', content: longContent },
        ],
      },
      1500,
      200,
    )

    expect(result.length).toBeGreaterThan(1)
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(1500)
      expect(chunk.conversationId).toBe('c1')
    }
  })

  it('handles multiple consecutive assistant messages', () => {
    const result = chunkConversation({
      id: 'c1',
      title: 'Test',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Part 1' },
        { role: 'assistant', content: 'Part 2' },
      ],
    })

    // Both assistant messages grouped with the user message
    expect(result).toHaveLength(1)
    expect(result[0].text).toContain('User: Hello')
    expect(result[0].text).toContain('Assistant: Part 1')
    expect(result[0].text).toContain('Assistant: Part 2')
  })
})
