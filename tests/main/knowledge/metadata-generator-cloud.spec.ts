import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(),
  generateText: vi.fn(),
  createModel: vi.fn((model: string) => ({ model })),
  buildModelFactory: vi.fn(),
}))

vi.mock('../../../src/main/db/query', () => ({
  queryOne: mocks.queryOne,
}))

vi.mock('ai', () => ({
  generateText: mocks.generateText,
}))

vi.mock('../../../src/main/ia/config', () => ({
  buildModelFactory: mocks.buildModelFactory,
}))

describe('knowledge metadata cloud boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryOne.mockResolvedValue({
      id: 1,
      provider: 'gemini',
      api_key: 'token',
      modelo: 'gemini-3.5-flash',
      ativo: true,
      memoria_automatica: false,
      criado_em: '2026-01-01T00:00:00.000Z',
      atualizado_em: '2026-01-01T00:00:00.000Z',
    })
    mocks.buildModelFactory.mockReturnValue({
      createModel: mocks.createModel,
      modelo: 'gemini-3.5-flash',
    })
    mocks.generateText.mockResolvedValue({
      text: '{"titulo":"Protocolo","quando_consultar":"Ao preparar a triagem."}',
    })
  })

  it('reports unavailable without selecting or downloading a fallback', async () => {
    mocks.queryOne.mockResolvedValue(null)
    const { getKnowledgeCloudStatus } = await import(
      '../../../src/main/ia/metadata-generator'
    )

    await expect(getKnowledgeCloudStatus()).resolves.toMatchObject({
      available: false,
      provider: null,
    })
    expect(mocks.buildModelFactory).not.toHaveBeenCalled()
    expect(mocks.generateText).not.toHaveBeenCalled()
  })

  it('uses only the configured cloud provider on an explicit generation call', async () => {
    const { generateRagMetadata } = await import(
      '../../../src/main/ia/metadata-generator'
    )

    await expect(generateRagMetadata({
      texto: 'Conteúdo clínico local.',
      fileNameFallback: 'protocolo.md',
    })).resolves.toEqual({
      titulo: 'Protocolo',
      quando_consultar: 'Ao preparar a triagem.',
      route: {
        provider: 'gemini',
        model: 'gemini-3.5-flash',
      },
    })
    expect(mocks.createModel).toHaveBeenCalledWith('gemini-3.5-flash')
    expect(mocks.generateText).toHaveBeenCalledTimes(1)
  })
})
