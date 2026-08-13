import { afterEach, describe, expect, it } from 'vitest'
import { isGeminiCloudApiEnabled } from '../../../src/main/config/app-config'
import { PROVIDER_DEFAULTS, resolveProviderApiKey, shouldAutoSeedIaConfig } from '../../../src/main/ia/config'
import type { IaConfiguracao } from '../../../src/shared/types'

const ORIGINAL_ANTESSALA_FLAG = process.env.ANTESSALA_GEMINI_ENABLE

function restoreEnv(name: 'ANTESSALA_GEMINI_ENABLE', value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

function makeGeminiConfig(overrides?: Partial<IaConfiguracao>): IaConfiguracao {
  return {
    id: 1,
    provider: 'gemini',
    api_key: '',
    modelo: PROVIDER_DEFAULTS.gemini,
    provider_configs_json: JSON.stringify({
      gemini: {
        token: 'test-gemini-token',
        modelo: PROVIDER_DEFAULTS.gemini,
      },
    }),
    ativo: true,
    memoria_automatica: true,
    criado_em: new Date(0).toISOString(),
    atualizado_em: new Date(0).toISOString(),
    ...overrides,
  }
}

describe('Gemini cloud config', () => {
  afterEach(() => {
    restoreEnv('ANTESSALA_GEMINI_ENABLE', ORIGINAL_ANTESSALA_FLAG)
  })

  it('uses Gemini 3.5 Flash as the direct Gemini default', () => {
    expect(PROVIDER_DEFAULTS.gemini).toBe('gemini-3.5-flash')
  })

  it('enables direct Gemini API by default and still allows explicit opt-out', () => {
    delete process.env.ANTESSALA_GEMINI_ENABLE
    expect(isGeminiCloudApiEnabled()).toBe(true)

    process.env.ANTESSALA_GEMINI_ENABLE = '0'
    expect(isGeminiCloudApiEnabled()).toBe(false)
  })

  it('does not inherit the removed FlowKit feature flag', () => {
    delete process.env.ANTESSALA_GEMINI_ENABLE
    process.env.FLOWKIT_GEMINI_ENABLE = '0'
    expect(isGeminiCloudApiEnabled()).toBe(true)

    process.env.ANTESSALA_GEMINI_ENABLE = '1'
    expect(isGeminiCloudApiEnabled()).toBe(true)
    delete process.env.FLOWKIT_GEMINI_ENABLE
  })

  it('resolves the Gemini provider token when the cloud API flag is unset', () => {
    delete process.env.ANTESSALA_GEMINI_ENABLE
    expect(resolveProviderApiKey(makeGeminiConfig())).toBe('test-gemini-token')
  })

  it('does not auto-seed over an existing configured provider', () => {
    expect(shouldAutoSeedIaConfig(makeGeminiConfig())).toBe(false)
    expect(shouldAutoSeedIaConfig({
      ...makeGeminiConfig({
        api_key: '',
        provider_configs_json: JSON.stringify({ gemini: { token: '' } }),
      }),
    })).toBe(true)
    expect(shouldAutoSeedIaConfig(null)).toBe(true)
  })

  it('documents both Gemini env names supported by Google AI Studio', async () => {
    const { APP_CONFIG } = await import('../../../src/main/config/app-config')

    expect(APP_CONFIG.envKeys.gemini).toBe('GOOGLE_API_KEY')
    expect(APP_CONFIG.envKeys.geminiAlternate).toBe('GEMINI_API_KEY')
  })
})
