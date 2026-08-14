import { describe, expect, it, vi } from 'vitest'

vi.mock('@/servicos/client', () => ({ client: {} }))
import {
  CLOUD_PROVIDER_DEFAULTS,
  normalizeCloudIaConfig,
} from '../../src/renderer/src/hooks/useIaModelConfig'

describe('configuração cloud do assistente', () => {
  it('aceita somente Gemini e usa readiness redigida', () => {
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

  it('rejeita configuração OpenRouter legada', () => {
    expect(normalizeCloudIaConfig({
      provider: 'openrouter',
      configurado: true,
      api_key: '',
      provider_configs_json: JSON.stringify({ openrouter: {} }),
    })).toBeNull()
  })
})
