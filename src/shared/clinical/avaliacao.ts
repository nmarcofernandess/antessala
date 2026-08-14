/**
 * Avaliação, pendências, resultado e entrega.
 *
 * Quatro coisas que o produto se recusa a fundir. Consumir a vaga não conclui o
 * encontro; abrir pendência não bloqueia por si; entregar evidência não é a
 * mesma coisa que aceitá-la; e disponibilizar o resultado no app não é enviá-lo
 * para fora do hospital.
 *
 * O que este arquivo **não** contém, e continua fora do produto por lei do
 * contrato: ASA, declaração de aptidão, conduta anestésica e marcação de
 * cirurgia. O resultado é uma comunicação clínica versionada — não uma
 * autorização.
 */

import type { ActorSnapshot } from './caso'

/* ══════════════ encontro ══════════════ */

export type EncounterStatus = 'IN_PROGRESS' | 'WAITING_PENDING' | 'COMPLETED'

/**
 * Por que o encontro terminou.
 *
 * `RESULT_FINALIZED` é a única conclusão clínica. `INTERRUPTED` preserva o
 * episódio que começou e não terminou — apagá-lo seria fingir que a pessoa
 * nunca entrou na sala.
 */
export type CompletionReason = 'RESULT_FINALIZED' | 'INTERRUPTED'

/** Uma narrativa registrada. Silêncio tem nome próprio e nunca vira negativa. */
export type Narrativa =
  | { estado: 'ANSWERED'; texto: string }
  | { estado: 'UNKNOWN' | 'NOT_APPLICABLE' | 'NOT_PERFORMED'; texto: null }

/** No rascunho existe um quinto estado: ninguém escreveu nada ainda. */
export type NarrativaRascunho = { estado: 'NOT_RECORDED'; texto: null } | Narrativa

export type DocumentoRevisado = {
  id: string
  tipo: 'EXAM' | 'REPORT' | 'OTHER'
  titulo: string
  observadoEm: string | null
  resumo: string
}

export type AvaliacaoRascunhoV1 = {
  _v: 1
  state: 'DRAFT'
  confirmacao: {
    pessoaConfere: boolean | null
    procedimentoConfere: boolean | null
    nota: string | null
  }
  entrevista: {
    historiaIntervalo: NarrativaRascunho
    sintomasAtuais: NarrativaRascunho
  }
  exame: {
    geral: NarrativaRascunho
    viaAerea: NarrativaRascunho
    revisaoSinaisVitais: NarrativaRascunho
    achadosAdicionais: NarrativaRascunho
  }
  documentosRevisados: DocumentoRevisado[]
  sintese: {
    resumo: string | null
    limitacoes: string[]
  }
}

/** A mesma avaliação, completa. É o schema que `results.finalize` exige. */
export type AvaliacaoCompletaV1 = {
  _v: 1
  state: 'COMPLETE'
  confirmacao: {
    pessoaConfere: boolean
    procedimentoConfere: boolean
    nota: string | null
  }
  entrevista: { historiaIntervalo: Narrativa; sintomasAtuais: Narrativa }
  exame: {
    geral: Narrativa
    viaAerea: Narrativa
    revisaoSinaisVitais: Narrativa
    achadosAdicionais: Narrativa
  }
  documentosRevisados: DocumentoRevisado[]
  sintese: { resumo: string; limitacoes: string[] }
}

export function rascunhoVazio(): AvaliacaoRascunhoV1 {
  const naoRegistrado = { estado: 'NOT_RECORDED', texto: null } as const
  return {
    _v: 1,
    state: 'DRAFT',
    confirmacao: { pessoaConfere: null, procedimentoConfere: null, nota: null },
    entrevista: { historiaIntervalo: naoRegistrado, sintomasAtuais: naoRegistrado },
    exame: {
      geral: naoRegistrado,
      viaAerea: naoRegistrado,
      revisaoSinaisVitais: naoRegistrado,
      achadosAdicionais: naoRegistrado,
    },
    documentosRevisados: [],
    sintese: { resumo: null, limitacoes: [] },
  }
}

export const ROTULO_NARRATIVA: Record<NarrativaRascunho['estado'], string> = {
  NOT_RECORDED: 'Não registrado',
  ANSWERED: 'Registrado',
  UNKNOWN: 'Desconhecido',
  NOT_APPLICABLE: 'Não se aplica',
  NOT_PERFORMED: 'Não realizado',
}

export interface EncounterDTO {
  id: string
  caseId: string
  bookingId: string
  sequence: number
  encounterType: 'INITIAL' | 'RETURN'
  status: EncounterStatus
  reviewCycle: number
  completionReason: CompletionReason | null
  responsibleActor: ActorSnapshot
  assessment: AvaliacaoRascunhoV1 | AvaliacaoCompletaV1
  version: number
  startedAt: string
  completedAt: string | null
  /** Derivado a cada leitura, nunca coluna: encontro parado sem bloqueio vivo. */
  canResumeReview: boolean
}

/* ══════════════ pendências ══════════════ */

export type PendencyKind = 'EXAM' | 'INFORMATION' | 'DOCUMENT' | 'OTHER'

/**
 * O impacto é decisão explícita de quem abriu, não consequência do tipo.
 *
 * Só `BLOCKS_CURRENT_RESULT` impede emitir a versão atual. As outras existem
 * justamente para que "pendência aberta" pare de significar "caso travado".
 */
export type PendencyImpact =
  | 'BLOCKS_CURRENT_RESULT'
  | 'FOLLOW_UP_WITHOUT_BLOCKING'
  | 'MAY_PREVENT_PROCEDURE'
  | 'OPERATIONAL_ONLY'
  | 'INDETERMINATE_PENDING_REVIEW'

export type PendencyStatus =
  | 'REQUESTED'
  | 'EVIDENCE_SUBMITTED'
  | 'RESOLVED_ACCEPTED'
  | 'INSUFFICIENT_REOPENED'
  | 'CANCELLED'
  | 'SUPERSEDED'

export const ROTULO_KIND: Record<PendencyKind, string> = {
  EXAM: 'Exame',
  INFORMATION: 'Informação',
  DOCUMENT: 'Documento',
  OTHER: 'Outro',
}

export const ROTULO_IMPACTO: Record<PendencyImpact, string> = {
  BLOCKS_CURRENT_RESULT: 'Impede emitir o resultado',
  FOLLOW_UP_WITHOUT_BLOCKING: 'Acompanhar, sem impedir',
  MAY_PREVENT_PROCEDURE: 'Pode impedir o procedimento',
  OPERATIONAL_ONLY: 'Somente operacional',
  INDETERMINATE_PENDING_REVIEW: 'Impacto ainda não decidido',
}

export const ROTULO_PENDENCIA: Record<PendencyStatus, string> = {
  REQUESTED: 'Pedido em aberto',
  EVIDENCE_SUBMITTED: 'Resposta entregue',
  RESOLVED_ACCEPTED: 'Aceita como suficiente',
  INSUFFICIENT_REOPENED: 'Insuficiente, reaberta',
  CANCELLED: 'Cancelada',
  SUPERSEDED: 'Substituída',
}

/** Impacto que trava emissão, e estados em que ele ainda está vivo. */
export const IMPACTO_BLOQUEADOR: PendencyImpact = 'BLOCKS_CURRENT_RESULT'
export const PENDENCIA_VIVA: PendencyStatus[] = [
  'REQUESTED',
  'EVIDENCE_SUBMITTED',
  'INSUFFICIENT_REOPENED',
]

export type PedidoPendencia = {
  _v: 1
  titulo: string
  perguntaClinica: string | null
  instrucoes: string | null
}

/**
 * A resposta a um pedido.
 *
 * `UNAVAILABLE` é resposta legítima e exige nota: "não conseguimos" é
 * informação, e tratá-la como silêncio empurraria o caso para o limbo.
 */
export type EvidenciaPendencia =
  | { _v: 1; desfecho: 'RECEIVED'; texto: string; observadoEm: string | null; nota: string | null }
  | { _v: 1; desfecho: 'UNAVAILABLE'; texto: null; observadoEm: null; nota: string }

export interface PendencyDTO {
  id: string
  caseId: string
  encounterId: string
  reviewCycle: number
  kind: PendencyKind
  ownerRole: 'RECEPCAO' | 'ENFERMAGEM' | 'ANESTESIOLOGISTA' | 'SOLICITANTE'
  targetServiceId: string | null
  impact: PendencyImpact
  status: PendencyStatus
  description: string
  requested: PedidoPendencia
  evidence: EvidenciaPendencia | null
  dueAt: string | null
  dueAtBasis: string | null
  openedBy: ActorSnapshot
  openedAt: string
  evidenceSubmittedBy: ActorSnapshot | null
  evidenceSubmittedAt: string | null
  reviewedBy: ActorSnapshot | null
  reviewedAt: string | null
  reviewReason: string | null
  cancelledBy: ActorSnapshot | null
  cancelledAt: string | null
  cancellationReason: string | null
  version: number
}

/* ══════════════ resultado ══════════════ */

export type EmissionType = 'FINAL' | 'CORRECTION' | 'ADDENDUM'

export const ROTULO_EMISSAO: Record<EmissionType, string> = {
  FINAL: 'Versão final',
  CORRECTION: 'Correção',
  ADDENDUM: 'Adendo',
}

export type ResultadoConteudoV1 = {
  _v: 1
  resumoDaAvaliacao: string
  conclusao: string
  recomendacoes: string[]
  limitacoes: string[]
  orientacoesDeRetorno: string | null
}

export interface ResultDTO {
  id: string
  caseId: string
  encounterId: string
  versionNumber: number
  emissionType: EmissionType
  predecessorResultId: string | null
  reason: string | null
  isCurrent: boolean
  content: ResultadoConteudoV1
  contentHash: string
  finalizedBy: ActorSnapshot
  finalizedAt: string
}

/* ══════════════ entrega ══════════════ */

/**
 * `LOCAL_DEMO` é o único canal, e o nome é literal.
 *
 * O app disponibiliza a versão selada para o serviço solicitante dentro da
 * própria demonstração. Chamar isso de "enviado ao hospital" seria mentira: não
 * existe integração, e a lei do domínio proíbe apresentar handoff local como
 * envio externo.
 */
export type DeliveryChannel = 'LOCAL_DEMO'
export type DeliveryStatus = 'SENT' | 'RECEIVED'

export interface DeliveryDTO {
  id: string
  caseId: string
  resultId: string
  targetServiceId: string
  serviceName: string
  channel: DeliveryChannel
  status: DeliveryStatus
  resultHash: string
  sentBy: ActorSnapshot
  sentAt: string
  receivedBy: ActorSnapshot | null
  receivedAt: string | null
  version: number
}

/** O que a tela do caso mostra sobre resultado e entrega, em uma leitura só. */
export interface ResultadoDoCasoDTO {
  encounter: EncounterDTO | null
  pendencies: PendencyDTO[]
  blockers: number
  current: ResultDTO | null
  history: ResultDTO[]
  delivery: DeliveryDTO | null
}
