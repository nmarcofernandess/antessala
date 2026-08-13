import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaiaVoiceConfig } from '../../../src/shared/maia-mvp-contract'

const mocks = vi.hoisted(() => ({
  execFile: vi.fn((_cmd: string, _args: string[], callback: (err: Error | null, stdout?: string, stderr?: string) => void) => {
    callback(null, '', '')
  }),
  writeFile: vi.fn(),
  rm: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('node:child_process', () => ({ execFile: mocks.execFile }))
vi.mock('node:fs/promises', () => ({ writeFile: mocks.writeFile, rm: mocks.rm }))

function wavResponse() {
  const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]) // RIFF....WAVE
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer,
    text: async () => '',
  }
}

const openAiConfig: MaiaVoiceConfig = {
  provider: 'openai',
  api_key: 'sk-test',
  voice: 'coral',
  model: 'gpt-4o-mini-tts',
  speed: 1.2,
}

describe('Maiá speakViaProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.rm.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', mocks.fetch)
  })

  it('synthesizes OpenAI wav and plays it via afplay when a key is configured', async () => {
    mocks.fetch.mockResolvedValue(wavResponse())
    const { speakViaProvider } = await import('../../../src/main/maia/tts/openai-tts')

    const result = await speakViaProvider({ text: 'Olá Marco', config: openAiConfig })

    expect(result).toEqual({ spoken: true, provider: 'openai' })
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/speech',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse((mocks.fetch.mock.calls[0][1] as { body: string }).body)
    expect(body).toMatchObject({ model: 'gpt-4o-mini-tts', voice: 'coral', input: 'Olá Marco', response_format: 'wav' })
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringContaining('maia-speech-'), expect.any(Buffer))
    expect(mocks.execFile).toHaveBeenCalledWith('afplay', [expect.stringContaining('.wav')], expect.any(Function))
    expect(mocks.rm).toHaveBeenCalledWith(expect.stringContaining('.wav'), { force: true })
  })

  it('falls back to macOS say when no OpenAI key is configured', async () => {
    const { speakViaProvider } = await import('../../../src/main/maia/tts/openai-tts')

    const result = await speakViaProvider({ text: 'Olá', config: { ...openAiConfig, api_key: '' } })

    expect(result).toEqual({ spoken: true, provider: 'say' })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.execFile).toHaveBeenCalledWith('say', expect.arrayContaining(['-f']), expect.any(Function))
  })

  it('throws an actionable error on 401 without playing audio', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid api key' })
    const { speakViaProvider } = await import('../../../src/main/maia/tts/openai-tts')

    await expect(speakViaProvider({ text: 'Olá', config: openAiConfig })).rejects.toThrow(/401|chave/i)
    expect(mocks.execFile).not.toHaveBeenCalledWith('afplay', expect.anything(), expect.any(Function))
  })

  it('plays an existing audio file through afplay', async () => {
    const { playAudioFile } = await import('../../../src/main/maia/tts/play-audio')

    await playAudioFile('/tmp/some.wav')

    expect(mocks.execFile).toHaveBeenCalledWith('afplay', ['/tmp/some.wav'], expect.any(Function))
  })
})

describe('synthesizeOpenAiSpeechWav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mocks.fetch)
  })

  it('applies safe defaults (nova / gpt-4o-mini-tts / wav / speed) when fields are omitted', async () => {
    mocks.fetch.mockResolvedValue(wavResponse())
    const { synthesizeOpenAiSpeechWav } = await import('../../../src/main/maia/tts/openai-tts')

    await synthesizeOpenAiSpeechWav({ text: 'oi', apiKey: 'sk-test' })

    const body = JSON.parse((mocks.fetch.mock.calls[0][1] as { body: string }).body)
    expect(body).toMatchObject({ model: 'gpt-4o-mini-tts', voice: 'nova', response_format: 'wav', input: 'oi' })
    expect(body.speed).toBe(1.15)
  })

  it('throws an actionable error on 403', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' })
    const { synthesizeOpenAiSpeechWav } = await import('../../../src/main/maia/tts/openai-tts')

    await expect(synthesizeOpenAiSpeechWav({ text: 'oi', apiKey: 'sk-test' })).rejects.toThrow(/403|chave/i)
  })

  it('rejects empty text and missing api key without calling the API', async () => {
    const { synthesizeOpenAiSpeechWav } = await import('../../../src/main/maia/tts/openai-tts')

    await expect(synthesizeOpenAiSpeechWav({ text: '   ', apiKey: 'sk-test' })).rejects.toThrow(/vazio/i)
    await expect(synthesizeOpenAiSpeechWav({ text: 'oi', apiKey: '  ' })).rejects.toThrow(/chave/i)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
