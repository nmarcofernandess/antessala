import { describe, expect, it } from 'vitest'
import { LOCAL_MODELS, asLocalModelId, getLocalStatus } from '../../src/main/ia/local-llm'
import { __llamaServerRuntimeTestables } from '../../src/main/ia/llama-server-runtime'

describe('asLocalModelId guard', () => {
  it('narrows a known model id and throws for an unknown one', () => {
    expect(asLocalModelId('gemma-4-e2b-it-q4')).toBe('gemma-4-e2b-it-q4')
    expect(() => asLocalModelId('modelo-fantasma')).toThrow(/desconhecido/i)
  })
})

describe('local Gemma runtime status', () => {
  it('uses Gemma 4 E2B as the only offline catalog entry', () => {
    expect(Object.keys(LOCAL_MODELS)).toEqual(['gemma-4-e2b-it-q4'])
    expect(LOCAL_MODELS['gemma-4-e2b-it-q4']).toMatchObject({
      label: 'Gemma 4 E2B IT',
      ram_minima_gb: 4,
      descricao: expect.stringContaining('chat, tools e enrichment'),
    })
  })

  it('reports validation-aware status for the local provider', () => {
    const status = getLocalStatus()
    const model = status.modelos['gemma-4-e2b-it-q4']

    expect(model).toBeDefined()
    expect(typeof model.baixado).toBe('boolean')
    expect(model.download_status).toBe('idle')
    if (model.baixado) {
      expect(model.usable || model.requires_validation || Boolean(model.load_error)).toBe(true)
    }
  })

  it('recognizes llama-server model-loading responses as retryable', () => {
    expect(__llamaServerRuntimeTestables.isModelLoadingResponse(
      503,
      '{"error":{"message":"Loading model","type":"unavailable_error","code":503}}',
    )).toBe(true)
    expect(__llamaServerRuntimeTestables.isModelLoadingResponse(500, 'Loading model')).toBe(false)
  })

  it('adds --mmproj to llama-server args only when a projector path is given', () => {
    const { buildLlamaServerArgs } = __llamaServerRuntimeTestables

    const withProjector = buildLlamaServerArgs({ modelPath: '/m/model.gguf', port: 1234, mmprojPath: '/m/mmproj-F16.gguf' })
    expect(withProjector).toContain('--mmproj')
    expect(withProjector).toContain('/m/mmproj-F16.gguf')

    const textOnly = buildLlamaServerArgs({ modelPath: '/m/model.gguf', port: 1234 })
    expect(textOnly).not.toContain('--mmproj')
    expect(textOnly).toEqual(expect.arrayContaining(['-m', '/m/model.gguf', '--jinja']))
  })

  it('runtimeMatches forces a restart when the mmproj projector changes (anti visão-fantasma)', () => {
    const { runtimeMatches } = __llamaServerRuntimeTestables
    const alive = (mmprojPath: string | null) => ({ modelId: 'gemma-4-e2b-it-q4', mmprojPath, process: { exitCode: null } } as any)

    // mesmo modelo + mesmo projetor + vivo → reusa
    expect(runtimeMatches(alive(null), 'gemma-4-e2b-it-q4', null)).toBe(true)
    expect(runtimeMatches(alive('/m/mmproj.gguf'), 'gemma-4-e2b-it-q4', '/m/mmproj.gguf')).toBe(true)
    // projetor mudou (texto-only ↔ visão) → NÃO reusa (evita probe contra runtime errado)
    expect(runtimeMatches(alive(null), 'gemma-4-e2b-it-q4', '/m/mmproj.gguf')).toBe(false)
    expect(runtimeMatches(alive('/m/mmproj.gguf'), 'gemma-4-e2b-it-q4', null)).toBe(false)
    // processo morto → não reusa
    expect(runtimeMatches({ modelId: 'gemma-4-e2b-it-q4', mmprojPath: null, process: { exitCode: 1 } } as any, 'gemma-4-e2b-it-q4', null)).toBe(false)
  })

  it('emits image_url parts in buildMessages only when vision is enabled', () => {
    const { buildMessages } = __llamaServerRuntimeTestables
    const img = { id: 'a1', tipo: 'image' as const, mime_type: 'image/png', nome: 'x.png', tamanho_bytes: 4, data_base64: 'AAAA' }

    const visionMsgs = buildMessages('sys', [], 'descreva', { anexos: [img], visionEnabled: true })
    const lastVision = visionMsgs[visionMsgs.length - 1]
    expect(Array.isArray(lastVision.content)).toBe(true)
    expect(lastVision.content).toContainEqual({ type: 'text', text: 'descreva' })
    expect(lastVision.content).toContainEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } })

    const textMsgs = buildMessages('sys', [], 'oi', { anexos: [img], visionEnabled: false })
    const lastText = textMsgs[textMsgs.length - 1]
    expect(typeof lastText.content).toBe('string')
    expect(lastText.content).toBe('oi')
  })
})
