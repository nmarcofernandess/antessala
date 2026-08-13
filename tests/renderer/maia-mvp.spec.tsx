/** @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaiaCapabilitySnapshot } from '../../src/shared'

const mocks = vi.hoisted(() => ({
  capabilities: vi.fn(),
  voiceObter: vi.fn(),
  voiceSalvar: vi.fn(),
  voiceTestar: vi.fn(),
  clientCall: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  listarConversas: vi.fn(),
  carregarConversa: vi.fn(),
}))

vi.mock('@/servicos/maia', () => ({
  servicoMaia: {
    capabilities: mocks.capabilities,
    voiceObter: mocks.voiceObter,
    voiceSalvar: mocks.voiceSalvar,
    voiceTestar: mocks.voiceTestar,
  },
}))

vi.mock('@/servicos/client', () => ({
  client: new Proxy({}, { get: () => mocks.clientCall }),
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))

vi.mock('@/componentes/PageHeader', () => ({
  PageHeader: () => <div data-testid="page-header" />,
}))

vi.mock('@/store/iaStore', () => ({
  useIaStore: (selector: (s: unknown) => unknown) =>
    selector({ listarConversas: mocks.listarConversas, carregarConversa: mocks.carregarConversa }),
}))

function caps(overrides: Partial<MaiaCapabilitySnapshot> = {}): MaiaCapabilitySnapshot {
  return {
    permissions: { screen: 'denied', accessibility: 'denied' },
    hotkeys: {
      literalReading: { accelerator: 'Shift+Delete', registered: true },
      commandBar: { accelerator: 'CommandOrControl+Shift+Space', registered: true },
    },
    route: {
      ok: true, task: 'maia_command', label: 'Maiá', mode: 'inherit',
      provider: 'local', model: 'gemma-4-e2b-it-q4', reason: 'ready', message: 'ok',
      inherited: true, auto_selected: false,
    },
    voice: { provider: 'openai', ready: false, reason: 'Configure a chave OpenAI em Configurações → Voz da Maiá.' },
    vision: { ok: false, source: null, reason: 'Projetor de visão (mmproj) não baixado.' },
    contextualActions: { ok: true },
    supportsScreenshot: false,
    ...overrides,
  }
}

async function renderMaiaPagina() {
  const { MaiaPagina } = await import('../../src/renderer/src/paginas/MaiaPagina')
  await act(async () => {
    render(
      <MemoryRouter>
        <MaiaPagina />
      </MemoryRouter>,
    )
  })
}

describe('MaiaPagina capability-aware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.capabilities.mockResolvedValue(caps())
  })

  it('disables the screenshot toggle and labels vision as unavailable when there is no vision', async () => {
    await renderMaiaPagina()
    await waitFor(() => expect(mocks.capabilities).toHaveBeenCalled())

    expect(screen.getByText(/visão indisponível/i)).toBeTruthy()
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox.getAttribute('disabled')).not.toBeNull()
  })

  it('gates the voice output option behind the OpenAI key', async () => {
    await renderMaiaPagina()
    await waitFor(() => expect(mocks.capabilities).toHaveBeenCalled())

    expect(screen.getByText(/configure a chave openai/i)).toBeTruthy()
  })

  it('blocks Perguntar with a reason when the maia_command route is not ready', async () => {
    mocks.capabilities.mockResolvedValue(
      caps({ contextualActions: { ok: false, reason: 'Configure um provedor de IA em Configurações.' } }),
    )
    await renderMaiaPagina()
    await waitFor(() => expect(mocks.capabilities).toHaveBeenCalled())

    expect(screen.getByRole('alert').textContent).toMatch(/Configure um provedor/i)
    const perguntar = screen.getByRole('button', { name: /perguntar/i }) as HTMLButtonElement
    expect(perguntar.disabled).toBe(true)
  })
})

async function renderVozCard() {
  const { VozDaMaiaCard } = await import('../../src/renderer/src/componentes/maia/VozDaMaiaCard')
  await act(async () => {
    render(<VozDaMaiaCard />)
  })
}

describe('VozDaMaiaCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.voiceObter.mockResolvedValue({ provider: 'openai', api_key: '', voice: 'nova', model: 'gpt-4o-mini-tts', speed: 1.15 })
    mocks.voiceSalvar.mockImplementation(async (patch) => ({ provider: 'openai', api_key: '', voice: 'nova', model: 'gpt-4o-mini-tts', speed: 1.15, ...patch }))
    mocks.voiceTestar.mockResolvedValue({ ok: true, provider: 'openai' })
  })

  it('loads the voice config and triggers a real test through maia.voice.testar', async () => {
    await renderVozCard()
    await waitFor(() => expect(mocks.voiceObter).toHaveBeenCalled())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /testar voz/i }))

    await waitFor(() => expect(mocks.voiceTestar).toHaveBeenCalled())
    expect(mocks.toastSuccess).toHaveBeenCalled()
  })

  it('persists the OpenAI key on blur', async () => {
    await renderVozCard()
    await waitFor(() => expect(mocks.voiceObter).toHaveBeenCalled())

    const user = userEvent.setup()
    const input = screen.getByLabelText(/chave openai/i)
    await user.type(input, 'sk-live-key')
    await act(async () => {
      input.blur()
    })

    await waitFor(() => expect(mocks.voiceSalvar).toHaveBeenCalledWith({ api_key: 'sk-live-key' }))
  })
})
