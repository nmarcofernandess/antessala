/** @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chatEnviar: vi.fn(),
  adicionarMensagem: vi.fn(),
  setCarregando: vi.fn(),
  editarEReenviar: vi.fn(),
  navigate: vi.fn(),
  state: {
    mensagens: [],
    carregando: false,
    conversa_ativa_id: 'conversation-1',
  },
}))

vi.mock('@/servicos/client', () => ({
  client: { 'ia.chat.enviar': mocks.chatEnviar },
}))

vi.mock('@/store/iaStore', () => {
  const store = {
    ...mocks.state,
    adicionarMensagem: mocks.adicionarMensagem,
    setCarregando: mocks.setCarregando,
    editarEReenviar: mocks.editarEReenviar,
  }
  const useIaStore = () => store
  useIaStore.getState = () => store
  return { useIaStore }
})

vi.mock('@/hooks/useIaModelConfig', () => ({
  useIaModelConfig: () => ({
    config: { provider: 'gemini', modelo: 'gemini-3.5-flash', configurado: true },
    providerLabel: 'Google Gemini',
    isLoading: false,
    canSendMessages: true,
  }),
}))

vi.mock('@/componentes/IaMensagemBubble', () => ({ IaMensagemBubble: () => null }))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mocks.navigate,
}))

describe('IaChatView cloud direto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chatEnviar.mockResolvedValue({ resposta: 'Resposta direta.' })
    window.HTMLElement.prototype.scrollTo = vi.fn()
  })

  it('envia somente mensagem, histórico e conversa, sem tools, RAG, anexo ou stream', async () => {
    const { IaChatView } = await import('../../src/renderer/src/componentes/IaChatView')
    const user = userEvent.setup()
    render(<IaChatView />)

    await user.type(screen.getByRole('textbox', { name: 'Mensagem' }), 'Avalie este caso')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => {
      expect(mocks.chatEnviar).toHaveBeenCalledWith({
        mensagem: 'Avalie este caso',
        historico: [],
        conversa_id: 'conversation-1',
      })
    })
    expect(mocks.chatEnviar.mock.calls[0][0]).not.toHaveProperty('stream_id')
    expect(mocks.chatEnviar.mock.calls[0][0]).not.toHaveProperty('contexto')
    expect(mocks.chatEnviar.mock.calls[0][0]).not.toHaveProperty('anexos')
    expect(mocks.setCarregando).toHaveBeenNthCalledWith(1, true)
    expect(mocks.setCarregando).toHaveBeenLastCalledWith(false)
    expect(mocks.adicionarMensagem).toHaveBeenCalledWith(expect.objectContaining({
      papel: 'assistente',
      conteudo: 'Resposta direta.',
    }))
  })
})
