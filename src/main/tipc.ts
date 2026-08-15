import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { execute, queryAll, queryOne } from './db/query'
import { iaEnviarMensagem, iaTestarConexao } from './ia/cliente'
import { PROVIDER_DEFAULTS, resolveProviderApiKey } from './ia/config'
import type { IaConfiguracao, IaMensagem } from '../shared/types'
import type { ActiveIpcChannel } from '../shared/active-ipc-channels'
import { knowledgeStudioRouter } from './knowledge/router'
import {
  criarCaso,
  listarCasos,
  obterCaso,
  aceitarHandoff,
  cancelarCaso,
  contarPorStatus,
} from './clinical/case-service'
import {
  abrirAnamnese,
  obterAnamnese,
  salvarRascunho,
  finalizarAnamnese,
} from './clinical/anamnesis-service'
import {
  calcularParaCaso,
  confirmarRequisito,
  obterRequisitoDoCaso,
} from './clinical/requirement-service'
import {
  listarIntervalo,
  vagasCompativeis,
  reservar,
  moverReserva,
  cancelarReserva,
  filaParaAgendar,
  registrarChegada,
  registrarAusencia,
} from './scheduling/agenda-service'
import {
  listarRecursos,
  salvarRecurso,
  gerarVagas,
  removerVagasLivres,
  bloquearVaga,
  liberarVaga,
  resumoDaOferta,
  type PlanoDeVagas,
} from './scheduling/capacity-service'
import {
  iniciarEncontro,
  obterEncontro,
  salvarAvaliacao,
  interromperEncontro,
  abrirPendencia,
  submeterEvidencia,
  revisarEvidencia,
  cancelarPendencia,
  retomarRevisao,
} from './clinical/assessment-service'
import {
  obterResultadoDoCaso,
  finalizarResultado,
  revisarResultado,
  enviarEntrega,
  confirmarRecebimento,
} from './clinical/result-service'
import type {
  AvaliacaoRascunhoV1,
  EvidenciaPendencia,
  PedidoPendencia,
  PendencyDTO,
  PendencyImpact,
  PendencyKind,
  ResultadoConteudoV1,
} from '../shared/clinical/avaliacao'
import {
  serializarErro,
  type AnamnesisBlock,
  type CaseStatus,
  type CreateCaseInput,
  type SlotClass,
} from '../shared/clinical/caso'
import {
  arquivarProtocolo,
  duplicarProtocolo,
  listarProtocolos,
  restaurarFixture,
  restaurarProtocolo,
  salvarProtocolo,
  type EntradaProtocolo,
} from './db/protocolos'

const require = createRequire(import.meta.url)
const { tipc } = require('@egoist/tipc/main') as typeof import('@egoist/tipc/main')
const t = tipc.create()

type CloudProvider = 'gemini'
type ProviderSettings = Partial<Record<CloudProvider, { token?: string; modelo?: string }>>

function assertProvider(value: string): asserts value is CloudProvider {
  if (value !== 'gemini') {
    throw new Error('Provider inválido. O Antessala usa somente Gemini.')
  }
}

function parseProviderSettings(raw: unknown): ProviderSettings {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as ProviderSettings
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as ProviderSettings) : {}
  } catch {
    return {}
  }
}

function publicIaConfig(config: IaConfiguracao | undefined) {
  if (!config) return null
  const settings = parseProviderSettings(config.provider_configs_json)
  const redacted = Object.fromEntries(
    Object.entries(settings).map(([provider, value]) => [provider, { modelo: value?.modelo }]),
  )
  return {
    ...config,
    api_key: '',
    configurado: Boolean(resolveProviderApiKey(config)),
    provider_configs_json: JSON.stringify(redacted),
  }
}

const iaConfiguracaoObter = t.procedure.action(async () => {
  const config = await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1')
  return publicIaConfig(config)
})

const iaConfiguracaoSalvar = t.procedure
  .input<{
    provider: CloudProvider
    api_key?: string
    modelo: string
    provider_configs_json?: string
  }>()
  .action(async ({ input }) => {
    assertProvider(input.provider)
    const modelo = input.modelo.trim() || PROVIDER_DEFAULTS[input.provider]
    const current = await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1')
    const settings = parseProviderSettings(current?.provider_configs_json)
    const requested = parseProviderSettings(input.provider_configs_json)
    const legacyToken = current?.provider === input.provider ? current.api_key?.trim() : ''
    const token =
      input.api_key?.trim() ||
      requested[input.provider]?.token?.trim() ||
      settings[input.provider]?.token?.trim() ||
      legacyToken ||
      ''
    settings[input.provider] = { token, modelo }

    await execute(
      `INSERT INTO configuracao_ia (
         id, provider, api_key, modelo, provider_configs_json, ativo, memoria_automatica
       ) VALUES (1, $1, $2, $3, $4, $5, FALSE)
       ON CONFLICT (id) DO UPDATE SET
         provider = EXCLUDED.provider,
         api_key = EXCLUDED.api_key,
         modelo = EXCLUDED.modelo,
         provider_configs_json = EXCLUDED.provider_configs_json,
         ativo = EXCLUDED.ativo,
         memoria_automatica = FALSE,
         atualizado_em = NOW()`,
      input.provider,
      token,
      modelo,
      JSON.stringify(settings),
      Boolean(token),
    )
    const saved = await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1')
    return publicIaConfig(saved)
  })

const iaConfiguracaoTestar = t.procedure
  .input<{
    provider: CloudProvider
    api_key?: string
    modelo: string
    provider_configs_json?: string
  }>()
  .action(async ({ input }) => {
    assertProvider(input.provider)
    const current = await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1')
    const settings = parseProviderSettings(current?.provider_configs_json)
    const requested = parseProviderSettings(input.provider_configs_json)
    const legacyToken = current?.provider === input.provider ? current.api_key?.trim() : ''
    const token =
      input.api_key?.trim() ||
      requested[input.provider]?.token?.trim() ||
      settings[input.provider]?.token?.trim() ||
      legacyToken ||
      ''
    return iaTestarConexao(
      input.provider,
      token,
      input.modelo.trim() || settings[input.provider]?.modelo || PROVIDER_DEFAULTS[input.provider],
    )
  })

const iaChatEnviar = t.procedure
  .input<{ mensagem: string; historico?: IaMensagem[]; conversa_id?: string }>()
  .action(async ({ input }) => iaEnviarMensagem(input.mensagem, input.historico ?? []))

const iaConversasListar = t.procedure
  .input<{ status?: 'ativo' | 'arquivado'; busca?: string } | undefined>()
  .action(async ({ input }) => {
    const status = input?.status ?? 'ativo'
    const busca = input?.busca?.trim() ?? ''
    return queryAll(
      `SELECT * FROM ia_conversas
       WHERE status = $1 AND ($2 = '' OR titulo ILIKE '%' || $2 || '%')
       ORDER BY atualizado_em DESC`,
      status,
      busca,
    )
  })

const iaConversasObter = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    const conversa = await queryOne('SELECT * FROM ia_conversas WHERE id = $1', input.id)
    if (!conversa) throw new Error('Conversa não encontrada.')
    const mensagens = await queryAll<{
      id: string
      conversa_id: string
      papel: IaMensagem['papel']
      conteudo: string
      timestamp: string
    }>(
      `SELECT id, conversa_id, papel, conteudo, timestamp
       FROM ia_mensagens WHERE conversa_id = $1 ORDER BY timestamp, id`,
      input.id,
    )
    return { conversa, mensagens }
  })

const iaConversasCriar = t.procedure
  .input<{ titulo?: string } | undefined>()
  .action(async ({ input }) => {
    const id = randomUUID()
    const titulo = input?.titulo?.trim() || 'Nova conversa'
    await execute('INSERT INTO ia_conversas (id, titulo) VALUES ($1, $2)', id, titulo)
    return queryOne('SELECT * FROM ia_conversas WHERE id = $1', id)
  })

const iaConversasRenomear = t.procedure
  .input<{ id: string; titulo: string }>()
  .action(async ({ input }) => {
    const titulo = input.titulo.trim()
    if (!titulo) throw new Error('Título vazio.')
    await execute(
      'UPDATE ia_conversas SET titulo = $1, atualizado_em = NOW() WHERE id = $2',
      titulo,
      input.id,
    )
    return { ok: true }
  })

const iaConversasArquivar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    await execute(
      `UPDATE ia_conversas SET status = 'arquivado', atualizado_em = NOW() WHERE id = $1`,
      input.id,
    )
    return { ok: true }
  })

const iaConversasRestaurar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    await execute(
      `UPDATE ia_conversas SET status = 'ativo', atualizado_em = NOW() WHERE id = $1`,
      input.id,
    )
    return { ok: true }
  })

const iaConversasDeletar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    await execute('DELETE FROM ia_conversas WHERE id = $1', input.id)
    return { ok: true }
  })

const iaConversasArquivarTodas = t.procedure.action(async () => {
  await execute(`UPDATE ia_conversas SET status = 'arquivado', atualizado_em = NOW() WHERE status = 'ativo'`)
  return { ok: true }
})

const iaConversasDeletarArquivadas = t.procedure.action(async () => {
  await execute(`DELETE FROM ia_conversas WHERE status = 'arquivado'`)
  return { ok: true }
})

const iaMensagensSalvar = t.procedure
  .input<{ conversa_id: string; mensagem: IaMensagem }>()
  .action(async ({ input }) => {
    if (input.mensagem.papel !== 'usuario' && input.mensagem.papel !== 'assistente') {
      throw new Error('Papel de mensagem inválido.')
    }
    await execute(
      `INSERT INTO ia_mensagens (id, conversa_id, papel, conteudo, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      input.mensagem.id,
      input.conversa_id,
      input.mensagem.papel,
      input.mensagem.conteudo,
      input.mensagem.timestamp,
    )
    await execute('UPDATE ia_conversas SET atualizado_em = NOW() WHERE id = $1', input.conversa_id)
    return { ok: true }
  })

const iaMensagensAtualizar = t.procedure
  .input<{ id: string; conteudo: string }>()
  .action(async ({ input }) => {
    await execute('UPDATE ia_mensagens SET conteudo = $1 WHERE id = $2', input.conteudo, input.id)
    return { ok: true }
  })

const iaMensagensDeletarApos = t.procedure
  .input<{ conversa_id: string; timestamp: string }>()
  .action(async ({ input }) => {
    await execute(
      'DELETE FROM ia_mensagens WHERE conversa_id = $1 AND timestamp > $2',
      input.conversa_id,
      input.timestamp,
    )
    return { ok: true }
  })

/* ══════════════ caso pré-anestésico ══════════════ */

/**
 * O renderer manda intenção; o main decide, carimba ator e devolve.
 *
 * Nenhuma ação daqui aceita ator, horário ou responsabilidade vindos da tela —
 * mesmo que chegassem, seriam ignorados. Erros de domínio viajam serializados
 * com o código na frente, para a tela reagir sem parsing frágil.
 */
function comErroDeDominio<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((erro) => {
    throw new Error(serializarErro(erro))
  })
}

const casesCreate = t.procedure
  .input<CreateCaseInput>()
  .action(async ({ input }) => comErroDeDominio(() => criarCaso(input)))

const casesListForActor = t.procedure
  .input<{ status?: CaseStatus[]; busca?: string; limite?: number } | undefined>()
  .action(async ({ input }) => comErroDeDominio(() => listarCasos(input ?? {})))

const casesGet = t.procedure
  .input<{ caseId: string }>()
  .action(async ({ input }) => comErroDeDominio(() => obterCaso(input.caseId)))

const casesCounts = t.procedure.action(async () => comErroDeDominio(() => contarPorStatus()))

const casesServicos = t.procedure.action(async () =>
  queryAll<{ id: string; nome: string }>(
    `SELECT id, nome FROM catalogo_servicos_solicitantes WHERE ativo ORDER BY nome`,
  ),
)

const handoffsAcknowledge = t.procedure
  .input<{ caseId: string; handoffId: string; expectedCaseVersion: number; idempotencyKey: string }>()
  .action(async ({ input }) => comErroDeDominio(() => aceitarHandoff(input)))

const casesCancel = t.procedure
  .input<{ caseId: string; motivo: string; expectedCaseVersion: number }>()
  .action(async ({ input }) => comErroDeDominio(() => cancelarCaso(input)))

const anamnesisOpen = t.procedure
  .input<{ caseId: string }>()
  .action(async ({ input }) => comErroDeDominio(() => abrirAnamnese(input.caseId)))

const anamnesisGet = t.procedure
  .input<{ caseId: string }>()
  .action(async ({ input }) => comErroDeDominio(() => obterAnamnese(input.caseId)))

const anamnesisSaveDraft = t.procedure
  .input<{ anamnesisId: string; expectedVersion: number; blocks: AnamnesisBlock[] }>()
  .action(async ({ input }) => comErroDeDominio(() => salvarRascunho(input)))

const anamnesisFinalize = t.procedure
  .input<{ anamnesisId: string; expectedVersion: number }>()
  .action(async ({ input }) => comErroDeDominio(() => finalizarAnamnese(input)))

const requirementsCalculate = t.procedure
  .input<{ caseId: string }>()
  .action(async ({ input }) => comErroDeDominio(() => calcularParaCaso(input.caseId)))

const requirementsConfirm = t.procedure
  .input<{
    requirementId: string
    expectedVersion: number
    slotClassEscolhida?: SlotClass
    motivo?: string
  }>()
  .action(async ({ input }) => comErroDeDominio(() => confirmarRequisito(input)))

const requirementsGetForCase = t.procedure
  .input<{ caseId: string }>()
  .action(async ({ input }) => comErroDeDominio(() => obterRequisitoDoCaso(input.caseId)))

const schedulingRange = t.procedure
  .input<{ de: string; ate: string }>()
  .action(async ({ input }) => comErroDeDominio(() => listarIntervalo(input)))

const schedulingCompatibleSlots = t.procedure
  .input<{ requirementId: string; de?: string; limite?: number }>()
  .action(async ({ input }) => comErroDeDominio(() => vagasCompativeis(input)))

const schedulingBook = t.procedure
  .input<{ caseId: string; requirementId: string; slotId: string; idempotencyKey: string }>()
  .action(async ({ input }) => comErroDeDominio(() => reservar(input)))

const schedulingMove = t.procedure
  .input<{ bookingId: string; slotId: string; expectedVersion: number }>()
  .action(async ({ input }) => comErroDeDominio(() => moverReserva(input)))

const schedulingCancel = t.procedure
  .input<{ bookingId: string; motivo: string; expectedVersion: number }>()
  .action(async ({ input }) => comErroDeDominio(() => cancelarReserva(input)))

const schedulingQueue = t.procedure.action(async () => comErroDeDominio(() => filaParaAgendar()))

const capacityResources = t.procedure.action(async () => comErroDeDominio(() => listarRecursos()))

const capacitySaveResource = t.procedure
  .input<{ id?: string; nome: string; capabilities: string[]; ativo?: boolean }>()
  .action(async ({ input }) => comErroDeDominio(() => salvarRecurso(input)))

const capacityGenerate = t.procedure
  .input<PlanoDeVagas>()
  .action(async ({ input }) => comErroDeDominio(() => gerarVagas(input)))

const capacityClear = t.procedure
  .input<{ resourceId?: string; de: string; ate: string }>()
  .action(async ({ input }) => comErroDeDominio(() => removerVagasLivres(input)))

const capacityBlock = t.procedure
  .input<{ slotId: string; motivo: string }>()
  .action(async ({ input }) => comErroDeDominio(() => bloquearVaga(input)))

const capacityUnblock = t.procedure
  .input<{ slotId: string }>()
  .action(async ({ input }) => comErroDeDominio(() => liberarVaga(input.slotId)))

const capacitySummary = t.procedure.action(async () => comErroDeDominio(() => resumoDaOferta()))

const schedulingCheckIn = t.procedure
  .input<{ bookingId: string; expectedVersion: number }>()
  .action(async ({ input }) => comErroDeDominio(() => registrarChegada(input)))

const schedulingNoShow = t.procedure
  .input<{ bookingId: string; expectedVersion: number; nota?: string }>()
  .action(async ({ input }) => comErroDeDominio(() => registrarAusencia(input)))

/* ══════════════ avaliação, pendências e resultado ══════════════ */

const encountersStart = t.procedure
  .input<{ caseId: string; bookingId: string; expectedCaseVersion: number; idempotencyKey: string }>()
  .action(async ({ input }) => comErroDeDominio(() => iniciarEncontro(input)))

const encountersGet = t.procedure
  .input<{ caseId: string }>()
  .action(async ({ input }) => comErroDeDominio(() => obterEncontro(input.caseId)))

const encountersSave = t.procedure
  .input<{ encounterId: string; expectedVersion: number; assessment: AvaliacaoRascunhoV1 }>()
  .action(async ({ input }) => comErroDeDominio(() => salvarAvaliacao(input)))

const encountersInterrupt = t.procedure
  .input<{ encounterId: string; expectedVersion: number; motivo: string }>()
  .action(async ({ input }) => comErroDeDominio(() => interromperEncontro(input)))

const encountersResume = t.procedure
  .input<{ encounterId: string; expectedVersion: number }>()
  .action(async ({ input }) => comErroDeDominio(() => retomarRevisao(input)))

const pendenciesOpen = t.procedure
  .input<{
    encounterId: string
    expectedEncounterVersion: number
    kind: PendencyKind
    ownerRole: PendencyDTO['ownerRole']
    impact: PendencyImpact
    description: string
    requested: PedidoPendencia
    dueAt?: string | null
    dueAtBasis?: string | null
  }>()
  .action(async ({ input }) => comErroDeDominio(() => abrirPendencia(input)))

const pendenciesSubmit = t.procedure
  .input<{ pendencyId: string; expectedVersion: number; evidence: EvidenciaPendencia }>()
  .action(async ({ input }) => comErroDeDominio(() => submeterEvidencia(input)))

const pendenciesReview = t.procedure
  .input<{
    pendencyId: string
    expectedVersion: number
    decisao: 'ACCEPT' | 'REOPEN_AS_INSUFFICIENT'
    motivo: string
  }>()
  .action(async ({ input }) => comErroDeDominio(() => revisarEvidencia(input)))

const pendenciesCancel = t.procedure
  .input<{ pendencyId: string; expectedVersion: number; motivo: string; substituida?: boolean }>()
  .action(async ({ input }) => comErroDeDominio(() => cancelarPendencia(input)))

const resultsGetForCase = t.procedure
  .input<{ caseId: string }>()
  .action(async ({ input }) => comErroDeDominio(() => obterResultadoDoCaso(input.caseId)))

const resultsFinalize = t.procedure
  .input<{
    encounterId: string
    expectedEncounterVersion: number
    content: ResultadoConteudoV1
    idempotencyKey: string
  }>()
  .action(async ({ input }) => comErroDeDominio(() => finalizarResultado(input)))

const resultsRevise = t.procedure
  .input<{
    caseId: string
    expectedHeadVersion: number
    predecessorResultId: string
    emissionType: 'CORRECTION' | 'ADDENDUM'
    reason: string
    content: ResultadoConteudoV1
  }>()
  .action(async ({ input }) => comErroDeDominio(() => revisarResultado(input)))

const deliveriesSend = t.procedure
  .input<{ caseId: string; idempotencyKey: string }>()
  .action(async ({ input }) => comErroDeDominio(() => enviarEntrega(input)))

const deliveriesAcknowledge = t.procedure
  .input<{ deliveryId: string; expectedVersion: number }>()
  .action(async ({ input }) => comErroDeDominio(() => confirmarRecebimento(input)))

/* ══════════════ protocolos de coleta ══════════════ */

const protocolosListar = t.procedure
  .input<{ incluirArquivados?: boolean } | undefined>()
  .action(async ({ input }) => listarProtocolos({ incluirArquivados: input?.incluirArquivados }))

const protocolosSalvar = t.procedure
  .input<EntradaProtocolo>()
  .action(async ({ input }) => salvarProtocolo(input))

const protocolosDuplicar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => duplicarProtocolo(input.id))

const protocolosArquivar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => arquivarProtocolo(input.id))

const protocolosRestaurar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => restaurarProtocolo(input.id))

const protocolosRestaurarFixture = t.procedure.action(async () => restaurarFixture())

export const router = {
  'ia.configuracao.obter': iaConfiguracaoObter,
  'ia.configuracao.salvar': iaConfiguracaoSalvar,
  'ia.configuracao.testar': iaConfiguracaoTestar,
  'ia.chat.enviar': iaChatEnviar,
  'ia.conversas.listar': iaConversasListar,
  'ia.conversas.obter': iaConversasObter,
  'ia.conversas.criar': iaConversasCriar,
  'ia.conversas.renomear': iaConversasRenomear,
  'ia.conversas.arquivar': iaConversasArquivar,
  'ia.conversas.restaurar': iaConversasRestaurar,
  'ia.conversas.deletar': iaConversasDeletar,
  'ia.conversas.arquivarTodas': iaConversasArquivarTodas,
  'ia.conversas.deletarArquivadas': iaConversasDeletarArquivadas,
  'ia.mensagens.salvar': iaMensagensSalvar,
  'ia.mensagens.atualizar': iaMensagensAtualizar,
  'ia.mensagens.deletarApos': iaMensagensDeletarApos,
  'cases.create': casesCreate,
  'cases.listForActor': casesListForActor,
  'cases.get': casesGet,
  'cases.counts': casesCounts,
  'cases.servicos': casesServicos,
  'cases.cancel': casesCancel,
  'handoffs.acknowledge': handoffsAcknowledge,
  'anamnesis.open': anamnesisOpen,
  'anamnesis.get': anamnesisGet,
  'anamnesis.saveDraft': anamnesisSaveDraft,
  'anamnesis.finalize': anamnesisFinalize,
  'requirements.calculate': requirementsCalculate,
  'requirements.confirm': requirementsConfirm,
  'requirements.getForCase': requirementsGetForCase,
  'scheduling.range': schedulingRange,
  'scheduling.compatibleSlots': schedulingCompatibleSlots,
  'scheduling.book': schedulingBook,
  'scheduling.move': schedulingMove,
  'scheduling.cancel': schedulingCancel,
  'scheduling.queue': schedulingQueue,
  'scheduling.checkIn': schedulingCheckIn,
  'capacity.resources': capacityResources,
  'capacity.saveResource': capacitySaveResource,
  'capacity.generateSlots': capacityGenerate,
  'capacity.clearFreeSlots': capacityClear,
  'capacity.blockSlot': capacityBlock,
  'capacity.unblockSlot': capacityUnblock,
  'capacity.summary': capacitySummary,
  'scheduling.noShow': schedulingNoShow,
  'encounters.start': encountersStart,
  'encounters.get': encountersGet,
  'encounters.saveAssessment': encountersSave,
  'encounters.interrupt': encountersInterrupt,
  'encounters.resumeReview': encountersResume,
  'pendencies.open': pendenciesOpen,
  'pendencies.submitEvidence': pendenciesSubmit,
  'pendencies.reviewEvidence': pendenciesReview,
  'pendencies.cancel': pendenciesCancel,
  'results.getForCase': resultsGetForCase,
  'results.finalize': resultsFinalize,
  'results.revise': resultsRevise,
  'deliveries.send': deliveriesSend,
  'deliveries.acknowledge': deliveriesAcknowledge,
  'protocolos.listar': protocolosListar,
  'protocolos.salvar': protocolosSalvar,
  'protocolos.duplicar': protocolosDuplicar,
  'protocolos.arquivar': protocolosArquivar,
  'protocolos.restaurar': protocolosRestaurar,
  'protocolos.restaurarFixture': protocolosRestaurarFixture,
  ...knowledgeStudioRouter,
  'app:version': t.procedure.action(async () => {
    try {
      const electron = require('electron') as { app?: { getVersion?: () => string } }
      return electron.app?.getVersion?.() ?? '0.0.0'
    } catch {
      return '0.0.0'
    }
  }),
} satisfies Record<ActiveIpcChannel, unknown>

export type Router = typeof router
