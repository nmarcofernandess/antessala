/**
 * Contrato do caso pré-anestésico entre main e renderer.
 *
 * Um caso nasce de um encaminhamento e morre nele mesmo. Não existe `patientId`,
 * cadastro de pessoa, deduplicação nem vínculo entre casos: a pessoa é um
 * snapshot carimbado no momento em que a recepção abriu o papel. Se a mesma
 * pessoa voltar, volta como caso novo — e isso é a regra, não uma limitação.
 *
 * O renderer nunca fornece ator, horário, responsabilidade ou compatibilidade.
 * Ele manda intenção; o main decide, carimba e devolve.
 */

export type CaseStatus =
  | 'RECEIVED_AT_RECEPTION'
  | 'WAITING_NURSING'
  | 'NURSING_IN_PROGRESS'
  | 'TRIAGE_PENDING'
  | 'READY_FOR_SCHEDULING'
  | 'SCHEDULED'
  | 'WAITING_ANESTHESIA'
  | 'IN_ASSESSMENT'
  | 'PENDING'
  | 'WAITING_RETURN'
  | 'READY_FOR_HANDOFF'
  | 'DELIVERED_TO_REQUESTER'
  | 'CANCELLED'

export type Papel = 'RECEPCAO' | 'ENFERMAGEM' | 'ANESTESIOLOGISTA' | 'SOLICITANTE' | 'ADMIN'

export const ROTULO_STATUS: Record<CaseStatus, string> = {
  RECEIVED_AT_RECEPTION: 'Recebido na recepção',
  WAITING_NURSING: 'Aguardando enfermagem',
  NURSING_IN_PROGRESS: 'Em entrevista',
  TRIAGE_PENDING: 'Triagem com pendência',
  READY_FOR_SCHEDULING: 'Pronto para agendar',
  SCHEDULED: 'Agendado',
  WAITING_ANESTHESIA: 'Aguardando anestesista',
  IN_ASSESSMENT: 'Em avaliação',
  PENDING: 'Pendência aberta',
  WAITING_RETURN: 'Aguardando retorno',
  READY_FOR_HANDOFF: 'Pronto para entrega',
  DELIVERED_TO_REQUESTER: 'Entregue ao solicitante',
  CANCELLED: 'Cancelado',
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  RECEPCAO: 'Recepção',
  ENFERMAGEM: 'Enfermagem',
  ANESTESIOLOGISTA: 'Anestesiologista',
  SOLICITANTE: 'Serviço solicitante',
  ADMIN: 'Administração',
}

export type SexoRelatado = 'FEMININO' | 'MASCULINO' | 'INTERSEXO' | 'NAO_INFORMADO'

export interface PersonSnapshot {
  _v: 1
  fullName: string
  birthDate: string | null
  ageYearsAtOpening: number
  sexReported: SexoRelatado
}

export interface ReferralSnapshot {
  _v: 1
  referralId: string
  sourceReference: string | null
  receivedAt: string
  freeTextReference: string
}

export interface ProcedureSnapshot {
  _v: 1
  description: string
  lateralityOrSite: string | null
  notes: string | null
}

export interface RequesterSnapshot {
  _v: 1
  serviceId: string
  serviceCatalogRevision: string
  serviceName: string
  physicianName: string
}

export interface ActorSnapshot {
  actorId: string
  displayName: string
  role: Papel
}

export interface CreateCaseInput {
  person: {
    fullName: string
    birthDate: string | null
    ageYearsAtOpening?: number
    sexReported: SexoRelatado
  }
  referral: {
    sourceReference: string | null
    freeTextReference: string
  }
  procedure: {
    description: string
    lateralityOrSite: string | null
    notes: string | null
  }
  requester: {
    serviceId: string
    physicianName: string
  }
  idempotencyKey: string
}

export type CaseEventType =
  | 'CASE_OPENED'
  | 'HANDOFF_SENT'
  | 'HANDOFF_ACKNOWLEDGED'
  | 'ANAMNESIS_STARTED'
  | 'ANAMNESIS_FINALIZED'
  | 'REQUIREMENT_CALCULATED'
  | 'REQUIREMENT_CONFIRMED'
  | 'REQUIREMENT_OVERRIDDEN'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_CHECKED_IN'
  | 'BOOKING_NO_SHOW'
  | 'ENCOUNTER_STARTED'
  | 'ENCOUNTER_INTERRUPTED'
  | 'PENDENCY_OPENED'
  | 'PENDENCY_EVIDENCE_SUBMITTED'
  | 'PENDENCY_ACCEPTED'
  | 'PENDENCY_REOPENED'
  | 'PENDENCY_CANCELLED'
  | 'REVIEW_RESUMED'
  | 'RESULT_FINALIZED'
  | 'RESULT_REVISED'
  | 'DELIVERY_SENT'
  | 'DELIVERY_ACKNOWLEDGED'
  | 'CASE_CANCELLED'

export const ROTULO_EVENTO: Record<CaseEventType, string> = {
  CASE_OPENED: 'Caso aberto',
  HANDOFF_SENT: 'Encaminhado à enfermagem',
  HANDOFF_ACKNOWLEDGED: 'Enfermagem assumiu o caso',
  ANAMNESIS_STARTED: 'Entrevista iniciada',
  ANAMNESIS_FINALIZED: 'Entrevista finalizada',
  REQUIREMENT_CALCULATED: 'Requisito calculado',
  REQUIREMENT_CONFIRMED: 'Requisito confirmado',
  REQUIREMENT_OVERRIDDEN: 'Requisito ajustado por decisão humana',
  BOOKING_CONFIRMED: 'Consulta reservada',
  BOOKING_RESCHEDULED: 'Consulta remarcada',
  BOOKING_CANCELLED: 'Reserva cancelada',
  BOOKING_CHECKED_IN: 'Chegada confirmada',
  BOOKING_NO_SHOW: 'Ausência registrada',
  ENCOUNTER_STARTED: 'Avaliação iniciada',
  ENCOUNTER_INTERRUPTED: 'Avaliação interrompida',
  PENDENCY_OPENED: 'Pendência aberta',
  PENDENCY_EVIDENCE_SUBMITTED: 'Resposta entregue à pendência',
  PENDENCY_ACCEPTED: 'Pendência aceita como suficiente',
  PENDENCY_REOPENED: 'Resposta considerada insuficiente',
  PENDENCY_CANCELLED: 'Pendência encerrada sem resposta',
  REVIEW_RESUMED: 'Avaliação retomada',
  RESULT_FINALIZED: 'Resultado emitido',
  RESULT_REVISED: 'Resultado revisado',
  DELIVERY_SENT: 'Resultado disponibilizado ao solicitante',
  DELIVERY_ACKNOWLEDGED: 'Solicitante confirmou o recebimento',
  CASE_CANCELLED: 'Caso cancelado',
}

export interface CaseEventDTO {
  id: number
  caseId: string
  eventType: CaseEventType
  fromStatus: CaseStatus | null
  toStatus: CaseStatus
  actor: ActorSnapshot
  reason: string | null
  payload: Record<string, unknown>
  occurredAt: string
  sequence: number
  receipt: { domain: string; id: string }
}

export interface CaseHandoffDTO {
  id: string
  caseId: string
  fromRole: Papel
  toRole: Papel
  type: string
  status: 'SENT' | 'RECEIVED' | 'CANCELLED'
  sentBy: ActorSnapshot
  sentAt: string
  receivedBy: ActorSnapshot | null
  receivedAt: string | null
  version: number
}

export interface CaseSummaryDTO {
  id: string
  displayCode: string
  personName: string
  personAge: number
  procedureDescription: string
  requesterLabel: string
  serviceName: string
  status: CaseStatus
  responsibility: { currentRoles: Papel[]; nextRoles: Papel[] }
  version: number
  openedAt: string
  updatedAt: string
  /** Só quando existe reserva ativa — é projeção, não estado do caso. */
  booking: {
    id: string
    startsAt: string
    endsAt: string
    slotClass: SlotClass
    status: string
    version: number
  } | null
  requirement: { id: string; slotClass: SlotClass; durationMinutes: number } | null
}

export interface CaseDetailDTO extends CaseSummaryDTO {
  person: PersonSnapshot
  referral: ReferralSnapshot
  procedure: ProcedureSnapshot
  requester: RequesterSnapshot
  timeline: CaseEventDTO[]
  openHandoff: CaseHandoffDTO | null
  anamnesis: { id: string; status: 'DRAFT' | 'FINAL'; revision: number } | null
}

/* ══════════════ anamnese ══════════════ */

export interface AnamnesisBlock {
  id: string
  tipo: string
  dados: unknown
}

export interface AnamnesisDTO {
  id: string
  caseId: string
  status: 'DRAFT' | 'FINAL'
  protocolId: string
  protocolVersion: number
  /** Composição aplicada ao caso — incluído é obrigatório para publicar. */
  protocolBlocks: string[]
  blocks: AnamnesisBlock[]
  revision: number
  version: number
  updatedAt: string
  finalizedAt: string | null
  finalizedBy: ActorSnapshot | null
}

/* ══════════════ requisito ══════════════ */

export type SlotClass = 'QUICK' | 'STANDARD' | 'EXTENDED'

export const ROTULO_CLASSE: Record<SlotClass, string> = {
  QUICK: 'Vaga rápida',
  STANDARD: 'Vaga normal',
  EXTENDED: 'Vaga estendida',
}

export interface RequirementDTO {
  id: string
  caseId: string
  anamnesisId: string
  anamnesisRevision: number
  status: 'CALCULATED' | 'CONFIRMED' | 'OVERRIDDEN'
  slotClass: SlotClass
  durationMinutes: number
  bufferMinutes: number
  calculatedMinutes: number
  requiredCapabilities: string[]
  /** Frases operacionais. Nunca achado clínico — a recepção não lê diagnóstico. */
  operationalExplanation: string[]
  pendingFieldPaths: string[]
  version: number
  createdAt: string
  confirmedAt: string | null
  confirmedBy: ActorSnapshot | null
}

/* ══════════════ agenda ══════════════ */

/**
 * A agenda não tem vaga guardada em lugar nenhum.
 *
 * O que existe é expediente (regra semanal por consultório), o que foi bloqueado
 * e o que já está marcado. "Livre" é o que sobra dessa conta, calculado na hora.
 * Vaga pré-criada desperdiçava o dia: a de 50 min que ninguém usou não virava
 * duas de 20.
 */
export interface IntervaloDTO {
  inicio: string
  fim: string
}

/** A cota é reserva de tempo por classe — em minutos do expediente daquele dia. */
export interface CotaDoDia {
  reservado: number
  usado: number
}

export interface DiaDaAgendaDTO {
  data: string
  resourceId: string
  resourceName: string
  atendimento: IntervaloDTO[]
  livres: IntervaloDTO[]
  bloqueios: IntervaloDTO[]
  consultas: Array<{
    bookingId: string
    caseId: string
    displayCode: string
    personName: string
    slotClass: SlotClass
    status: string
    version: number
    inicio: string
    fim: string
    /** Fim + buffer: o tempo que a sala fica de fato ocupada. */
    ocupaAte: string
  }>
  minutosDeAtendimento: number
  minutosLivres: number
  /** Quantas consultas de cada classe ainda cabem, respeitando a cota. */
  capacidade: Record<SlotClass, number>
  cota: Record<SlotClass, CotaDoDia>
}

export interface AgendaIntervaloDTO {
  resources: Array<{ id: string; name: string; capabilities: string[] }>
  dias: DiaDaAgendaDTO[]
}

/** Um horário que serve para este requisito — o que o modal de marcar oferece. */
export interface SugestaoDTO {
  resourceId: string
  resourceName: string
  startsAt: string
  endsAt: string
  slotClass: SlotClass
}

export interface BookingDTO {
  id: string
  caseId: string
  displayCode: string
  personName: string
  procedureDescription: string
  requirementId: string
  resourceId: string
  resourceName: string
  kind: 'INITIAL' | 'RETURN'
  slotClass: SlotClass
  startsAt: string
  endsAt: string
  bufferMinutes: number
  status: 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED'
  version: number
  createdAt: string
  checkedInAt: string | null
}

/* ══════════════ erros ══════════════ */

export type CodigoErroCaso =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'DUPLICATE_REQUEST'
  | 'INVALID_TRANSITION'
  | 'SLOT_TAKEN'
  | 'INCOMPATIBLE_SLOT'
  | 'BOOKING_NOT_CHECKED_IN'
  | 'OPEN_BLOCKERS'
  | 'RESULT_VERSION_CONFLICT'

export class ErroDeCaso extends Error {
  constructor(
    readonly codigo: CodigoErroCaso,
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'ErroDeCaso'
  }
}

/** O renderer recebe o código no início da mensagem para poder reagir sem parsing frágil. */
export function serializarErro(erro: unknown): string {
  if (erro instanceof ErroDeCaso) return `${erro.codigo}: ${erro.message}`
  return erro instanceof Error ? erro.message : String(erro)
}

export function codigoDoErro(mensagem: string): CodigoErroCaso | null {
  const m = mensagem.match(
    /(VALIDATION_ERROR|NOT_FOUND|VERSION_CONFLICT|DUPLICATE_REQUEST|INVALID_TRANSITION|SLOT_TAKEN|INCOMPATIBLE_SLOT)/,
  )
  return (m?.[1] as CodigoErroCaso) ?? null
}
