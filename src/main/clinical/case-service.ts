import { randomUUID, createHash } from 'node:crypto'
import { execute, queryAll, queryOne, transaction } from '../db/query'
import { ator, garantirContaSintetica, CONTA_SINTETICA } from '../auth/session'
import {
  ErroDeCaso,
  type ActorSnapshot,
  type CaseDetailDTO,
  type CaseEventDTO,
  type CaseEventType,
  type CaseHandoffDTO,
  type CaseStatus,
  type CaseSummaryDTO,
  type CreateCaseInput,
  type Papel,
  type PersonSnapshot,
  type ProcedureSnapshot,
  type ReferralSnapshot,
  type RequesterSnapshot,
  type SlotClass,
} from '../../shared/clinical/caso'

/**
 * Serviço do caso pré-anestésico.
 *
 * Tudo que muda o caso passa por aqui, dentro de uma transação, com evento
 * gravado no mesmo commit. Nunca existe timeline parcial: ou o caso avançou e a
 * história registra, ou nada aconteceu.
 *
 * A pessoa é snapshot. Não há busca de paciente, não há "já existe", não há
 * mescla. Dois papéis da mesma pessoa produzem dois casos — e a única coisa que
 * o sistema faz a respeito é avisar quando a referência do papel se repete no
 * mesmo serviço, sem bloquear nada.
 */

/* ══════════════ responsabilidade ══════════════ */

/**
 * Quem age agora e quem age em seguida.
 *
 * Derivado do estado, nunca persistido: coluna de dono é a maneira mais rápida
 * de ter duas verdades sobre o mesmo caso.
 */
const RESPONSABILIDADE: Record<CaseStatus, { currentRoles: Papel[]; nextRoles: Papel[] }> = {
  RECEIVED_AT_RECEPTION: { currentRoles: ['RECEPCAO'], nextRoles: ['ENFERMAGEM'] },
  WAITING_NURSING: { currentRoles: ['ENFERMAGEM'], nextRoles: ['ENFERMAGEM'] },
  NURSING_IN_PROGRESS: { currentRoles: ['ENFERMAGEM'], nextRoles: ['RECEPCAO'] },
  TRIAGE_PENDING: { currentRoles: ['ENFERMAGEM'], nextRoles: ['ENFERMAGEM'] },
  READY_FOR_SCHEDULING: { currentRoles: ['RECEPCAO'], nextRoles: ['RECEPCAO'] },
  SCHEDULED: { currentRoles: ['RECEPCAO'], nextRoles: ['ANESTESIOLOGISTA'] },
  WAITING_ANESTHESIA: { currentRoles: ['ANESTESIOLOGISTA'], nextRoles: ['ANESTESIOLOGISTA'] },
  IN_ASSESSMENT: { currentRoles: ['ANESTESIOLOGISTA'], nextRoles: ['ANESTESIOLOGISTA'] },
  PENDING: { currentRoles: ['ENFERMAGEM'], nextRoles: ['ANESTESIOLOGISTA'] },
  WAITING_RETURN: { currentRoles: ['RECEPCAO'], nextRoles: ['ANESTESIOLOGISTA'] },
  READY_FOR_HANDOFF: { currentRoles: ['RECEPCAO'], nextRoles: ['SOLICITANTE'] },
  DELIVERED_TO_REQUESTER: { currentRoles: [], nextRoles: [] },
  CANCELLED: { currentRoles: [], nextRoles: [] },
}

/* ══════════════ utilidades ══════════════ */

function agora(): string {
  return new Date().toISOString()
}

function impressao(valor: unknown): string {
  return createHash('sha256').update(JSON.stringify(valor)).digest('hex')
}

function normalizarReferencia(valor: string | null): string | null {
  if (valor === null) return null
  const limpo = valor.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase()
  return limpo.length > 0 ? limpo : null
}

function idadeEm(nascimento: string | null, referencia: string, informada?: number): number {
  if (!nascimento) {
    if (informada === undefined || informada < 0 || informada > 130) {
      throw new ErroDeCaso('VALIDATION_ERROR', 'Sem data de nascimento, informe a idade.')
    }
    return informada
  }
  const n = new Date(nascimento)
  const r = new Date(referencia)
  if (Number.isNaN(n.getTime())) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Data de nascimento inválida.')
  }
  if (n.getTime() > r.getTime()) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Data de nascimento não pode ser futura.')
  }
  let idade = r.getUTCFullYear() - n.getUTCFullYear()
  const antes =
    r.getUTCMonth() < n.getUTCMonth() ||
    (r.getUTCMonth() === n.getUTCMonth() && r.getUTCDate() < n.getUTCDate())
  if (antes) idade--
  if (idade < 0 || idade > 130) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'A idade calculada saiu da faixa aceita.')
  }
  return idade
}

function exigirTexto(valor: string, campo: string, min = 1, max = 200): string {
  const limpo = valor?.trim() ?? ''
  if (limpo.length < min || limpo.length > max) {
    throw new ErroDeCaso('VALIDATION_ERROR', `${campo} precisa ter entre ${min} e ${max} caracteres.`)
  }
  return limpo
}

/**
 * Aloca a próxima posição da história do caso.
 *
 * A sequência é global por caso e monotônica. `SELECT ... FOR UPDATE` na linha do
 * caso serializa comandos concorrentes — dois eventos nunca disputam a mesma
 * posição.
 */
async function proximaSequencia(caseId: string): Promise<number> {
  const linha = await queryOne<{ proxima: number }>(
    `SELECT COALESCE(MAX(event_sequence), 0) + 1 AS proxima FROM case_events WHERE case_id = $1`,
    caseId,
  )
  return linha?.proxima ?? 1
}

export type EntradaEvento = {
  caseId: string
  eventType: CaseEventType
  fromStatus: CaseStatus | null
  toStatus: CaseStatus
  actor: ActorSnapshot
  reason?: string | null
  payload?: Record<string, unknown>
  receiptDomain: 'CASE' | 'ANAMNESIS' | 'SCHEDULING' | 'ASSESSMENT'
  receiptId: string
  commandEventIndex: number
  correlationId?: string
}

/** Grava um evento. Só faz sentido dentro de uma transação de comando. */
export async function registrarEvento(e: EntradaEvento): Promise<number> {
  const sequencia = await proximaSequencia(e.caseId)
  await execute(
    `INSERT INTO case_events (
       case_id, event_type, from_status, to_status, actor_snapshot, reason, payload,
       occurred_at, correlation_id, command_id, receipt_domain, receipt_id,
       command_event_index, event_sequence
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)`,
    e.caseId,
    e.eventType,
    e.fromStatus,
    e.toStatus,
    JSON.stringify(e.actor),
    e.reason ?? null,
    JSON.stringify(e.payload ?? {}),
    agora(),
    e.correlationId ?? e.receiptId,
    e.receiptId,
    e.receiptDomain,
    e.receiptId,
    e.commandEventIndex,
    sequencia,
  )
  return sequencia
}

/* ══════════════ criação ══════════════ */

type LinhaCaso = {
  id: string
  display_code: string
  requesting_service_id: string
  person_snapshot: PersonSnapshot
  referral_snapshot: ReferralSnapshot
  procedure_snapshot: ProcedureSnapshot
  requester_snapshot: RequesterSnapshot
  status: CaseStatus
  version: number
  opened_at: string
  updated_at: string
}

function resumoDaLinha(
  l: LinhaCaso,
  extras: {
    booking?: CaseSummaryDTO['booking']
    requirement?: CaseSummaryDTO['requirement']
  } = {},
): CaseSummaryDTO {
  return {
    id: l.id,
    displayCode: l.display_code,
    personName: l.person_snapshot.fullName,
    personAge: l.person_snapshot.ageYearsAtOpening,
    procedureDescription: l.procedure_snapshot.description,
    requesterLabel: l.requester_snapshot.physicianName,
    serviceName: l.requester_snapshot.serviceName,
    status: l.status,
    responsibility: RESPONSABILIDADE[l.status],
    version: l.version,
    openedAt: l.opened_at,
    updatedAt: l.updated_at,
    booking: extras.booking ?? null,
    requirement: extras.requirement ?? null,
  }
}

export async function criarCaso(input: CreateCaseInput): Promise<CaseDetailDTO> {
  await garantirContaSintetica()

  const recebidoEm = agora()
  const nome = exigirTexto(input.person.fullName, 'Nome', 3, 120)
  const procedimento = exigirTexto(input.procedure.description, 'Procedimento', 3, 200)
  const medico = exigirTexto(input.requester.physicianName, 'Médico solicitante', 3, 120)
  const idade = idadeEm(input.person.birthDate, recebidoEm, input.person.ageYearsAtOpening)

  const servico = await queryOne<{ id: string; nome: string; revisao: string }>(
    `SELECT id, nome, revisao FROM catalogo_servicos_solicitantes WHERE id = $1 AND ativo`,
    input.requester.serviceId,
  )
  if (!servico) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Serviço solicitante não existe no catálogo.')
  }

  const fingerprint = impressao({ nome, procedimento, medico, servico: servico.id, idade })

  // Replay idempotente: mesma chave e mesmo conteúdo devolve o caso de antes.
  const recibo = await queryOne<{ case_id: string; action: string; input_fingerprint: string }>(
    `SELECT case_id, action, input_fingerprint FROM case_command_receipts WHERE idempotency_key = $1`,
    input.idempotencyKey,
  )
  if (recibo) {
    if (recibo.action !== 'CREATE' || recibo.input_fingerprint !== fingerprint) {
      throw new ErroDeCaso('DUPLICATE_REQUEST', 'A mesma chave já foi usada com outro conteúdo.')
    }
    return obterCaso(recibo.case_id)
  }

  const caseId = randomUUID()
  const referralId = randomUUID()
  const atorRecepcao = ator('RECEPCAO')

  await transaction(async () => {
    const seq = await queryOne<{ n: number }>(
      `SELECT nextval('preop_case_display_code_seq')::int AS n`,
    )
    const ano = new Date(recebidoEm).getFullYear()
    const displayCode = `ANT-${ano}-${String(seq?.n ?? 1).padStart(4, '0')}`

    const person: PersonSnapshot = {
      _v: 1,
      fullName: nome,
      birthDate: input.person.birthDate,
      ageYearsAtOpening: idade,
      sexReported: input.person.sexReported,
    }
    const referral: ReferralSnapshot = {
      _v: 1,
      referralId,
      sourceReference: input.referral.sourceReference?.trim() || null,
      receivedAt: recebidoEm,
      freeTextReference: input.referral.freeTextReference?.trim() ?? '',
    }
    const procedure: ProcedureSnapshot = {
      _v: 1,
      description: procedimento,
      lateralityOrSite: input.procedure.lateralityOrSite?.trim() || null,
      notes: input.procedure.notes?.trim() || null,
    }
    const requester: RequesterSnapshot = {
      _v: 1,
      serviceId: servico.id,
      serviceCatalogRevision: servico.revisao,
      serviceName: servico.nome,
      physicianName: medico,
    }

    await execute(
      `INSERT INTO preop_cases (
         id, display_code, requesting_service_id, referral_source_reference_normalized,
         person_snapshot, referral_snapshot, procedure_snapshot, requester_snapshot,
         status, version, opened_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,'RECEIVED_AT_RECEPTION',1,$9,$9)`,
      caseId,
      displayCode,
      servico.id,
      normalizarReferencia(referral.sourceReference),
      JSON.stringify(person),
      JSON.stringify(referral),
      JSON.stringify(procedure),
      JSON.stringify(requester),
      recebidoEm,
    )

    await execute(
      `INSERT INTO case_command_receipts (idempotency_key, action, actor_id, case_id, input_fingerprint, result_json)
       VALUES ($1,'CREATE',$2,$3,$4,$5::jsonb)`,
      input.idempotencyKey,
      CONTA_SINTETICA.id,
      caseId,
      fingerprint,
      JSON.stringify({ caseId, displayCode, resultingCaseVersion: 2 }),
    )

    await registrarEvento({
      caseId,
      eventType: 'CASE_OPENED',
      fromStatus: null,
      toStatus: 'RECEIVED_AT_RECEPTION',
      actor: atorRecepcao,
      payload: { referralId, displayCode },
      receiptDomain: 'CASE',
      receiptId: input.idempotencyKey,
      commandEventIndex: 1,
    })

    const handoffId = randomUUID()
    await execute(
      `INSERT INTO case_handoffs (
         id, case_id, from_role, to_role, handoff_type, payload_snapshot, status, sent_by, sent_at
       ) VALUES ($1,$2,'RECEPCAO','ENFERMAGEM','ABERTURA_DE_CASO',$3::jsonb,'SENT',$4::jsonb,$5)`,
      handoffId,
      caseId,
      JSON.stringify({
        _v: 1,
        caseId,
        displayCode,
        procedureDescription: procedimento,
        requestingServiceId: servico.id,
      }),
      JSON.stringify(atorRecepcao),
      recebidoEm,
    )

    await execute(
      `UPDATE preop_cases SET status = 'WAITING_NURSING', version = 2, updated_at = $2 WHERE id = $1`,
      caseId,
      agora(),
    )

    await registrarEvento({
      caseId,
      eventType: 'HANDOFF_SENT',
      fromStatus: 'RECEIVED_AT_RECEPTION',
      toStatus: 'WAITING_NURSING',
      actor: atorRecepcao,
      payload: { handoffId, toRole: 'ENFERMAGEM' },
      receiptDomain: 'CASE',
      receiptId: input.idempotencyKey,
      commandEventIndex: 2,
    })
  })

  return obterCaso(caseId)
}

/* ══════════════ leitura ══════════════ */

type FiltroCasos = {
  status?: CaseStatus[]
  busca?: string
  limite?: number
}

export async function listarCasos(filtro: FiltroCasos = {}): Promise<CaseSummaryDTO[]> {
  const condicoes: string[] = []
  const params: unknown[] = []

  if (filtro.status?.length) {
    params.push(JSON.stringify(filtro.status))
    condicoes.push(
      `c.status = ANY (SELECT jsonb_array_elements_text($${params.length}::jsonb))`,
    )
  }
  if (filtro.busca?.trim()) {
    params.push(`%${filtro.busca.trim().toLowerCase()}%`)
    const i = params.length
    condicoes.push(
      `(lower(c.display_code) LIKE $${i}
        OR lower(c.person_snapshot ->> 'fullName') LIKE $${i}
        OR lower(c.procedure_snapshot ->> 'description') LIKE $${i}
        OR lower(c.requester_snapshot ->> 'serviceName') LIKE $${i})`,
    )
  }

  params.push(filtro.limite ?? 200)

  const linhas = await queryAll<
    LinhaCaso & {
      booking_id: string | null
      booking_starts_at: string | null
      booking_ends_at: string | null
      booking_slot_class: SlotClass | null
      booking_status: string | null
      booking_version: number | null
      requirement_id: string | null
      requirement_slot_class: SlotClass | null
      requirement_duration: number | null
    }
  >(
    `SELECT c.*,
            b.id AS booking_id, b.starts_at AS booking_starts_at, b.ends_at AS booking_ends_at,
            b.slot_class AS booking_slot_class, b.status AS booking_status,
            b.version AS booking_version,
            r.id AS requirement_id, r.slot_class AS requirement_slot_class,
            r.duration_minutes AS requirement_duration
       FROM preop_cases c
       LEFT JOIN LATERAL (
         SELECT * FROM scheduling_bookings
          WHERE case_id = c.id AND status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
          ORDER BY created_at DESC LIMIT 1
       ) b ON TRUE
       LEFT JOIN LATERAL (
         SELECT * FROM scheduling_requirements
          WHERE case_id = c.id
          ORDER BY created_at DESC LIMIT 1
       ) r ON TRUE
      ${condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''}
      ORDER BY c.updated_at DESC
      LIMIT $${params.length}`,
    ...params,
  )

  return linhas.map((l) =>
    resumoDaLinha(l, {
      booking: l.booking_id
        ? {
            id: l.booking_id,
            startsAt: l.booking_starts_at!,
            endsAt: l.booking_ends_at!,
            slotClass: l.booking_slot_class!,
            status: l.booking_status!,
            version: l.booking_version!,
          }
        : null,
      requirement: l.requirement_id
        ? {
            id: l.requirement_id,
            slotClass: l.requirement_slot_class!,
            durationMinutes: l.requirement_duration!,
          }
        : null,
    }),
  )
}

export async function obterCaso(caseId: string): Promise<CaseDetailDTO> {
  const linha = await queryOne<LinhaCaso>(`SELECT * FROM preop_cases WHERE id = $1`, caseId)
  if (!linha) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')

  const eventos = await queryAll<{
    id: number
    case_id: string
    event_type: CaseEventType
    from_status: CaseStatus | null
    to_status: CaseStatus
    actor_snapshot: ActorSnapshot
    reason: string | null
    payload: Record<string, unknown>
    occurred_at: string
    event_sequence: number
    receipt_domain: string
    receipt_id: string
  }>(`SELECT * FROM case_events WHERE case_id = $1 ORDER BY event_sequence`, caseId)

  const handoff = await queryOne<{
    id: string
    case_id: string
    from_role: Papel
    to_role: Papel
    handoff_type: string
    status: 'SENT' | 'RECEIVED' | 'CANCELLED'
    sent_by: ActorSnapshot
    sent_at: string
    received_by: ActorSnapshot | null
    received_at: string | null
    version: number
  }>(
    `SELECT * FROM case_handoffs WHERE case_id = $1 AND status = 'SENT' ORDER BY sent_at DESC LIMIT 1`,
    caseId,
  )

  const anamnese = await queryOne<{ id: string; status: 'DRAFT' | 'FINAL'; revision: number }>(
    `SELECT id, status, revision FROM clinical_anamneses WHERE case_id = $1`,
    caseId,
  )

  const booking = await queryOne<{
    id: string
    starts_at: string
    ends_at: string
    slot_class: SlotClass
    status: string
    version: number
  }>(
    `SELECT id, starts_at, ends_at, slot_class, status, version FROM scheduling_bookings
      WHERE case_id = $1 AND status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
      ORDER BY created_at DESC LIMIT 1`,
    caseId,
  )

  const requisito = await queryOne<{ id: string; slot_class: SlotClass; duration_minutes: number }>(
    `SELECT id, slot_class, duration_minutes FROM scheduling_requirements
      WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
    caseId,
  )

  const timeline: CaseEventDTO[] = eventos.map((e) => ({
    id: e.id,
    caseId: e.case_id,
    eventType: e.event_type,
    fromStatus: e.from_status,
    toStatus: e.to_status,
    actor: e.actor_snapshot,
    reason: e.reason,
    payload: e.payload,
    occurredAt: e.occurred_at,
    sequence: e.event_sequence,
    receipt: { domain: e.receipt_domain, id: e.receipt_id },
  }))

  return {
    ...resumoDaLinha(linha, {
      booking: booking
        ? {
            id: booking.id,
            startsAt: booking.starts_at,
            endsAt: booking.ends_at,
            slotClass: booking.slot_class,
            status: booking.status,
            version: booking.version,
          }
        : null,
      requirement: requisito
        ? {
            id: requisito.id,
            slotClass: requisito.slot_class,
            durationMinutes: requisito.duration_minutes,
          }
        : null,
    }),
    person: linha.person_snapshot,
    referral: linha.referral_snapshot,
    procedure: linha.procedure_snapshot,
    requester: linha.requester_snapshot,
    timeline,
    openHandoff: handoff
      ? {
          id: handoff.id,
          caseId: handoff.case_id,
          fromRole: handoff.from_role,
          toRole: handoff.to_role,
          type: handoff.handoff_type,
          status: handoff.status,
          sentBy: handoff.sent_by,
          sentAt: handoff.sent_at,
          receivedBy: handoff.received_by,
          receivedAt: handoff.received_at,
          version: handoff.version,
        }
      : null,
    anamnesis: anamnese ?? null,
  }
}

/* ══════════════ handoff ══════════════ */

export async function aceitarHandoff(entrada: {
  caseId: string
  handoffId: string
  expectedCaseVersion: number
  idempotencyKey: string
}): Promise<CaseDetailDTO> {
  await garantirContaSintetica()
  const atorEnfermagem = ator('ENFERMAGEM')

  await transaction(async () => {
    const caso = await queryOne<{ status: CaseStatus; version: number }>(
      `SELECT status, version FROM preop_cases WHERE id = $1 FOR UPDATE`,
      entrada.caseId,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')
    if (caso.version !== entrada.expectedCaseVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'O caso mudou enquanto a tela estava aberta.')
    }
    if (caso.status !== 'WAITING_NURSING') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Só um caso aguardando enfermagem pode ser assumido.')
    }

    const handoff = await queryOne<{ id: string; status: string; version: number }>(
      `SELECT id, status, version FROM case_handoffs WHERE id = $1 AND case_id = $2 FOR UPDATE`,
      entrada.handoffId,
      entrada.caseId,
    )
    if (!handoff) throw new ErroDeCaso('NOT_FOUND', 'Handoff não encontrado.')
    if (handoff.status !== 'SENT') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Este handoff já foi tratado.')
    }

    await execute(
      `UPDATE case_handoffs
          SET status = 'RECEIVED', received_by = $2::jsonb, received_at = $3, version = version + 1
        WHERE id = $1`,
      entrada.handoffId,
      JSON.stringify(atorEnfermagem),
      agora(),
    )

    await execute(
      `UPDATE preop_cases SET status = 'NURSING_IN_PROGRESS', version = version + 1, updated_at = $2
        WHERE id = $1`,
      entrada.caseId,
      agora(),
    )

    await registrarEvento({
      caseId: entrada.caseId,
      eventType: 'HANDOFF_ACKNOWLEDGED',
      fromStatus: 'WAITING_NURSING',
      toStatus: 'NURSING_IN_PROGRESS',
      actor: atorEnfermagem,
      payload: { handoffId: entrada.handoffId, byRole: 'ENFERMAGEM' },
      receiptDomain: 'CASE',
      receiptId: entrada.idempotencyKey,
      commandEventIndex: 1,
    })
  })

  return obterCaso(entrada.caseId)
}

/* ══════════════ cancelamento ══════════════ */

/**
 * Encerra um caso que não vai acontecer.
 *
 * Encaminhamento duplicado, cirurgia desmarcada lá fora, pessoa que desistiu:
 * sem isso o caso fica preso na fila para sempre, e uma fila que não esvazia
 * deixa de ser fila. O motivo é obrigatório porque é ele que explica a ausência
 * do caso depois — e o que já foi vivido continua na história.
 *
 * Um caso com resultado emitido **não** é cancelado: o que existe já foi
 * comunicado, e apagá-lo por cima seria reescrever o passado. Ali o caminho é
 * corrigir a versão.
 */
export async function cancelarCaso(entrada: {
  caseId: string
  motivo: string
  expectedCaseVersion: number
}): Promise<CaseDetailDTO> {
  await garantirContaSintetica()
  const atorRecepcao = ator('RECEPCAO')
  const motivo = exigirTexto(entrada.motivo, 'O motivo do cancelamento', 10, 500)

  await transaction(async () => {
    const caso = await queryOne<{ status: CaseStatus; version: number }>(
      `SELECT status, version FROM preop_cases WHERE id = $1 FOR UPDATE`,
      entrada.caseId,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')
    if (caso.version !== entrada.expectedCaseVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'O caso mudou enquanto a tela estava aberta.')
    }
    if (caso.status === 'CANCELLED' || caso.status === 'DELIVERED_TO_REQUESTER') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Este caso já está encerrado.')
    }
    if (caso.status === 'READY_FOR_HANDOFF') {
      throw new ErroDeCaso(
        'INVALID_TRANSITION',
        'Este caso já tem resultado emitido. Corrija a versão em vez de cancelar o caso.',
      )
    }

    // A consulta marcada cai junto: manter uma vaga presa a um caso cancelado
    // tiraria da agenda um horário que ninguém vai usar.
    const booking = await queryOne<{ id: string }>(
      `SELECT id FROM scheduling_bookings
        WHERE case_id = $1 AND status IN ('CONFIRMED','CHECKED_IN')
        ORDER BY created_at DESC LIMIT 1`,
      entrada.caseId,
    )
    if (booking) {
      await execute(
        `UPDATE scheduling_bookings
            SET status = 'CANCELLED', closed_at = NOW(), closed_reason = $2,
                version = version + 1, updated_at = NOW()
          WHERE id = $1`,
        booking.id,
        `Caso cancelado: ${motivo}`,
      )
    }

    const encontro = await queryOne<{ id: string }>(
      `SELECT id FROM anesthesia_encounters
        WHERE case_id = $1 AND status IN ('IN_PROGRESS','WAITING_PENDING')`,
      entrada.caseId,
    )
    if (encontro) {
      await execute(
        `UPDATE anesthesia_encounters
            SET status = 'COMPLETED', completion_reason = 'INTERRUPTED', completed_at = NOW(),
                version = version + 1, updated_at = NOW()
          WHERE id = $1`,
        encontro.id,
      )
    }

    await execute(
      `UPDATE preop_cases
          SET status = 'CANCELLED', closed_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      entrada.caseId,
    )

    await registrarEvento({
      caseId: entrada.caseId,
      eventType: 'CASE_CANCELLED',
      fromStatus: caso.status,
      toStatus: 'CANCELLED',
      actor: atorRecepcao,
      reason: motivo,
      payload: { bookingCancelado: booking?.id ?? null, encontroInterrompido: encontro?.id ?? null },
      receiptDomain: 'CASE',
      receiptId: `${entrada.caseId}:cancel`,
      commandEventIndex: 1,
    })
  })

  return obterCaso(entrada.caseId)
}

/* ══════════════ contagem para o painel ══════════════ */

export async function contarPorStatus(): Promise<Record<string, number>> {
  const linhas = await queryAll<{ status: CaseStatus; total: number }>(
    `SELECT status, COUNT(*)::int AS total FROM preop_cases GROUP BY status`,
  )
  return Object.fromEntries(linhas.map((l) => [l.status, l.total]))
}
