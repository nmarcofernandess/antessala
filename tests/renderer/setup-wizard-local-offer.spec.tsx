/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// O wizard novo NÃO navega mais para /configuracoes (o download acontece
// dentro do próprio passo de IA). Mas outros componentes que ele monta podem
// usar react-router; mantemos um stub barato de useNavigate por segurança.
const navigateMock = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

// O passo de Arquivos reusa o AdicionarConhecimentoDialog real. Mockamos um
// dublê leve que só prova "abriu/fechou" para não arrastar todo o serviço de
// conhecimento + IPC de import para dentro deste teste de wizard.
vi.mock('@/componentes/AdicionarConhecimentoDialog', () => ({
  AdicionarConhecimentoDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-knowledge-dialog">add-knowledge</div> : null,
}))

type CapsShape = {
  gemini_cloud_api_enabled?: boolean
  local_server_binary_available?: boolean
  has_any_available_provider?: boolean
}

type LocalModelStub = {
  id: string
  label: string
  size_bytes: number
  baixado?: boolean
  usable?: boolean
  requires_validation?: boolean
  load_error?: string
  download_status?: 'idle' | 'downloading' | 'cancelled' | 'failed' | 'done'
  download_progresso?: number
  download_bytes_total?: number
  download_bytes_feitos?: number
}

function makeLocalModels(overrides: Partial<LocalModelStub>[] = [{}]): LocalModelStub[] {
  return overrides.map((o, i) => ({
    id: o.id ?? `gemma-${i}`,
    label: o.label ?? 'Gemma 4 E2B IT',
    size_bytes: o.size_bytes ?? 3_110_000_000,
    baixado: o.baixado ?? false,
    usable: o.usable ?? false,
    requires_validation: o.requires_validation,
    load_error: o.load_error,
    download_status: o.download_status,
    download_progresso: o.download_progresso,
    download_bytes_total: o.download_bytes_total,
    download_bytes_feitos: o.download_bytes_feitos,
  }))
}

function stubElectron(caps: CapsShape, localModels: LocalModelStub[] = makeLocalModels()) {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === 'ia.capabilities.obter') return caps
    if (channel === 'config.envDetect') return {}
    if (channel === 'ia.local.models') return localModels
    if (channel === 'ia.configuracao.testar') return { sucesso: true, mensagem: 'Conectado!' }
    if (channel === 'ia.configuracao.salvar') return { sucesso: true }
    if (channel === 'config.set') return undefined
    if (channel === 'ia.local.download') return { sucesso: true }
    return undefined
  })
  const on = vi.fn(() => vi.fn())
  Object.assign(window, {
    electron: { ipcRenderer: { invoke, on } },
  })
  return { invoke, on }
}

async function renderWizard(onComplete = vi.fn(), props: Record<string, unknown> = {}) {
  const mod = await import('../../src/renderer/src/componentes/onboarding/SetupWizard')
  const SetupWizard = mod.default
  render(<SetupWizard onComplete={onComplete} {...props} />)
}

async function goToIaStep() {
  await userEvent.click(await screen.findByRole('button', { name: /Começar|Comecar/ }))
}

describe('SetupWizard — setup de 4 passos (Bem-vindo → IA → Arquivos → Concluir)', () => {
  beforeEach(() => {
    navigateMock.mockReset()
  })
  afterEach(() => {
    vi.resetModules()
  })

  it('passo 1 mostra o nome do app e o botão "Pular setup" (E2E depende dele)', async () => {
    stubElectron({ gemini_cloud_api_enabled: true, local_server_binary_available: true })
    await renderWizard()

    const { APP_NAME } = await import('../../src/renderer/src/lib/app-info')
    expect(await screen.findByText(APP_NAME)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pular setup' })).toBeInTheDocument()
  })

  it('passo de IA lista os modelos locais quando o binário existe', async () => {
    stubElectron(
      { gemini_cloud_api_enabled: true, local_server_binary_available: true },
      makeLocalModels([{ label: 'Gemma 4 E2B IT' }]),
    )
    await renderWizard()
    await goToIaStep()

    // O card local aparece com label do catálogo e botão Baixar.
    expect(await screen.findByTestId('wizard-local-model-gemma-0')).toBeInTheDocument()
    expect(screen.getByText('Gemma 4 E2B IT')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Baixar/ })).toBeInTheDocument()
  })

  it('esconde a seção local quando o binário do bundle não existe', async () => {
    stubElectron({ gemini_cloud_api_enabled: true, local_server_binary_available: false })
    await renderWizard()
    await goToIaStep()

    // Cloud carregou (prova que o passo renderizou) antes de afirmar ausência.
    await screen.findByText(/OpenRouter/i)
    expect(screen.queryByTestId('wizard-local-section')).not.toBeInTheDocument()
  })

  it('mostra o card Gemini só quando gemini_cloud_api_enabled é true', async () => {
    stubElectron({ gemini_cloud_api_enabled: true, local_server_binary_available: false })
    await renderWizard()
    await goToIaStep()

    expect(await screen.findByTestId('wizard-cloud-gemini')).toBeInTheDocument()
    expect(screen.getByTestId('wizard-cloud-openrouter')).toBeInTheDocument()
  })

  it('esconde o card Gemini quando gemini_cloud_api_enabled é false (OpenRouter permanece)', async () => {
    stubElectron({ gemini_cloud_api_enabled: false, local_server_binary_available: false })
    await renderWizard()
    await goToIaStep()

    expect(await screen.findByTestId('wizard-cloud-openrouter')).toBeInTheDocument()
    expect(screen.queryByTestId('wizard-cloud-gemini')).not.toBeInTheDocument()
  })

  it('clicar [Baixar] dispara ia.local.download (clique = consentimento, sem auto-baixar)', async () => {
    const { invoke } = stubElectron(
      { gemini_cloud_api_enabled: true, local_server_binary_available: true },
      makeLocalModels([{ id: 'gemma-0', label: 'Gemma 4 E2B IT' }]),
    )
    await renderWizard()
    await goToIaStep()

    // Não baixou nada só por renderizar.
    expect(invoke).not.toHaveBeenCalledWith('ia.local.download', expect.anything())

    await userEvent.click(await screen.findByRole('button', { name: /Baixar/ }))
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('ia.local.download', { model_id: 'gemma-0' }),
    )
  })

  it('modelo baixando mostra barra de progresso (%)', async () => {
    stubElectron(
      { gemini_cloud_api_enabled: false, local_server_binary_available: true },
      makeLocalModels([
        {
          id: 'gemma-0',
          download_status: 'downloading',
          download_progresso: 0.42,
          download_bytes_total: 3_110_000_000,
          download_bytes_feitos: 1_300_000_000,
        },
      ]),
    )
    await renderWizard()
    await goToIaStep()
    expect(await screen.findByText(/42%/)).toBeInTheDocument()
  })

  it('modelo pronto (usable) mostra "Pronto" e não mostra [Baixar]', async () => {
    stubElectron(
      { gemini_cloud_api_enabled: false, local_server_binary_available: true },
      makeLocalModels([{ id: 'gemma-0', baixado: true, usable: true }]),
    )
    await renderWizard()
    await goToIaStep()

    const card = await screen.findByTestId('wizard-local-model-gemma-0')
    expect(within(card).getByText('Pronto')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Baixar/ })).not.toBeInTheDocument()
  })

  it('passo de Arquivos abre o AdicionarConhecimentoDialog ao clicar', async () => {
    stubElectron({ gemini_cloud_api_enabled: false, local_server_binary_available: false })
    await renderWizard()
    await goToIaStep()
    // IA -> Arquivos
    await userEvent.click(await screen.findByRole('button', { name: /Próximo|Proximo/ }))

    expect(screen.queryByTestId('add-knowledge-dialog')).not.toBeInTheDocument()
    await userEvent.click(await screen.findByTestId('wizard-open-files'))
    expect(await screen.findByTestId('add-knowledge-dialog')).toBeInTheDocument()
  })

  it('concluir chama config.set("onboarding_complete") e onComplete', async () => {
    const { invoke } = stubElectron({ gemini_cloud_api_enabled: false, local_server_binary_available: false })
    const onComplete = vi.fn()
    await renderWizard(onComplete)
    await goToIaStep()
    await userEvent.click(await screen.findByRole('button', { name: /Próximo|Proximo/ })) // IA -> Arquivos
    await userEvent.click(await screen.findByRole('button', { name: /Próximo|Proximo/ })) // Arquivos -> Concluir
    await userEvent.click(await screen.findByRole('button', { name: /Começar a usar|Comecar a usar/ }))

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('config.set', {
        key: 'onboarding_complete',
        value: '"true"',
      }),
    )
    expect(onComplete).toHaveBeenCalled()
  })

  it('mostra "Ver como funciona" no passo final só quando onStartTour é passado', async () => {
    stubElectron({ gemini_cloud_api_enabled: false, local_server_binary_available: false })
    const onStartTour = vi.fn()
    await renderWizard(vi.fn(), { onStartTour })
    await goToIaStep()
    await userEvent.click(await screen.findByRole('button', { name: /Próximo|Proximo/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Próximo|Proximo/ }))

    const tourBtn = await screen.findByRole('button', { name: /Ver como funciona/ })
    await userEvent.click(tourBtn)
    expect(onStartTour).toHaveBeenCalled()
  })
})
