import { beforeEach, describe, expect, it, vi } from 'vitest'

const rows: Record<string, any[]> = {
  ia_conversas: [],
  ia_mensagens: [],
}

const mocks = vi.hoisted(() => ({
  iaEnviarMensagemStream: vi.fn(),
}))

vi.mock('../../../src/main/ia/cliente', () => ({
  iaEnviarMensagemStream: mocks.iaEnviarMensagemStream,
}))

vi.mock('../../../src/main/db/query', () => ({
  execute: vi.fn(async (sql: string, ...params: any[]) => {
    if (sql.includes('INSERT INTO ia_conversas')) {
      rows.ia_conversas.push({ id: params[0], titulo: params[1] })
      return { changes: 1 }
    }
    if (sql.includes('INSERT INTO ia_mensagens')) {
      rows.ia_mensagens.push({
        id: params[0],
        conversa_id: params[1],
        papel: params[2],
        conteudo: params[3],
        timestamp: params[4],
        tool_calls_json: params[5],
        anexos_meta_json: params[6],
      })
      return { changes: 1 }
    }
    return { changes: 1 }
  }),
  queryOne: vi.fn(async (sql: string) => {
    if (sql.includes('configuracao_ia')) {
      return {
        id: 1,
        provider: 'gemini',
        api_key: 'test-key',
        modelo: 'gemini-3.5-flash',
        ativo: true,
        memoria_automatica: true,
        criado_em: new Date(0).toISOString(),
        atualizado_em: new Date(0).toISOString(),
      }
    }
    return null
  }),
  queryAll: vi.fn(async (sql: string, conversaId: string) => {
    if (sql.includes('ia_mensagens')) {
      return rows.ia_mensagens.filter((row) => row.conversa_id === conversaId)
    }
    return []
  }),
}))

describe('FlowKit chat adapter for Maiá', () => {
  beforeEach(() => {
    rows.ia_conversas.length = 0
    rows.ia_mensagens.length = 0
    vi.clearAllMocks()
    mocks.iaEnviarMensagemStream.mockResolvedValue({
      resposta: 'Resposta do FlowKit',
      acoes: [],
    })
  })

  it('persists user and assistant messages around the existing FlowKit chat call', async () => {
    const { createFlowKitConversation, sendFlowKitChatMessage } = await import('../../../src/main/maia/flowkit-chat-adapter')
    const conversa = await createFlowKitConversation({ titulo: 'Pergunta Maiá' })

    const result = await sendFlowKitChatMessage({
      conversaId: conversa.id,
      mensagem: 'O que devo responder?',
      contexto: { pagina: 'externo', rota: 'maia://contextual' },
      anexos: [],
    })

    expect(result.resposta).toBe('Resposta do FlowKit')
    expect(rows.ia_mensagens.map((row) => row.papel)).toEqual(['usuario', 'assistente'])
    expect(mocks.iaEnviarMensagemStream).toHaveBeenCalledWith(
      'O que devo responder?',
      [],
      expect.any(String),
      { pagina: 'externo', rota: 'maia://contextual' },
      conversa.id,
      [],
    )
  })
})
