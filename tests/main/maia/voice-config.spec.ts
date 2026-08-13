import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(),
  execute: vi.fn(),
}))

vi.mock('../../../src/main/db/query', () => ({
  queryOne: mocks.queryOne,
  execute: mocks.execute,
}))

describe('Maiá voice config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryOne.mockResolvedValue(undefined)
    mocks.execute.mockResolvedValue(undefined)
  })

  it('returns the OpenAI default when no row exists', async () => {
    const { getMaiaVoiceConfig } = await import('../../../src/main/maia/voice-config')

    const config = await getMaiaVoiceConfig()

    expect(config).toMatchObject({
      provider: 'openai',
      voice: 'nova',
      model: 'gpt-4o-mini-tts',
      api_key: '',
    })
    expect(mocks.queryOne).toHaveBeenCalledWith(expect.stringContaining('FROM config'), 'maia_voice')
  })

  it('reads a stored config back (jsonb returns a parsed object)', async () => {
    mocks.queryOne.mockResolvedValue({
      key: 'maia_voice',
      value: { provider: 'openai', api_key: 'sk-stored', voice: 'coral', model: 'gpt-4o-mini-tts', speed: 1.2 },
    })
    const { getMaiaVoiceConfig } = await import('../../../src/main/maia/voice-config')

    const config = await getMaiaVoiceConfig()

    expect(config.voice).toBe('coral')
    expect(config.api_key).toBe('sk-stored')
  })

  it('reads a stored config back even when value arrives as a JSON string', async () => {
    mocks.queryOne.mockResolvedValue({
      key: 'maia_voice',
      value: JSON.stringify({ provider: 'openai', api_key: 'sk-text', voice: 'echo', model: 'gpt-4o-mini-tts', speed: 1.1 }),
    })
    const { getMaiaVoiceConfig } = await import('../../../src/main/maia/voice-config')

    const config = await getMaiaVoiceConfig()

    expect(config.voice).toBe('echo')
    expect(config.api_key).toBe('sk-text')
  })

  it('merges a patch over the current config and upserts into config table', async () => {
    const { saveMaiaVoiceConfig } = await import('../../../src/main/maia/voice-config')

    const saved = await saveMaiaVoiceConfig({ api_key: 'sk-new', voice: 'coral' })

    expect(saved).toMatchObject({ provider: 'openai', api_key: 'sk-new', voice: 'coral', model: 'gpt-4o-mini-tts' })
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO config'),
      'maia_voice',
      expect.stringContaining('"voice":"coral"'),
    )
  })

  it('rejects an unknown provider and keeps the OpenAI default', async () => {
    const { saveMaiaVoiceConfig } = await import('../../../src/main/maia/voice-config')

    const saved = await saveMaiaVoiceConfig({ provider: 'gemini' as never })

    expect(saved.provider).toBe('openai')
  })

  it('sanitizes dirty stored data (unknown voice/model, bad speed/api_key) back to defaults', async () => {
    mocks.queryOne.mockResolvedValue({
      key: 'maia_voice',
      value: { provider: 'openai', voice: 'voz-que-nao-existe', model: 'modelo-x', speed: 'rápido', api_key: 123 },
    })
    const { getMaiaVoiceConfig } = await import('../../../src/main/maia/voice-config')

    const config = await getMaiaVoiceConfig()

    expect(config.voice).toBe('nova')
    expect(config.model).toBe('gpt-4o-mini-tts')
    expect(config.speed).toBe(1.15)
    expect(config.api_key).toBe('')
  })

  it('keeps a valid voice that exists in the provider catalog', async () => {
    mocks.queryOne.mockResolvedValue({
      key: 'maia_voice',
      value: { provider: 'openai', voice: 'shimmer', model: 'gpt-4o-mini-tts', speed: 1.0, api_key: 'sk-x' },
    })
    const { getMaiaVoiceConfig } = await import('../../../src/main/maia/voice-config')

    const config = await getMaiaVoiceConfig()

    expect(config.voice).toBe('shimmer')
  })
})
