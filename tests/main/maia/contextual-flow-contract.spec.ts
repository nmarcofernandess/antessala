import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createFlowKitConversation: vi.fn(),
  sendFlowKitChatMessage: vi.fn(),
  speakViaProvider: vi.fn(),
  assertIaRouteReady: vi.fn(),
}))

vi.mock('../../../src/main/maia/flowkit-chat-adapter', () => ({
  createFlowKitConversation: mocks.createFlowKitConversation,
  sendFlowKitChatMessage: mocks.sendFlowKitChatMessage,
}))

vi.mock('../../../src/main/maia/tts/openai-tts', () => ({
  speakViaProvider: mocks.speakViaProvider,
}))

vi.mock('../../../src/main/ia/routing', () => ({
  assertIaRouteReady: mocks.assertIaRouteReady,
}))

describe('Maiá contextual flow contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createFlowKitConversation.mockResolvedValue({ id: 'conv-1', titulo: 'Pergunta Maiá' })
    mocks.sendFlowKitChatMessage.mockResolvedValue({ resposta: 'Resposta falada', acoes: [] })
    mocks.speakViaProvider.mockResolvedValue({ spoken: true, provider: 'openai' })
    mocks.assertIaRouteReady.mockResolvedValue({ ok: true, provider: 'local', model: 'gemma-4-e2b-it-q4' })
  })

  it('gates on the maia_command route and routes the chat through it', async () => {
    const { runContextualQuestion } = await import('../../../src/main/maia/contextual-flow')

    const result = await runContextualQuestion({
      prompt: 'O que devo responder?',
      selectedText: 'Mensagem recebida',
      screenshotAttachment: null,
      outputMode: 'voice',
    })

    expect(mocks.assertIaRouteReady).toHaveBeenCalledWith('maia_command')
    expect(mocks.createFlowKitConversation).toHaveBeenCalledTimes(1)
    expect(mocks.sendFlowKitChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversaId: 'conv-1',
      mensagem: expect.stringContaining('O que devo responder?'),
      contexto: expect.objectContaining({ pagina: 'externo', rota: 'maia://contextual' }),
      routeTask: 'maia_command',
    }))
    expect(result).toEqual(expect.objectContaining({
      conversaId: 'conv-1',
      resposta: 'Resposta falada',
      outputMode: 'voice',
    }))
  })

  it('blocks the generated action with a reason when the route is not ready', async () => {
    mocks.assertIaRouteReady.mockRejectedValue(new Error('Configure um provedor de IA. Abra Configurações.'))
    const { runContextualQuestion } = await import('../../../src/main/maia/contextual-flow')

    await expect(runContextualQuestion({ prompt: 'oi' })).rejects.toThrow(/Configure um provedor/)
    expect(mocks.sendFlowKitChatMessage).not.toHaveBeenCalled()
  })

  it('speaks by default through the configured voice provider', async () => {
    const { runContextualQuestion } = await import('../../../src/main/maia/contextual-flow')

    const result = await runContextualQuestion({ prompt: 'Explique TTS.' })

    expect(result.outputMode).toBe('voice')
    expect(result.resposta).toBe('Resposta falada')
    expect(mocks.speakViaProvider).toHaveBeenCalledWith(expect.objectContaining({ text: 'Resposta falada' }))
  })

  it('does not speak when output mode is text', async () => {
    const { runContextualQuestion } = await import('../../../src/main/maia/contextual-flow')

    await runContextualQuestion({ prompt: 'Responda em texto.', outputMode: 'text' })

    expect(mocks.speakViaProvider).not.toHaveBeenCalled()
  })
})
