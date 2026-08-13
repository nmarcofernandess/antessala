import { describe, expect, it, vi } from 'vitest'

vi.mock('@/servicos/client', () => ({ client: {} }))
import {
  CLOUD_PROVIDER_DEFAULTS,
  normalizeCloudIaConfig,
} from '../../src/renderer/src/hooks/useIaModelConfig'

describe('configuração cloud do assistente', () => {
  it('aceita somente Gemini ou OpenRouter e usa readiness redigida', () => {
    expect(normalizeCloudIaConfig({
      provider: 'gemini',
      modelo: 'gemini-custom',
      api_key: '',
      configurado: true,
    })).toEqual({
      provider: 'gemini',
      modelo: 'gemini-custom',
      configurado: true,
    })
    expect(normalizeCloudIaConfig({ provider: 'local', configurado: true })).toBeNull()
  })

  it('mantém default de modelo sem expor token persistido', () => {
    expect(normalizeCloudIaConfig({
      provider: 'openrouter',
      configurado: true,
      api_key: '',
      provider_configs_json: JSON.stringify({ openrouter: {} }),
    })).toEqual({
      provider: 'openrouter',
      modelo: CLOUD_PROVIDER_DEFAULTS.openrouter,
      configurado: true,
    })
  })
})
