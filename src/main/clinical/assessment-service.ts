import { randomUUID } from 'node:crypto'
import { execute, queryAll, queryOne, transaction } from '../db/query'
import { ator, garantirContaSintetica } from '../auth/session'
import { registrarEvento } from './case-service'
import {
  ErroDeCaso,
  type ActorSnapshot,
  type CaseStatus,
} from '../../shared/clinical/caso'
import {
  IMPACTO_BLOQUEADOR,
  PENDENCIA_VIVA,
  rascunhoVazio,
  type AvaliacaoCompletaV1,
  type AvaliacaoRascunhoV1,
  type CompletionReason,
  type EncounterDTO,
  type EncounterStatus,
  type EvidenciaPendencia,
  type PedidoPendencia,
  type PendencyDTO,
  type PendencyImpact,
  type PendencyKind,
  type PendencyStatus,
} from '../../shared/clinical/avaliacao'

/**
 * Encontro de avaliação e suas pendências.
 *
 * O encontro é o episódio que o anestesiologista conduz — não é a vaga, não é o
 * resultado. Consumir o horário não conclui a avaliação, e por isso o booking
 * vira `COMPLETED` no início do encontro enquanto o caso segue em `IN_ASSESSMENT`.
 *
 * Pendência aqui não é sinônimo de bloqueio. O impacto é uma decisão declarada
 * de quem abriu, e só `BLOCKS_CURRENT_RESULT` impede emitir a versão atual. Do
 * mesmo modo, entregar a resposta não fecha nada: quem decide se aquilo bastou
 * é o anestesiologista, num segundo ato com autoria e motivo próprios.
 */

/* ══════════════ leitura ══════════════ */

type LinhaEncontro = {
  id: string
  case_id: string
  booking_id: string
  sequence: number
  encounter_type: 'INITIAL' | 'RETURN'
  status: EncounterStatus
  review_cycle: number
  completion_reason: CompletionReason | null
  responsible_actor_snapshot: ActorSnapshot
  assessment_content: AvaliacaoRascunhoV1 | AvaliacaoCompletaV1
  version: number
  started_at: string
  completed_at: string | null
}

/**
 * O predicado de "dá para retomar", em SQL, escrito uma vez.
 *
 * A tela e o comando leem a mesma expressão. Duplicá-la seria criar duas
 * verdades sobre o mesmo botão — e a que aparece é sempre a mais otimista.
 */
const SQL_BLOQUEIOS_VIVOS = `
  SELECT COUNT(*)::int AS total
    FROM case_pendencies p
   WHERE p.encounter_id = $1
     AND p.review_cycle = $2
     AND p.impact = '${IMPACTO_BLOQUEADOR}'
     AND p.status IN (${PENDENCIA_VIVA.map((s) => `'${s}'`).join(', ')})
`

async function bloqueiosVivos(encounterId: string, ciclo: number): Promise<number> {
  const linha = await queryOne<{ total: number }>(SQL_BLOQUEIOS_VIVOS, encounterId, ciclo)
  return linha?.total ?? 0
}

async function doEncontro(l: LinhaEncontro): Promise<EncounterDTO> {
  const caso = await queryOne<{ status: CaseStatus }>(
    `SELECT status FROM preop_cases WHERE id = $1`,
    l.case_id,
  )
  const bloqueios = await bloqueiosVivos(l.id, l.review_cycle)
  return {
    id: l.id,
    caseId: l.case_id,
    bookingId: l.booking_id,
    sequence: l.sequence,
    encounterType: l.encounter_type,
    status: l.status,
    reviewCycle: l.review_cycle,
    completionReason: l.completion_reason,
    responsibleActor: l.responsible_actor_snapshot,
    assessment: l.assessment_content,
    version: l.version,
    startedAt: l.started_at,
    completedAt: l.completed_at,
    canResumeReview:
      l.status === 'WAITING_PENDING' && caso?.status === 'PENDING' && bloqueios === 0,
  }
}

export async function obterEncontro(caseId: string): Promise<EncounterDTO | null> {
  const linha = await queryOne<LinhaEncontro>(
    `SELECT * FROM anesthesia_encounters WHERE case_id = $1 ORDER BY sequence DESC LIMIT 1`,
    caseId,
  )
  return linha ? doEncontro(linha) : null
}

/* ══════════════ iniciar ══════════════ */

/**
 * Abre o encontro a partir de uma consulta com chegada registrada.
 *
 * A vaga é consumida aqui: o booking vira `COMPLETED` porque aquele horário foi
 * usado. O caso, não — ele entra em `IN_ASSESSMENT`, que é onde vai ficar até
 * alguém emitir resultado ou interromper. Essa separação é o contrato inteiro
 * em duas linhas de UPDATE.
 */
export async function iniciarEncontro(entrada: {
  caseId: string
  bookingId: string
  expectedCaseVersion: number
  idempotencyKey: string
}): Promise<EncounterDTO> {
  await garantirContaSintetica()
  const anestesista = ator('ANESTESIOLOGISTA')

  const recibo = await queryOne<{ result_json: { encounterId: string } }>(
    `SELECT result_json FROM assessment_command_receipts WHERE idempotency_key = $1`,
    entrada.idempotencyKey,
  )
  if (recibo) {
    const existente = await queryOne<LinhaEncontro>(
      `SELECT * FROM anesthesia_encounters WHERE id = $1`,
      recibo.result_json.encounterId,
    )
    if (existente) return doEncontro(existente)
  }

  const encounterId = randomUUID()

  await transaction(async () => {
    const caso = await queryOne<{ status: CaseStatus; version: number }>(
      `SELECT status, version FROM preop_cases WHERE id = $1 FOR UPDATE`,
      entrada.caseId,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')
    if (caso.version !== entrada.expectedCaseVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'O caso mudou enquanto a tela estava aberta.')
    }
    if (caso.status !== 'WAITING_ANESTHESIA') {
      throw new ErroDeCaso(
        'INVALID_TRANSITION',
        'A avaliação só começa depois que a chegada é registrada.',
      )
    }

    const booking = await queryOne<{ id: string; case_id: string; status: string; kind: string }>(
      `SELECT id, case_id, status, kind FROM scheduling_bookings WHERE id = $1 FOR UPDATE`,
      entrada.bookingId,
    )
    if (!booking || booking.case_id !== entrada.caseId) {
      throw new ErroDeCaso('NOT_FOUND', 'Consulta não encontrada para este caso.')
    }
    if (booking.status !== 'CHECKED_IN') {
      throw new ErroDeCaso('BOOKING_NOT_CHECKED_IN', 'Esta consulta ainda não teve chegada registrada.')
    }

    const anterior = await queryOne<{ maior: number }>(
      `SELECT COALESCE(MAX(sequence), 0) AS maior FROM anesthesia_encounters WHERE case_id = $1`,
      entrada.caseId,
    )

    await execute(
      `INSERT INTO anesthesia_encounters (
         id, case_id, booking_id, sequence, encounter_type, status, review_cycle,
         responsible_actor_id, responsible_actor_snapshot, assessment_content, started_at
       ) VALUES ($1,$2,$3,$4,$5,'IN_PROGRESS',1,$6,$7::jsonb,$8::jsonb,NOW())`,
      encounterId,
      entrada.caseId,
      entrada.bookingId,
      (anterior?.maior ?? 0) + 1,
      booking.kind === 'RETURN' ? 'RETURN' : 'INITIAL',
      anestesista.actorId,
      JSON.stringify(anestesista),
      JSON.stringify(rascunhoVazio()),
    )

    // A vaga foi usada. A ocupação da sala continua até o fim do horário — o
    // que terminou é o compromisso da agenda, não o atendimento.
    await execute(
      `UPDATE scheduling_bookings
          SET status = 'COMPLETED', version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      entrada.bookingId,
    )

    await execute(
      `UPDATE preop_cases SET status = 'IN_ASSESSMENT', version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      entrada.caseId,
    )

    await execute(
      `INSERT INTO assessment_command_receipts (idempotency_key, command, case_id, input_fingerprint, result_json)
       VALUES ($1,'START_ENCOUNTER',$2,$3,$4::jsonb)`,
      entrada.idempotencyKey,
      entrada.caseId,
      `${entrada.bookingId}`,
      JSON.stringify({ encounterId }),
    )

    await registrarEvento({
      caseId: entrada.caseId,
      eventType: 'ENCOUNTER_STARTED',
      fromStatus: 'WAITING_ANESTHESIA',
      toStatus: 'IN_ASSESSMENT',
      actor: anestesista,
      payload: { encounterId, bookingId: entrada.bookingId },
      receiptDomain: 'ASSESSMENT',
      receiptId: entrada.idempotencyKey,
      commandEventIndex: 1,
    })
  })

  const criado = await queryOne<LinhaEncontro>(
    `SELECT * FROM anesthesia_encounters WHERE id = $1`,
    encounterId,
  )
  return doEncontro(criado!)
}

/* ══════════════ rascunho da avaliação ══════════════ */

function exigirTexto(valor: string, campo: string, min: number, max: number): string {
  const limpo = valor?.trim() ?? ''
  if (limpo.length < min || limpo.length > max) {
    throw new ErroDeCaso(
      'VALIDATION_ERROR',
      `${campo} precisa ter entre ${min} e ${max} caracteres.`,
    )
  }
  return limpo
}

/** Recusa payload que não é o rascunho que esta versão do produto conhece. */
function validarRascunho(dados: unknown): AvaliacaoRascunhoV1 {
  const d = dados as AvaliacaoRascunhoV1
  if (!d || d._v !== 1 || d.state !== 'DRAFT') {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Conteúdo de avaliação em formato desconhecido.')
  }
  for (const bloco of [d.entrevista, d.exame]) {
    for (const narrativa of Object.values(bloco)) {
      if (narrativa.estado === 'ANSWERED') {
        exigirTexto(narrativa.texto ?? '', 'Cada campo escrito da avaliação', 1, 4000)
      } else if (narrativa.texto !== null) {
        throw new ErroDeCaso('VALIDATION_ERROR', 'Campo sem resposta não pode carregar texto.')
      }
    }
  }
  if (d.sintese.limitacoes.length > 20) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'A avaliação aceita até 20 limitações.')
  }
  if (d.documentosRevisados.length > 50) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'A avaliação aceita até 50 documentos revisados.')
  }
  return d
}

export async function salvarAvaliacao(entrada: {
  encounterId: string
  expectedVersion: number
  assessment: AvaliacaoRascunhoV1
}): Promise<EncounterDTO> {
  const rascunho = validarRascunho(entrada.assessment)

  const linha = await queryOne<LinhaEncontro>(
    `SELECT * FROM anesthesia_encounters WHERE id = $1`,
    entrada.encounterId,
  )
  if (!linha) throw new ErroDeCaso('NOT_FOUND', 'Encontro não encontrado.')
  if (linha.status === 'COMPLETED') {
    throw new ErroDeCaso('INVALID_TRANSITION', 'Este encontro já foi concluído.')
  }
  if (linha.version !== entrada.expectedVersion) {
    throw new ErroDeCaso('VERSION_CONFLICT', 'A avaliação mudou em outra janela.')
  }

  await execute(
    `UPDATE anesthesia_encounters
        SET assessment_content = $2::jsonb, version = version + 1, updated_at = NOW()
      WHERE id = $1`,
    entrada.encounterId,
    JSON.stringify(rascunho),
  )

  const atualizado = await queryOne<LinhaEncontro>(
    `SELECT * FROM anesthesia_encounters WHERE id = $1`,
    entrada.encounterId,
  )
  return doEncontro(atualizado!)
}

/**
 * Encerra um encontro que começou e não vai terminar em resultado.
 *
 * O episódio fica na história com o motivo. Apagá-lo seria mais limpo na tela e
 * mentiroso no prontuário: a pessoa esteve ali.
 */
export async function interromperEncontro(entrada: {
  encounterId: string
  expectedVersion: number
  motivo: string
}): Promise<EncounterDTO> {
  await garantirContaSintetica()
  const anestesista = ator('ANESTESIOLOGISTA')
  const motivo = exigirTexto(entrada.motivo, 'O motivo da interrupção', 10, 500)

  await transaction(async () => {
    const linha = await queryOne<LinhaEncontro>(
      `SELECT * FROM anesthesia_encounters WHERE id = $1 FOR UPDATE`,
      entrada.encounterId,
    )
    if (!linha) throw new ErroDeCaso('NOT_FOUND', 'Encontro não encontrado.')
    if (linha.status === 'COMPLETED') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Este encontro já foi concluído.')
    }
    if (linha.version !== entrada.expectedVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'A avaliação mudou em outra janela.')
    }

    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      linha.case_id,
    )

    await execute(
      `UPDATE anesthesia_encounters
          SET status = 'COMPLETED', completion_reason = 'INTERRUPTED', completed_at = NOW(),
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      entrada.encounterId,
    )

    // Sem resultado, o caso volta a esperar consulta: a avaliação precisa
    // acontecer de novo, e alguém vai ter que marcar outro horário.
    await execute(
      `UPDATE preop_cases SET status = 'READY_FOR_SCHEDULING', version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      linha.case_id,
    )

    await registrarEvento({
      caseId: linha.case_id,
      eventType: 'ENCOUNTER_INTERRUPTED',
      fromStatus: caso?.status ?? 'IN_ASSESSMENT',
      toStatus: 'READY_FOR_SCHEDULING',
      actor: anestesista,
      reason: motivo,
      payload: { encounterId: entrada.encounterId },
      receiptDomain: 'ASSESSMENT',
      receiptId: `${entrada.encounterId}:interrupt`,
      commandEventIndex: 1,
    })
  })

  const atualizado = await queryOne<LinhaEncontro>(
    `SELECT * FROM anesthesia_encounters WHERE id = $1`,
    entrada.encounterId,
  )
  return doEncontro(atualizado!)
}

/* ══════════════ pendências ══════════════ */

type LinhaPendencia = {
  id: string
  case_id: string
  encounter_id: string
  review_cycle: number
  kind: PendencyKind
  owner_role: PendencyDTO['ownerRole']
  target_service_id: string | null
  impact: PendencyImpact
  status: PendencyStatus
  description: string
  requested_payload: PedidoPendencia
  evidence_payload: EvidenciaPendencia | null
  due_at: string | null
  due_at_basis: string | null
  opened_by_snapshot: ActorSnapshot
  opened_at: string
  evidence_submitted_by_snapshot: ActorSnapshot | null
  evidence_submitted_at: string | null
  reviewed_by_snapshot: ActorSnapshot | null
  reviewed_at: string | null
  review_reason: string | null
  cancelled_by_snapshot: ActorSnapshot | null
  cancelled_at: string | null
  cancellation_reason: string | null
  version: number
}

function daPendencia(l: LinhaPendencia): PendencyDTO {
  return {
    id: l.id,
    caseId: l.case_id,
    encounterId: l.encounter_id,
    reviewCycle: l.review_cycle,
    kind: l.kind,
    ownerRole: l.owner_role,
    targetServiceId: l.target_service_id,
    impact: l.impact,
    status: l.status,
    description: l.description,
    requested: l.requested_payload,
    evidence: l.evidence_payload,
    dueAt: l.due_at,
    dueAtBasis: l.due_at_basis,
    openedBy: l.opened_by_snapshot,
    openedAt: l.opened_at,
    evidenceSubmittedBy: l.evidence_submitted_by_snapshot,
    evidenceSubmittedAt: l.evidence_submitted_at,
    reviewedBy: l.reviewed_by_snapshot,
    reviewedAt: l.reviewed_at,
    reviewReason: l.review_reason,
    cancelledBy: l.cancelled_by_snapshot,
    cancelledAt: l.cancelled_at,
    cancellationReason: l.cancellation_reason,
    version: l.version,
  }
}

export async function listarPendencias(caseId: string): Promise<PendencyDTO[]> {
  const linhas = await queryAll<LinhaPendencia>(
    `SELECT * FROM case_pendencies WHERE case_id = $1 ORDER BY opened_at`,
    caseId,
  )
  return linhas.map(daPendencia)
}

export async function abrirPendencia(entrada: {
  encounterId: string
  expectedEncounterVersion: number
  kind: PendencyKind
  ownerRole: PendencyDTO['ownerRole']
  impact: PendencyImpact
  description: string
  requested: PedidoPendencia
  dueAt?: string | null
  dueAtBasis?: string | null
}): Promise<PendencyDTO> {
  await garantirContaSintetica()
  const anestesista = ator('ANESTESIOLOGISTA')

  const descricao = exigirTexto(entrada.description, 'A descrição da pendência', 10, 500)
  const titulo = exigirTexto(entrada.requested.titulo, 'O título do pedido', 2, 200)
  const pendencyId = randomUUID()

  await transaction(async () => {
    const encontro = await queryOne<LinhaEncontro>(
      `SELECT * FROM anesthesia_encounters WHERE id = $1 FOR UPDATE`,
      entrada.encounterId,
    )
    if (!encontro) throw new ErroDeCaso('NOT_FOUND', 'Encontro não encontrado.')
    if (encontro.status === 'COMPLETED') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Este encontro já foi concluído.')
    }
    if (encontro.version !== entrada.expectedEncounterVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'A avaliação mudou em outra janela.')
    }

    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      encontro.case_id,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')

    // O serviço-alvo só existe quando o dono é o solicitante: pendência de
    // quem está dentro de casa não tem para onde ser endereçada.
    const servico =
      entrada.ownerRole === 'SOLICITANTE'
        ? await queryOne<{ requesting_service_id: string }>(
            `SELECT requesting_service_id FROM preop_cases WHERE id = $1`,
            encontro.case_id,
          )
        : null

    await execute(
      `INSERT INTO case_pendencies (
         id, case_id, encounter_id, review_cycle, kind, owner_role, target_service_id,
         impact, description, requested_payload, due_at, due_at_basis, status,
         opened_by_snapshot, opened_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,'REQUESTED',$13::jsonb,NOW())`,
      pendencyId,
      encontro.case_id,
      entrada.encounterId,
      encontro.review_cycle,
      entrada.kind,
      entrada.ownerRole,
      servico?.requesting_service_id ?? null,
      entrada.impact,
      descricao,
      JSON.stringify({ ...entrada.requested, titulo }),
      entrada.dueAt ?? null,
      entrada.dueAt ? (entrada.dueAtBasis ?? null) : null,
      JSON.stringify(anestesista),
    )

    // A primeira pendência do ciclo é que muda o estado. As seguintes entram
    // na mesma espera — abrir três pedidos não é passar por três transições.
    if (encontro.status !== 'WAITING_PENDING') {
      await execute(
        `UPDATE anesthesia_encounters
            SET status = 'WAITING_PENDING', version = version + 1, updated_at = NOW()
          WHERE id = $1`,
        entrada.encounterId,
      )
      await execute(
        `UPDATE preop_cases SET status = 'PENDING', version = version + 1, updated_at = NOW()
          WHERE id = $1`,
        encontro.case_id,
      )
    }

    await registrarEvento({
      caseId: encontro.case_id,
      eventType: 'PENDENCY_OPENED',
      fromStatus: caso.status,
      toStatus: 'PENDING',
      actor: anestesista,
      payload: {
        pendencyId,
        kind: entrada.kind,
        impact: entrada.impact,
        ownerRole: entrada.ownerRole,
      },
      receiptDomain: 'ASSESSMENT',
      receiptId: `${pendencyId}:open`,
      commandEventIndex: 1,
    })
  })

  const criada = await queryOne<LinhaPendencia>(
    `SELECT * FROM case_pendencies WHERE id = $1`,
    pendencyId,
  )
  return daPendencia(criada!)
}

function validarEvidencia(e: EvidenciaPendencia): EvidenciaPendencia {
  if (e?._v !== 1) throw new ErroDeCaso('VALIDATION_ERROR', 'Evidência em formato desconhecido.')
  if (e.desfecho === 'RECEIVED') {
    return {
      _v: 1,
      desfecho: 'RECEIVED',
      texto: exigirTexto(e.texto, 'A resposta entregue', 1, 2000),
      observadoEm: e.observadoEm ?? null,
      nota: e.nota?.trim() || null,
    }
  }
  // "Não foi possível" é resposta, não silêncio — e por isso exige explicação.
  return {
    _v: 1,
    desfecho: 'UNAVAILABLE',
    texto: null,
    observadoEm: null,
    nota: exigirTexto(e.nota, 'A explicação de por que não foi possível', 10, 1000),
  }
}

/**
 * Entrega a resposta de uma pendência.
 *
 * Não resolve, não retoma a avaliação e não emite resultado. A separação entre
 * entregar e aceitar existe porque um documento ilegível também chega.
 */
export async function submeterEvidencia(entrada: {
  pendencyId: string
  expectedVersion: number
  evidence: EvidenciaPendencia
  papel?: PendencyDTO['ownerRole']
}): Promise<PendencyDTO> {
  await garantirContaSintetica()
  const evidencia = validarEvidencia(entrada.evidence)

  await transaction(async () => {
    const p = await queryOne<LinhaPendencia>(
      `SELECT * FROM case_pendencies WHERE id = $1 FOR UPDATE`,
      entrada.pendencyId,
    )
    if (!p) throw new ErroDeCaso('NOT_FOUND', 'Pendência não encontrada.')
    if (p.version !== entrada.expectedVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'A pendência mudou em outra janela.')
    }
    if (p.status !== 'REQUESTED' && p.status !== 'INSUFFICIENT_REOPENED') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Esta pendência não está esperando resposta.')
    }

    const quem = ator(entrada.papel ?? p.owner_role)

    await execute(
      `UPDATE case_pendencies
          SET status = 'EVIDENCE_SUBMITTED', evidence_payload = $2::jsonb,
              evidence_submitted_by_snapshot = $3::jsonb, evidence_submitted_at = NOW(),
              reviewed_by_snapshot = NULL, reviewed_at = NULL, review_reason = NULL,
              version = version + 1
        WHERE id = $1`,
      entrada.pendencyId,
      JSON.stringify(evidencia),
      JSON.stringify(quem),
    )

    await registrarEvento({
      caseId: p.case_id,
      eventType: 'PENDENCY_EVIDENCE_SUBMITTED',
      fromStatus: 'PENDING',
      toStatus: 'PENDING',
      actor: quem,
      payload: { pendencyId: p.id, desfecho: evidencia.desfecho },
      receiptDomain: 'ASSESSMENT',
      receiptId: `${p.id}:evidence:${p.version + 1}`,
      commandEventIndex: 1,
    })
  })

  const atualizada = await queryOne<LinhaPendencia>(
    `SELECT * FROM case_pendencies WHERE id = $1`,
    entrada.pendencyId,
  )
  return daPendencia(atualizada!)
}

/** Aceitar ou recusar a resposta. É o ato clínico que a entrega não é. */
export async function revisarEvidencia(entrada: {
  pendencyId: string
  expectedVersion: number
  decisao: 'ACCEPT' | 'REOPEN_AS_INSUFFICIENT'
  motivo: string
}): Promise<PendencyDTO> {
  await garantirContaSintetica()
  const anestesista = ator('ANESTESIOLOGISTA')
  const motivo = exigirTexto(entrada.motivo, 'O motivo da decisão', 10, 500)

  await transaction(async () => {
    const p = await queryOne<LinhaPendencia>(
      `SELECT * FROM case_pendencies WHERE id = $1 FOR UPDATE`,
      entrada.pendencyId,
    )
    if (!p) throw new ErroDeCaso('NOT_FOUND', 'Pendência não encontrada.')
    if (p.version !== entrada.expectedVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'A pendência mudou em outra janela.')
    }
    if (p.status !== 'EVIDENCE_SUBMITTED') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Só há o que revisar depois de uma resposta.')
    }

    const novo: PendencyStatus =
      entrada.decisao === 'ACCEPT' ? 'RESOLVED_ACCEPTED' : 'INSUFFICIENT_REOPENED'

    await execute(
      `UPDATE case_pendencies
          SET status = $2, reviewed_by_snapshot = $3::jsonb, reviewed_at = NOW(),
              review_reason = $4, version = version + 1
        WHERE id = $1`,
      entrada.pendencyId,
      novo,
      JSON.stringify(anestesista),
      motivo,
    )

    await registrarEvento({
      caseId: p.case_id,
      eventType: entrada.decisao === 'ACCEPT' ? 'PENDENCY_ACCEPTED' : 'PENDENCY_REOPENED',
      fromStatus: 'PENDING',
      toStatus: 'PENDING',
      actor: anestesista,
      reason: motivo,
      payload: { pendencyId: p.id },
      receiptDomain: 'ASSESSMENT',
      receiptId: `${p.id}:review:${p.version + 1}`,
      commandEventIndex: 1,
    })
  })

  const atualizada = await queryOne<LinhaPendencia>(
    `SELECT * FROM case_pendencies WHERE id = $1`,
    entrada.pendencyId,
  )
  return daPendencia(atualizada!)
}

/** Encerra uma pendência que perdeu sentido. O histórico continua legível. */
export async function cancelarPendencia(entrada: {
  pendencyId: string
  expectedVersion: number
  motivo: string
  substituida?: boolean
}): Promise<PendencyDTO> {
  await garantirContaSintetica()
  const anestesista = ator('ANESTESIOLOGISTA')
  const motivo = exigirTexto(entrada.motivo, 'O motivo do encerramento', 10, 500)

  await transaction(async () => {
    const p = await queryOne<LinhaPendencia>(
      `SELECT * FROM case_pendencies WHERE id = $1 FOR UPDATE`,
      entrada.pendencyId,
    )
    if (!p) throw new ErroDeCaso('NOT_FOUND', 'Pendência não encontrada.')
    if (p.version !== entrada.expectedVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'A pendência mudou em outra janela.')
    }
    if (!PENDENCIA_VIVA.includes(p.status)) {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Esta pendência já foi encerrada.')
    }

    await execute(
      `UPDATE case_pendencies
          SET status = $2, cancelled_by_snapshot = $3::jsonb, cancelled_at = NOW(),
              cancellation_reason = $4, version = version + 1
        WHERE id = $1`,
      entrada.pendencyId,
      entrada.substituida ? 'SUPERSEDED' : 'CANCELLED',
      JSON.stringify(anestesista),
      motivo,
    )

    await registrarEvento({
      caseId: p.case_id,
      eventType: 'PENDENCY_CANCELLED',
      fromStatus: 'PENDING',
      toStatus: 'PENDING',
      actor: anestesista,
      reason: motivo,
      payload: { pendencyId: p.id, substituida: Boolean(entrada.substituida) },
      receiptDomain: 'ASSESSMENT',
      receiptId: `${p.id}:cancel`,
      commandEventIndex: 1,
    })
  })

  const atualizada = await queryOne<LinhaPendencia>(
    `SELECT * FROM case_pendencies WHERE id = $1`,
    entrada.pendencyId,
  )
  return daPendencia(atualizada!)
}

/**
 * Volta a avaliar depois que os bloqueios saíram do caminho.
 *
 * A condição é exatamente a que a tela usou para mostrar o botão — mesma
 * expressão, mesmo ciclo. Retomar abre um novo ciclo de revisão: o que for
 * pedido daqui para frente pertence a esta rodada, não à anterior.
 */
export async function retomarRevisao(entrada: {
  encounterId: string
  expectedVersion: number
}): Promise<EncounterDTO> {
  await garantirContaSintetica()
  const anestesista = ator('ANESTESIOLOGISTA')

  await transaction(async () => {
    const encontro = await queryOne<LinhaEncontro>(
      `SELECT * FROM anesthesia_encounters WHERE id = $1 FOR UPDATE`,
      entrada.encounterId,
    )
    if (!encontro) throw new ErroDeCaso('NOT_FOUND', 'Encontro não encontrado.')
    if (encontro.version !== entrada.expectedVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'A avaliação mudou em outra janela.')
    }
    if (encontro.status !== 'WAITING_PENDING') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Este encontro não está esperando pendência.')
    }

    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      encontro.case_id,
    )
    if (caso?.status !== 'PENDING') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'O caso não está com pendência aberta.')
    }

    const bloqueios = await bloqueiosVivos(encontro.id, encontro.review_cycle)
    if (bloqueios > 0) {
      throw new ErroDeCaso(
        'OPEN_BLOCKERS',
        `Ainda há ${bloqueios} pendência(s) que impedem seguir com a avaliação.`,
      )
    }

    await execute(
      `UPDATE anesthesia_encounters
          SET status = 'IN_PROGRESS', review_cycle = review_cycle + 1,
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      entrada.encounterId,
    )

    await execute(
      `UPDATE preop_cases SET status = 'IN_ASSESSMENT', version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      encontro.case_id,
    )

    await registrarEvento({
      caseId: encontro.case_id,
      eventType: 'REVIEW_RESUMED',
      fromStatus: 'PENDING',
      toStatus: 'IN_ASSESSMENT',
      actor: anestesista,
      payload: { encounterId: encontro.id, reviewCycle: encontro.review_cycle + 1 },
      receiptDomain: 'ASSESSMENT',
      receiptId: `${encontro.id}:resume:${encontro.review_cycle + 1}`,
      commandEventIndex: 1,
    })
  })

  const atualizado = await queryOne<LinhaEncontro>(
    `SELECT * FROM anesthesia_encounters WHERE id = $1`,
    entrada.encounterId,
  )
  return doEncontro(atualizado!)
}

/** Quantos bloqueios vivos o encontro corrente tem. Usado pela conclusão. */
export async function contarBloqueios(encounterId: string, ciclo: number): Promise<number> {
  return bloqueiosVivos(encounterId, ciclo)
}
