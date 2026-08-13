import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IaAnexo } from '../../../src/shared/types'

// fs: modelo (Q4_K_M) sempre presente; mmproj de visão alternável por teste.
const fsState = vi.hoisted(() => ({ mmprojPresent: false }))
vi.mock('node:fs', () => {
  const existsSync = (p: unknown) => {
    const s = String(p)
    if (s.includes('mmproj-F16.gguf')) return fsState.mmprojPresent
    return s.includes('Q4_K_M.gguf')
  }
  const statSync = () => ({ size: 4_000_000_000 })
  const api = {
    existsSync,
    statSync,
    mkdirSync: () => undefined,
    renameSync: () => undefined,
    unlinkSync: () => undefined,
    createWriteStream: () => ({ write: () => undefined, end: () => undefined, on: () => undefined }),
  }
  return { default: api, ...api }
})

const runtimeMocks = vi.hoisted(() => ({
  localLlamaServerChat: vi.fn(async () => ({ resposta: 'resposta local', acoes: [] })),
  validateLocalLlamaServerVision: vi.fn(),
}))

vi.mock('../../../src/main/ia/llama-server-runtime', () => ({
  findLlamaServerBinary: () => '/fake/llama-server',
  localLlamaServerChat: runtimeMocks.localLlamaServerChat,
  validateLocalLlamaServerVision: runtimeMocks.validateLocalLlamaServerVision,
  getLocalLlamaServerStatus: () => ({ running: false }),
  localLlamaServerGenerateJson: vi.fn(),
  stopLocalLlamaServer: vi.fn(),
  validateLocalLlamaServerModel: vi.fn(),
}))

const imageAnexo: IaAnexo = {
  id: 'a1',
  tipo: 'image',
  mime_type: 'image/png',
  nome: 'shot.png',
  tamanho_bytes: 4,
  data_base64: 'AAAA',
}

describe('local-llm Gemma 4 multimodal path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fsState.mmprojPresent = false
    runtimeMocks.localLlamaServerChat.mockResolvedValue({ resposta: 'resposta local', acoes: [] })
  })

  it('exposes the mmproj vision projector in the catalog', async () => {
    const { LOCAL_MODELS } = await import('../../../src/main/ia/local-llm')
    const entry = LOCAL_MODELS['gemma-4-e2b-it-q4']
    expect(entry.mmproj).toMatchObject({ filename: 'mmproj-F16.gguf' })
    expect(entry.mmproj?.url).toContain('mmproj-F16.gguf')
    expect(entry.mmproj?.size_bytes).toBeGreaterThan(0)
  })

  it('threads image anexos to the llama-server chat (mmproj path null when not downloaded)', async () => {
    const { localLlmChat } = await import('../../../src/main/ia/local-llm')

    await localLlmChat('descreva a imagem', [], 'sid-vision', undefined, undefined, [imageAnexo], {
      modelId: 'gemma-4-e2b-it-q4',
    })

    expect(runtimeMocks.localLlamaServerChat).toHaveBeenCalledWith(
      expect.objectContaining({ anexos: [imageAnexo], mmprojPath: null }),
    )
  })

  it('passes the real mmprojPath to the chat when the projector IS downloaded', async () => {
    fsState.mmprojPresent = true
    const { localLlmChat } = await import('../../../src/main/ia/local-llm')

    await localLlmChat('descreva a imagem', [], 'sid-vision-on', undefined, undefined, [imageAnexo], {
      modelId: 'gemma-4-e2b-it-q4',
    })

    expect(runtimeMocks.localLlamaServerChat).toHaveBeenCalledWith(
      expect.objectContaining({ anexos: [imageAnexo], mmprojPath: expect.stringContaining('mmproj-F16.gguf') }),
    )
  })

  it('reports vision OFF with a reason when the mmproj projector is not downloaded', async () => {
    const { detectVisionSupport } = await import('../../../src/main/ia/local-llm')

    const support = await detectVisionSupport('gemma-4-e2b-it-q4')

    expect(support.ok).toBe(false)
    expect(support.reason).toMatch(/mmproj|projetor|vis[aã]o/i)
    expect(runtimeMocks.validateLocalLlamaServerVision).not.toHaveBeenCalled()
  })

  it('reports vision OFF (with the probe error) when mmproj IS present but the runtime cannot load it', async () => {
    fsState.mmprojPresent = true
    runtimeMocks.validateLocalLlamaServerVision.mockRejectedValue(new Error('unknown model architecture: gemma4-vision'))
    const { detectVisionSupport } = await import('../../../src/main/ia/local-llm')

    const support = await detectVisionSupport('gemma-4-e2b-it-q4')

    expect(support.ok).toBe(false)
    if (!support.ok) expect(support.reason).toMatch(/architecture|gemma4-vision/i)
    // Provou de verdade: o probe FOI chamado (não fingiu visão pela só presença do arquivo).
    expect(runtimeMocks.validateLocalLlamaServerVision).toHaveBeenCalledTimes(1)
  })

  it('reports vision ON when mmproj is present and the runtime probe succeeds', async () => {
    fsState.mmprojPresent = true
    runtimeMocks.validateLocalLlamaServerVision.mockResolvedValue(undefined)
    const { detectVisionSupport } = await import('../../../src/main/ia/local-llm')

    const support = await detectVisionSupport('gemma-4-e2b-it-q4')

    expect(support.ok).toBe(true)
    expect(runtimeMocks.validateLocalLlamaServerVision).toHaveBeenCalledTimes(1)
  })
})
