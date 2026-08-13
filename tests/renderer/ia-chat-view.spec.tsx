/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IaMensagem } from '../../src/shared'

const storeState = vi.hoisted(() => ({
  mensagens: [
    {
      id: 'user-1',
      timestamp: '2026-06-14T12:00:00.000Z',
      papel: 'usuario',
      conteudo: 'Pesquise e responda.',
    },
    {
      id: 'assistant-1',
      timestamp: '2026-06-14T12:00:01.000Z',
      papel: 'assistente',
      conteudo: 'Aqui esta a resposta final.',
    },
  ] as IaMensagem[],
  carregando: true,
  conversa_ativa_id: 'conversation-1',
  adicionarMensagem: vi.fn(),
  texto_parcial: 'Pensando em voz alta...',
  tool_calls_parciais: [],
  tools_em_andamento: {
    'tool-running-1': {
      tool_name: 'consultar_contexto',
      args: { consulta: 'flowkit' },
      started_at: 1,
    },
  },
  stream_id_ativo: 'stream-1',
  iniciarStream: vi.fn(),
  processarStreamEvent: vi.fn(),
  finalizarStream: vi.fn(),
  cancelarStream: vi.fn(),
  editarEReenviar: vi.fn(),
  pendingAutoMessage: null,
  setPendingAutoMessage: vi.fn(),
}))

vi.mock('@/store/iaStore', () => {
  const useIaStore = (selector?: (state: typeof storeState) => unknown) => (
    selector ? selector(storeState) : storeState
  )
  useIaStore.getState = () => storeState
  return { useIaStore }
})

vi.mock('@/store/appDataStore', () => ({
  useAppDataStore: (selector: (state: { snapshot: () => null }) => unknown) => selector({ snapshot: () => null }),
}))

vi.mock('@/hooks/useIaModelConfig', () => ({
  useIaModelConfig: () => ({
    provider: 'local',
    providerOptions: [{ provider: 'local', label: 'IA local', disabled: false }],
    modelo: 'gemma-4-e2b-it-q4',
    modeloLabel: 'Gemma 4 E2B IT',
    modelOptions: [{ id: 'gemma-4-e2b-it-q4', label: 'Gemma 4 E2B IT', disabled: false }],
    contextLength: 8192,
    supportsMultimodal: false,
    isLoading: false,
    canSendMessages: true,
    showUnconfiguredState: false,
    activeProviderReason: undefined,
    modelSelectDisabled: false,
    setProvider: vi.fn(),
    setModelo: vi.fn(),
  }),
}))

vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    recording: false,
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
  }),
}))

vi.mock('@/servicos/stt', () => ({
  servicoStt: { transcribe: vi.fn() },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/ia' }),
  }
})

describe('IaChatView ai elements surface', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollTo = vi.fn()
    Object.assign(window, {
      electron: {
        ipcRenderer: {
          invoke: vi.fn(),
          on: vi.fn(() => vi.fn()),
        },
      },
    })
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn() },
    })
  })

  it('renders assistant message, streaming tool panel, running tool state and chat input', async () => {
    const { IaChatView } = await import('../../src/renderer/src/componentes/IaChatView')
    render(<IaChatView />)

    expect(screen.getByTestId('ia-assistant-message')).toBeInTheDocument()
    expect(screen.getByTestId('ia-tool-calls-panel')).toBeInTheDocument()
    expect(screen.getByTestId('ia-chat-input')).toBeInTheDocument()
    expect(screen.getByText('Executando')).toBeInTheDocument()
    expect(screen.getByTestId('ia-streaming-text')).toBeInTheDocument()
  })
})
