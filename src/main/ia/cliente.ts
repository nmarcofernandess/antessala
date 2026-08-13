import { generateText } from 'ai'
import type { ModelMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { queryOne } from '../db/query'
import { isGeminiCloudApiEnabled } from '../config/app-config'
import { resolveModel, resolveProviderApiKey } from './config'
import type { IaConfiguracao, IaMensagem } from '../../shared/types'

const SYSTEM_PROMPT = [
  'Você é o assistente do Antessala, um aplicativo de triagem pré-anestésica.',
  'Use somente os dados fornecidos nesta conversa.',
  'Não invente histórico de paciente, evolução, prioridade ou ordem de fila.',
  'Quando faltar informação clínica, diga com clareza o que falta.',
].join('\n')

function toModelMessages(historico: IaMensagem[], mensagem: string): ModelMessage[] {
  const messages: ModelMessage[] = historico.flatMap((item) => {
    if (item.papel === 'usuario') return [{ role: 'user' as const, content: item.conteudo }]
    if (item.papel === 'assistente') return [{ role: 'assistant' as const, content: item.conteudo }]
    return []
  })
  messages.push({ role: 'user', content: mensagem })
  return messages
}

function friendlyProviderError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  if (normalized.includes('429') || normalized.includes('rate limit') || normalized.includes('quota')) {
    return new Error('Limite de requisições excedido. Aguarde e tente novamente.')
  }
  if (
    normalized.includes('401') ||
    normalized.includes('403') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('api key')
  ) {
    return new Error('Chave de API inválida ou sem permissão.')
  }
  return error instanceof Error ? error : new Error(message)
}

function assertCloudConfig(config: IaConfiguracao | undefined): asserts config is IaConfiguracao {
  if (!config || config.ativo === false) throw new Error('Assistente IA não configurado.')
  if (config.provider !== 'gemini' && config.provider !== 'openrouter') {
    throw new Error('Somente Gemini e OpenRouter são suportados nesta versão.')
  }
}

export async function iaEnviarMensagem(
  mensagem: string,
  historico: IaMensagem[] = [],
): Promise<{ resposta: string }> {
  const prompt = mensagem.trim()
  if (!prompt) throw new Error('Mensagem vazia.')

  const config = await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1')
  assertCloudConfig(config)
  const apiKey = resolveProviderApiKey(config)
  if (!apiKey) throw new Error('Chave de API não configurada.')
  const modelo = resolveModel(config, config.provider)

  try {
    const model = config.provider === 'gemini'
      ? createGoogleGenerativeAI({ apiKey })(modelo)
      : createOpenRouter({ apiKey })(modelo)
    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: toModelMessages(historico, prompt),
    })
    const resposta = result.text.trim()
    if (!resposta) throw new Error('O provedor retornou uma resposta vazia.')
    return { resposta }
  } catch (error) {
    throw friendlyProviderError(error)
  }
}

export async function iaTestarConexao(
  provider: string,
  apiKey: string,
  modelo: string,
): Promise<{ sucesso: boolean; mensagem: string }> {
  if (provider !== 'gemini' && provider !== 'openrouter') {
    throw new Error('Provider inválido. Escolha Gemini ou OpenRouter.')
  }
  if (!apiKey.trim()) throw new Error('Chave de API não fornecida.')
  if (!modelo.trim()) throw new Error('Modelo não fornecido.')
  if (provider === 'gemini' && !isGeminiCloudApiEnabled()) {
    throw new Error('A API Gemini está desativada nesta instalação.')
  }

  try {
    const model = provider === 'gemini'
      ? createGoogleGenerativeAI({ apiKey: apiKey.trim() })(modelo.trim())
      : createOpenRouter({ apiKey: apiKey.trim() })(modelo.trim())
    const result = await generateText({ model, prompt: 'Responda apenas: OK' })
    return {
      sucesso: true,
      mensagem: `${provider === 'gemini' ? 'Gemini' : 'OpenRouter'} conectado: ${result.text.trim().slice(0, 50)}`,
    }
  } catch (error) {
    throw friendlyProviderError(error)
  }
}

export const __iaClienteTestables = { toModelMessages, friendlyProviderError }
