import { beforeEach, describe, expect, it, vi } from 'vitest'

// Prova REAL do fluxo de voz ponta-a-ponta: texto → speakViaProvider(OpenAI) →
// WAV real escrito no temp → entregue ao afplay. O afplay e o FS são mockados
// (não tocar áudio nem sujar disco no teste), mas o WAV passa pela OpenAI de
// verdade. Gated por opt-in + chave (igual à tts-openai-real).
const canRunOpenAi = process.env.FLOWKIT_REAL_AI_TESTS === '1' && !!process.env.OPENAI_API_KEY

const mocks = vi.hoisted(() => ({
  execFile: vi.fn((_cmd: string, _args: string[], callback: (err: Error | null) => void) => callback(null)),
  writeFile: vi.fn(),
  rm: vi.fn(),
}))

vi.mock('node:child_process', () => ({ execFile: mocks.execFile }))
vi.mock('node:fs/promises', () => ({ writeFile: mocks.writeFile, rm: mocks.rm }))

describe.skipIf(!canRunOpenAi)('Maiá voice flow — prova real', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.rm.mockResolvedValue(undefined)
  })

  it('fala via OpenAI: gera WAV real e o entrega ao afplay', async () => {
    const { speakViaProvider } = await import('../../../src/main/maia/tts/openai-tts')

    const result = await speakViaProvider({
      text: 'Teste real do fluxo de voz da Maiá.',
      config: {
        provider: 'openai',
        api_key: process.env.OPENAI_API_KEY as string,
        voice: 'nova',
        model: 'gpt-4o-mini-tts',
        speed: 1.15,
      },
    })

    expect(result).toEqual({ spoken: true, provider: 'openai' })

    const writtenBuffer = mocks.writeFile.mock.calls[0]?.[1] as Buffer
    expect(Buffer.isBuffer(writtenBuffer)).toBe(true)
    expect(writtenBuffer.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(writtenBuffer.length).toBeGreaterThan(2000)
    expect(mocks.execFile).toHaveBeenCalledWith('afplay', expect.any(Array), expect.any(Function))
  }, 60_000)
})
