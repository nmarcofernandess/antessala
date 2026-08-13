import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  obter: vi.fn(),
  criar: vi.fn(),
  renomear: vi.fn(),
  arquivar: vi.fn(),
  restaurar: vi.fn(),
  deletar: vi.fn(),
  salvarMensagem: vi.fn(),
  atualizarMensagem: vi.fn(),
  deletarApos: vi.fn(),
}))

vi.mock('@/servicos/client', () => ({
  client: {
    'ia.conversas.listar': mocks.listar,
    'ia.conversas.obter': mocks.obter,
    'ia.conversas.criar': mocks.criar,
    'ia.conversas.renomear': mocks.renomear,
    'ia.conversas.arquivar': mocks.arquivar,
    'ia.conversas.restaurar': mocks.restaurar,
    'ia.conversas.deletar': mocks.deletar,
    'ia.mensagens.salvar': mocks.salvarMensagem,
    'ia.mensagens.atualizar': mocks.atualizarMensagem,
    'ia.mensagens.deletarApos': mocks.deletarApos,
  },
}))

import { useIaStore } from '../../src/renderer/src/store/iaStore'

describe('iaStore local e direto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listar.mockResolvedValue([])
    useIaStore.setState({
      conversa_ativa_id: 'conversation-1',
      conversa_ativa_titulo: 'Nova conversa',
      mensagens: [],
      carregando: false,
      conversas: [],
      busca_titulo: '',
      _inicializado: false,
    })
  })

  it('persiste mensagem e título pelo client tipado, sem processamento de sessão', async () => {
    const mensagem = {
      id: 'message-1',
      papel: 'usuario' as const,
      conteudo: 'Resumo clínico curto',
      timestamp: '2026-08-13T12:00:00.000Z',
    }

    await useIaStore.getState().adicionarMensagem(mensagem)

    expect(mocks.renomear).toHaveBeenCalledWith({
      id: 'conversation-1',
      titulo: 'Resumo clínico curto',
    })
    expect(mocks.salvarMensagem).toHaveBeenCalledWith({
      conversa_id: 'conversation-1',
      mensagem,
    })
    expect(useIaStore.getState().mensagens).toEqual([mensagem])
  })
})
