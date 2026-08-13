import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiRouteResolution } from '../../../src/shared/ia-routing-contract'

const mocks = vi.hoisted(() => ({
  getMaiaPermissionStatus: vi.fn(),
  resolveIaRoute: vi.fn(),
  getMaiaVoiceConfig: vi.fn(),
  detectVisionSupport: vi.fn(),
  getMaiaHotkeyStatus: vi.fn(),
  asLocalModelId: vi.fn((v: string) => v),
}))

vi.mock('../../../src/main/maia/permissions', () => ({
  getMaiaPermissionStatus: mocks.getMaiaPermissionStatus,
}))
vi.mock('../../../src/main/ia/routing', () => ({
  resolveIaRoute: mocks.resolveIaRoute,
}))
vi.mock('../../../src/main/maia/voice-config', () => ({
  getMaiaVoiceConfig: mocks.getMaiaVoiceConfig,
}))
vi.mock('../../../src/main/ia/local-llm', () => ({
  detectVisionSupport: mocks.detectVisionSupport,
  asLocalModelId: mocks.asLocalModelId,
}))
vi.mock('../../../src/main/maia/hotkeys', () => ({
  getMaiaHotkeyStatus: mocks.getMaiaHotkeyStatus,
}))

function route(overrides: Partial<AiRouteResolution>): AiRouteResolution {
  return {
    ok: true,
    task: 'maia_command',
    label: 'Maiá',
    mode: 'inherit',
    provider: 'local',
    model: 'gemma-4-e2b-it-q4',
    reason: 'ready',
    message: 'ok',
    inherited: true,
    auto_selected: false,
    ...overrides,
  }
}

describe('getMaiaCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMaiaPermissionStatus.mockResolvedValue({ screen: 'granted', accessibility: 'denied' })
    mocks.getMaiaHotkeyStatus.mockReturnValue({
      literalReading: { accelerator: 'Shift+Delete', registered: true },
      commandBar: { accelerator: 'CommandOrControl+Shift+Space', registered: true },
    })
    mocks.getMaiaVoiceConfig.mockResolvedValue({ provider: 'openai', api_key: '', voice: 'nova', model: 'gpt-4o-mini-tts', speed: 1.15 })
    mocks.resolveIaRoute.mockResolvedValue(route({}))
    mocks.detectVisionSupport.mockResolvedValue({ ok: false, reason: 'Projetor de visão (mmproj) não baixado.' })
    mocks.asLocalModelId.mockImplementation((v: string) => v)
  })

  it('reports vision OFF (local without mmproj) so screenshot is unsupported even with screen permission', async () => {
    const { getMaiaCapabilities } = await import('../../../src/main/maia/capabilities')

    const snap = await getMaiaCapabilities()

    expect(snap.vision.ok).toBe(false)
    expect(snap.supportsScreenshot).toBe(false)
    // Trava o fix central: o snapshot NÃO pode subir o modelo (validateLocal:false).
    // Sem isso, voltar pra validateLocal:true (barra trava no boot) passaria verde.
    expect(mocks.resolveIaRoute).toHaveBeenCalledWith('maia_command', expect.objectContaining({ validateLocal: false }))
  })

  it('never crashes the snapshot when the route model is unknown — reports vision off with reason', async () => {
    mocks.asLocalModelId.mockImplementation(() => {
      throw new Error('Modelo local desconhecido: "xpto".')
    })
    mocks.resolveIaRoute.mockResolvedValue(route({ model: 'xpto' }))
    const { getMaiaCapabilities } = await import('../../../src/main/maia/capabilities')

    const snap = await getMaiaCapabilities()

    expect(snap.vision.ok).toBe(false)
    if (!snap.vision.ok) expect(snap.vision.reason).toContain('desconhecido')
    expect(snap.supportsScreenshot).toBe(false)
    expect(mocks.detectVisionSupport).not.toHaveBeenCalled()
  })

  it('treats a ready Gemini route as vision-capable (cloud-with-vision) and enables screenshot when screen granted', async () => {
    mocks.resolveIaRoute.mockResolvedValue(route({ provider: 'gemini', model: 'gemini-3.5-flash' }))
    const { getMaiaCapabilities } = await import('../../../src/main/maia/capabilities')

    const snap = await getMaiaCapabilities()

    expect(snap.vision).toEqual({ ok: true, source: 'route' })
    expect(snap.supportsScreenshot).toBe(true)
    expect(mocks.detectVisionSupport).not.toHaveBeenCalled()
  })

  it('enables vision via local mmproj when the probe passes', async () => {
    mocks.detectVisionSupport.mockResolvedValue({ ok: true })
    const { getMaiaCapabilities } = await import('../../../src/main/maia/capabilities')

    const snap = await getMaiaCapabilities()

    expect(snap.vision).toEqual({ ok: true, source: 'local' })
    expect(snap.supportsScreenshot).toBe(true)
  })

  it('blocks contextual actions and screenshot when the maia_command route is not ready', async () => {
    mocks.resolveIaRoute.mockResolvedValue(route({ ok: false, provider: null, model: null, reason: 'configure_provider', message: 'Configure um provedor de IA.' }))
    const { getMaiaCapabilities } = await import('../../../src/main/maia/capabilities')

    const snap = await getMaiaCapabilities()

    expect(snap.contextualActions.ok).toBe(false)
    expect(snap.contextualActions.reason).toContain('Configure')
    expect(snap.supportsScreenshot).toBe(false)
  })

  it('marks voice ready only when the OpenAI key is present', async () => {
    const { getMaiaCapabilities } = await import('../../../src/main/maia/capabilities')
    const noKey = await getMaiaCapabilities()
    expect(noKey.voice).toMatchObject({ provider: 'openai', ready: false })
    expect(noKey.voice.reason).toBeTruthy()

    mocks.getMaiaVoiceConfig.mockResolvedValue({ provider: 'openai', api_key: 'sk-live', voice: 'nova', model: 'gpt-4o-mini-tts', speed: 1.15 })
    const withKey = await getMaiaCapabilities()
    expect(withKey.voice).toEqual({ provider: 'openai', ready: true })
  })
})
