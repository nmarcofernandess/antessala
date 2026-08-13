import { describe, expect, it } from 'vitest'

describe('FlowKit AI image content contract', () => {
  it('turns Maia screenshot attachments into AI SDK image parts', async () => {
    const { buildUserContentForTest } = await import('../../../src/main/ia/cliente')

    const content = buildUserContentForTest('O que eu devo responder?', [{
      id: 'shot-1',
      tipo: 'image',
      mime_type: 'image/png',
      nome: 'discord.png',
      tamanho_bytes: 4,
      data_base64: Buffer.from([1, 2, 3, 4]).toString('base64'),
    }])

    expect(Array.isArray(content)).toBe(true)
    expect(content).toEqual([
      { type: 'text', text: 'O que eu devo responder?' },
      {
        type: 'image',
        image: expect.any(Uint8Array),
        mediaType: 'image/png',
      },
    ])
  })
})
