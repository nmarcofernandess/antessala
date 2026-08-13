import type { IaAnexo, IaContexto } from '../../shared/types'
import { assertIaRouteReady } from '../ia/routing'
import {
  createFlowKitConversation,
  sendFlowKitChatMessage,
} from './flowkit-chat-adapter'
import { speakViaProvider } from './tts/openai-tts'

export type MaiaOutputMode = 'voice' | 'text'

export interface ContextualQuestionInput {
  prompt: string
  selectedText?: string
  manualText?: string
  screenshotAttachment?: IaAnexo | null
  outputMode?: MaiaOutputMode
}

export interface ContextualQuestionResult {
  conversaId: string
  resposta: string
  outputMode: MaiaOutputMode
}

function buildMessage(input: ContextualQuestionInput): string {
  const sections = [
    input.prompt.trim(),
    input.selectedText?.trim() ? `\n\n[Selecao]\n${input.selectedText.trim()}` : '',
    input.manualText?.trim() ? `\n\n[Texto manual]\n${input.manualText.trim()}` : '',
  ]
  return sections.filter(Boolean).join('')
}

export async function runContextualQuestion(input: ContextualQuestionInput): Promise<ContextualQuestionResult> {
  if (!input.prompt.trim()) throw new Error('Pergunta vazia.')

  // Gate de rota: nenhuma ação gerada roda sem a rota maia_command pronta.
  // assertIaRouteReady lança com o motivo acionável quando não está.
  await assertIaRouteReady('maia_command')

  const conversa = await createFlowKitConversation({ titulo: 'Pergunta Maia' })
  const contexto: IaContexto = { pagina: 'externo', rota: 'maia://contextual' }
  const anexos = input.screenshotAttachment ? [input.screenshotAttachment] : []
  const response = await sendFlowKitChatMessage({
    conversaId: conversa.id,
    mensagem: buildMessage(input),
    contexto,
    anexos,
    routeTask: 'maia_command',
  })
  const outputMode = input.outputMode ?? 'voice'

  if (outputMode === 'voice') {
    await speakViaProvider({
      text: response.resposta,
      instructions: 'Leia a resposta em portugues brasileiro, com clareza e ritmo natural.',
    })
  }

  return {
    conversaId: conversa.id,
    resposta: response.resposta,
    outputMode,
  }
}
