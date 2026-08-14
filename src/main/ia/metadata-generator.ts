import { generateText } from 'ai'
import { queryOne } from '../db/query'
import { buildModelFactory } from './config'
import type { IaConfiguracao } from '../../shared/types'

export interface RagMetadataSuggestion {
  titulo: string
  quando_consultar: string
}

export interface KnowledgeCloudRoute {
  provider: 'gemini'
  model: string
}

export interface KnowledgeCloudStatus {
  available: boolean
  provider: KnowledgeCloudRoute['provider'] | null
  model: string | null
  message: string
  action?: string
}

export interface RagMetadataResult extends RagMetadataSuggestion {
  route: KnowledgeCloudRoute
}

export interface RagTextCorrectionResult {
  resultado: string
  route: KnowledgeCloudRoute
}

function capText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength).trim()
}

function extractJsonObject(raw: string): string {
  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  if (first < 0 || last <= first) {
    throw new Error('Resposta de metadata não contém JSON válido.')
  }
  return raw.slice(first, last + 1)
}

export function parseMetadataSuggestion(raw: unknown): RagMetadataSuggestion {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Resposta de metadata vazia ou não textual.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonObject(raw))
  } catch {
    throw new Error('Resposta de metadata não contém JSON válido.')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Resposta de metadata precisa ser um objeto JSON.')
  }

  const record = parsed as Record<string, unknown>
  const titulo = typeof record.titulo === 'string' ? capText(record.titulo, 120) : ''
  const quandoConsultar = typeof record.quando_consultar === 'string'
    ? capText(record.quando_consultar, 280)
    : ''

  if (!titulo || !quandoConsultar) {
    throw new Error('Resposta de metadata precisa conter titulo e quando_consultar.')
  }

  return {
    titulo,
    quando_consultar: quandoConsultar,
  }
}

function buildMetadataPrompt(texto: string, fileNameFallback: string): string {
  return [
    'Gere metadados de RAG para o documento abaixo.',
    'Responda APENAS com um objeto JSON válido, sem markdown e sem texto fora do JSON.',
    'Formato obrigatório: {"titulo":"...","quando_consultar":"..."}',
    'titulo: título curto e específico, máximo 120 caracteres.',
    'quando_consultar: frase prática dizendo quando a IA deve consultar o documento, máximo 280 caracteres.',
    `Nome de arquivo fallback: ${fileNameFallback}`,
    '',
    texto.slice(0, 8000),
  ].join('\n')
}

function buildCorrectionPrompt(texto: string): string {
  return [
    'Corrija ortografia e gramática do texto abaixo sem mudar o conteúdo, a intenção ou a formatação.',
    'Responda apenas com o texto corrigido.',
    '',
    texto.slice(0, 12000),
  ].join('\n')
}

async function getActiveIaConfig(): Promise<IaConfiguracao | null> {
  return await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1') ?? null
}

function resolveCloudFactory(config: IaConfiguracao | null) {
  if (!config) throw new Error('Assistente IA não configurado para ação cloud.')
  if (config.provider !== 'gemini') throw new Error('Configure o Gemini para esta ação.')
  const factory = buildModelFactory(config)
  if (!factory) {
    throw new Error(`Provider ${config.provider} indisponível para ação cloud.`)
  }
  return {
    factory,
    route: { provider: config.provider, model: factory.modelo } satisfies KnowledgeCloudRoute,
  }
}

export async function getKnowledgeCloudStatus(): Promise<KnowledgeCloudStatus> {
  const config = await getActiveIaConfig()
  if (!config) {
    return {
      available: false,
      provider: null,
      model: null,
      message: 'Configure o Gemini para usar metadados por IA.',
      action: 'Abrir Configurações de IA',
    }
  }

  try {
    const { route } = resolveCloudFactory(config)
    return {
      available: true,
      provider: route.provider,
      model: route.model,
      message: `${route.provider}/${route.model} disponível para ações explícitas.`,
    }
  } catch (error) {
    return {
      available: false,
      provider: config.provider === 'gemini' ? 'gemini' : null,
      model: config.modelo,
      message: (error as Error).message,
      action: 'Revisar Configurações de IA',
    }
  }
}

async function generateCloudText(
  prompt: string,
  configForCloud?: IaConfiguracao,
): Promise<{ text: string; route: KnowledgeCloudRoute }> {
  const config = configForCloud ?? await getActiveIaConfig()
  const { factory, route } = resolveCloudFactory(config)
  const result = await generateText({
    model: factory.createModel(factory.modelo),
    prompt,
  })
  return { text: result.text, route }
}

export async function generateRagMetadata(
  input: { texto: string; fileNameFallback: string },
  configForCloud?: IaConfiguracao,
): Promise<RagMetadataResult> {
  const generated = await generateCloudText(
    buildMetadataPrompt(input.texto, input.fileNameFallback),
    configForCloud,
  )
  return {
    ...parseMetadataSuggestion(generated.text),
    route: generated.route,
  }
}

export async function generateRagTextCorrection(
  texto: string,
  configForCloud?: IaConfiguracao,
): Promise<RagTextCorrectionResult> {
  const generated = await generateCloudText(buildCorrectionPrompt(texto), configForCloud)
  return { resultado: generated.text.trim(), route: generated.route }
}
