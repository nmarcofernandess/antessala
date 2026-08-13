import { z } from 'zod'

import { createAnamneseId } from './id'
import { getWidgetDefinition, isValidWidgetType } from './registry'
import type {
  AnamneseContent,
  Bloco,
  BlocoResultado,
  BlocoSnapshot,
  BlocoWidget,
  WidgetType,
} from './types'

const ContentEnvelopeSchema = z.object({
  _v: z.literal(2),
  blocos: z.array(z.unknown()),
})

const WidgetBlockBaseSchema = z.object({
  _v: z.number().int().positive().optional(),
  id: z.string().min(1),
  type: z.literal('widget'),
  widgetType: z.string(),
  data: z.unknown(),
  convertidoParaTexto: z.boolean(),
  textoConvertido: z.string().optional(),
})

const SnapshotBlockSchema = z.object({
  _v: z.number().int().positive().optional(),
  id: z.string().min(1),
  type: z.literal('snapshot'),
  dataCaptura: z.string(),
  dados: z.object({
    dataCaptura: z.string(),
    antropometria: z.object({
      peso: z.number(),
      altura: z.number(),
      imc: z.number(),
      percentualGordura: z.number().optional(),
    }).optional(),
    estrategia: z.object({
      tipo: z.string(),
      calorias: z.number(),
      dieta: z.string().optional(),
    }).optional(),
    objetivo: z.object({
      descricao: z.string(),
      meta: z.number().optional(),
      progresso: z.number().optional(),
    }).optional(),
    protocolos: z.array(z.object({
      protocolo: z.string(),
      score: z.number(),
      interpretacao: z.string(),
    })).optional(),
  }),
})

const ResultadoBlockSchema = z.object({
  _v: z.number().int().positive().optional(),
  id: z.string().min(1),
  type: z.literal('resultado_protocolo'),
  protocoloTipo: z.string(),
  protocoloId: z.string(),
  scoreCapturado: z.number(),
  subscoresCapturados: z.record(z.string(), z.number()).optional(),
  dataCaptura: z.string(),
})

export class AnamneseValidationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'AnamneseValidationError'
  }
}

function parseBloco(raw: unknown, index: number): Bloco {
  const discriminator = z.object({ type: z.string() }).safeParse(raw)
  if (!discriminator.success) {
    throw new AnamneseValidationError(`Bloco ${index + 1}: formato inválido`, discriminator.error)
  }

  if (discriminator.data.type === 'widget') {
    const base = WidgetBlockBaseSchema.safeParse(raw)
    if (!base.success) {
      throw new AnamneseValidationError(`Bloco ${index + 1}: envelope de widget inválido`, base.error)
    }
    if (!isValidWidgetType(base.data.widgetType)) {
      throw new AnamneseValidationError(
        `Bloco ${index + 1}: widget desconhecido "${base.data.widgetType}"`,
      )
    }

    const definition = getWidgetDefinition(base.data.widgetType)
    const widgetData = definition.schema.safeParse(base.data.data)
    if (!widgetData.success) {
      throw new AnamneseValidationError(
        `Bloco ${index + 1} (${base.data.widgetType}): dados inválidos`,
        widgetData.error,
      )
    }

    return {
      ...base.data,
      widgetType: base.data.widgetType,
      data: widgetData.data as unknown as Record<string, unknown>,
    }
  }

  if (discriminator.data.type === 'snapshot') {
    const result = SnapshotBlockSchema.safeParse(raw)
    if (!result.success) {
      throw new AnamneseValidationError(`Bloco ${index + 1}: snapshot inválido`, result.error)
    }
    return result.data as BlocoSnapshot
  }

  if (discriminator.data.type === 'resultado_protocolo') {
    const result = ResultadoBlockSchema.safeParse(raw)
    if (!result.success) {
      throw new AnamneseValidationError(
        `Bloco ${index + 1}: resultado de protocolo inválido`,
        result.error,
      )
    }
    return result.data as BlocoResultado
  }

  throw new AnamneseValidationError(
    `Bloco ${index + 1}: tipo desconhecido "${discriminator.data.type}"`,
  )
}

export function validateAnamneseContent(raw: unknown): AnamneseContent {
  const envelope = ContentEnvelopeSchema.safeParse(raw)
  if (!envelope.success) {
    throw new AnamneseValidationError('Envelope de anamnese inválido', envelope.error)
  }

  return {
    _v: 2,
    blocos: envelope.data.blocos.map(parseBloco),
  }
}

export function serializeAnamneseContent(content: AnamneseContent): string {
  return JSON.stringify(validateAnamneseContent(content))
}

export function deserializeAnamneseContent(serialized: string | unknown): AnamneseContent {
  if (typeof serialized !== 'string') return validateAnamneseContent(serialized)

  try {
    return validateAnamneseContent(JSON.parse(serialized) as unknown)
  } catch (error) {
    if (error instanceof AnamneseValidationError) throw error
    throw new AnamneseValidationError('JSON de anamnese inválido', error)
  }
}

export function createEmptyAnamnese(): AnamneseContent {
  return { _v: 2, blocos: [] }
}

export function createWidgetBlock(
  widgetType: WidgetType,
  id = createAnamneseId(),
): BlocoWidget {
  const definition = getWidgetDefinition(widgetType)
  return {
    _v: definition.version,
    id,
    type: 'widget',
    widgetType,
    data: structuredClone(definition.defaultData) as Record<string, unknown>,
    convertidoParaTexto: false,
  }
}
