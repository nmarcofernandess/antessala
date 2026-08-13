import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  generatePassageEmbedding,
  generatePassageEmbeddings,
  generateQueryEmbedding,
  hasKnowledgeEmbeddingAdapter,
  registerKnowledgeEmbeddingAdapter,
} from '../../../src/main/knowledge/embeddings'

let unregister: (() => void) | undefined

afterEach(() => {
  unregister?.()
  unregister = undefined
})

describe('knowledge embedding adapter', () => {
  it('fails closed without loading or downloading a model', async () => {
    expect(hasKnowledgeEmbeddingAdapter()).toBe(false)
    await expect(generateQueryEmbedding('triagem')).resolves.toBeNull()
    await expect(generatePassageEmbedding('documento')).resolves.toBeNull()
    await expect(generatePassageEmbeddings(['a', 'b'])).resolves.toBeNull()
  })

  it('uses only an explicitly registered adapter', async () => {
    const embed = vi.fn(async (text: string, kind: 'query' | 'passage') => [
      kind === 'query' ? 1 : 2,
      text.length,
    ])
    unregister = registerKnowledgeEmbeddingAdapter({ embed })

    await expect(generateQueryEmbedding('abc')).resolves.toEqual([1, 3])
    await expect(generatePassageEmbeddings(['a', 'bc'])).resolves.toEqual([
      [2, 1],
      [2, 2],
    ])
    expect(embed).toHaveBeenCalledTimes(3)

    unregister()
    unregister = undefined
    expect(hasKnowledgeEmbeddingAdapter()).toBe(false)
  })

  it('degrades to null when the registered adapter fails', async () => {
    unregister = registerKnowledgeEmbeddingAdapter({
      embed: vi.fn(async () => {
        throw new Error('adapter indisponível')
      }),
    })

    await expect(generatePassageEmbedding('abc')).resolves.toBeNull()
  })
})
