import { randomUUID } from 'node:crypto'
import { execute, queryAll, queryOne, transaction } from '../db/query'
import { ator, garantirContaSintetica } from '../auth/session'
import { registrarEvento } from '../clinical/case-service'
import {
  ErroDeCaso,
  type AgendaRangeDTO,
  type BookingDTO,
  type CaseStatus,
  type SlotClass,
  type SlotDTO,
} from '../../shared/clinical/caso'

/**
 * Agenda da consulta pré-anestésica.
 *
 * O calendário do renderer é projeção e coletor de intenção: ele desenha o que o
 * main devolve e envia "quero esta vaga". **Toda** validação — vaga livre,
 * classe compatível, requisito publicado, caso no estado certo — acontece aqui.
 * Quando o comando falha, o renderer desfaz o gesto; ele nunca decide sozinho
 * que a reserva valeu.
 *
 * Concorrência morre no índice único parcial: duas reservas ativas na mesma vaga
 * são impossíveis mesmo com dois cliques simultâneos, porque a segunda viola a
 * constraint e a transação inteira volta atrás.
 */

type LinhaBooking = {
  id: string
  case_id: string
  requirement_id: string
  slot_id: string
  resource_id: string
  kind: 'INITIAL' | 'RETURN'
  slot_class: SlotClass
  starts_at: string
  ends_at: string
  status: BookingDTO['status']
  version: number
  created_at: string
  checked_in_at: string | null
  display_code?: string
  person_name?: string
  procedure_description?: string
  resource_name?: string
}

function daLinha(l: LinhaBooking): BookingDTO {
  return {
    id: l.id,
    caseId: l.case_id,
    displayCode: l.display_code ?? '',
    personName: l.person_name ?? '',
    procedureDescription: l.procedure_description ?? '',
    requirementId: l.requirement_id,
    slotId: l.slot_id,
    resourceId: l.resource_id,
    resourceName: l.resource_name ?? '',
    kind: l.kind,
    slotClass: l.slot_class,
    startsAt: l.starts_at,
    endsAt: l.ends_at,
    status: l.status,
    version: l.version,
    createdAt: l.created_at,
    checkedInAt: l.checked_in_at,
  }
}

const SELECT_BOOKING = `
  SELECT b.*, c.display_code, c.person_snapshot ->> 'fullName' AS person_name,
         c.procedure_snapshot ->> 'description' AS procedure_description,
         r.nome AS resource_name
    FROM scheduling_bookings b
    JOIN preop_cases c ON c.id = b.case_id
    JOIN scheduling_resources r ON r.id = b.resource_id
`

/* ══════════════ leitura ══════════════ */

export async function listarIntervalo(entrada: {
  de: string
  ate: string
}): Promise<AgendaRangeDTO> {
  const recursos = await queryAll<{ id: string; nome: string; capabilities: string[] }>(
    `SELECT id, nome, capabilities FROM scheduling_resources WHERE ativo ORDER BY ordem`,
  )

  const slots = await queryAll<{
    id: string
    resource_id: string
    resource_name: string
    slot_class: SlotClass
    starts_at: string
    ends_at: string
    status: 'OPEN' | 'BLOCKED'
    block_reason: string | null
  }>(
    `SELECT s.*, r.nome AS resource_name
       FROM scheduling_slots s
       JOIN scheduling_resources r ON r.id = s.resource_id
      WHERE s.starts_at >= $1 AND s.starts_at < $2
      ORDER BY s.starts_at, r.ordem`,
    entrada.de,
    entrada.ate,
  )

  const bookings = await queryAll<LinhaBooking>(
    `${SELECT_BOOKING}
      WHERE b.starts_at >= $1 AND b.starts_at < $2
        AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED')`,
    entrada.de,
    entrada.ate,
  )
  const porSlot = new Map(bookings.map((b) => [b.slot_id, daLinha(b)]))

  const projetados: SlotDTO[] = slots.map((s) => ({
    id: s.id,
    resourceId: s.resource_id,
    resourceName: s.resource_name,
    slotClass: s.slot_class,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    status: s.status,
    blockReason: s.block_reason,
    booking: porSlot.get(s.id) ?? null,
  }))

  return {
    resources: recursos.map((r) => ({ id: r.id, name: r.nome, capabilities: r.capabilities ?? [] })),
    slots: projetados,
  }
}

/** Vagas que servem para um requisito publicado — mesma classe e ainda livres. */
export async function vagasCompativeis(entrada: {
  requirementId: string
  de?: string
  limite?: number
}): Promise<SlotDTO[]> {
  const requisito = await queryOne<{
    slot_class: SlotClass
    status: string
    required_capabilities: string[]
  }>(
    `SELECT slot_class, status, required_capabilities FROM scheduling_requirements WHERE id = $1`,
    entrada.requirementId,
  )
  if (!requisito) throw new ErroDeCaso('NOT_FOUND', 'Requisito não encontrado.')
  if (requisito.status === 'CALCULATED') {
    throw new ErroDeCaso('INVALID_TRANSITION', 'O requisito precisa ser confirmado antes de agendar.')
  }

  const linhas = await queryAll<{
    id: string
    resource_id: string
    resource_name: string
    slot_class: SlotClass
    starts_at: string
    ends_at: string
    capabilities: string[]
  }>(
    `SELECT s.id, s.resource_id, r.nome AS resource_name, s.slot_class, s.starts_at, s.ends_at,
            r.capabilities
       FROM scheduling_slots s
       JOIN scheduling_resources r ON r.id = s.resource_id AND r.ativo
      WHERE s.slot_class = $1
        AND s.status = 'OPEN'
        AND s.starts_at >= $2
        AND NOT EXISTS (
          SELECT 1 FROM scheduling_bookings b
           WHERE b.slot_id = s.id AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
        )
      ORDER BY s.starts_at
      LIMIT $3`,
    requisito.slot_class,
    entrada.de ?? new Date().toISOString(),
    entrada.limite ?? 60,
  )

  const exigidas = requisito.required_capabilities ?? []
  return linhas
    .filter((l) => exigidas.every((c) => (l.capabilities ?? []).includes(c)))
    .map((l) => ({
      id: l.id,
      resourceId: l.resource_id,
      resourceName: l.resource_name,
      slotClass: l.slot_class,
      startsAt: l.starts_at,
      endsAt: l.ends_at,
      status: 'OPEN' as const,
      blockReason: null,
      booking: null,
    }))
}

export async function obterBooking(bookingId: string): Promise<BookingDTO | null> {
  const linha = await queryOne<LinhaBooking>(`${SELECT_BOOKING} WHERE b.id = $1`, bookingId)
  return linha ? daLinha(linha) : null
}

/* ══════════════ reserva ══════════════ */

function ehViolacaoDeUnicidade(erro: unknown): boolean {
  const texto = erro instanceof Error ? erro.message : String(erro)
  return /duplicate key|unique constraint|uniq_booking/i.test(texto)
}

export async function reservar(entrada: {
  caseId: string
  requirementId: string
  slotId: string
  idempotencyKey: string
}): Promise<BookingDTO> {
  await garantirContaSintetica()
  const atorRecepcao = ator('RECEPCAO')

  const recibo = await queryOne<{ result_json: { bookingId: string } }>(
    `SELECT result_json FROM scheduling_command_receipts WHERE idempotency_key = $1`,
    entrada.idempotencyKey,
  )
  if (recibo) {
    const existente = await obterBooking(recibo.result_json.bookingId)
    if (existente) return existente
  }

  const bookingId = randomUUID()

  try {
    await transaction(async () => {
      const caso = await queryOne<{ status: CaseStatus }>(
        `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
        entrada.caseId,
      )
      if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')
      if (caso.status !== 'READY_FOR_SCHEDULING') {
        throw new ErroDeCaso(
          'INVALID_TRANSITION',
          'Só um caso com requisito publicado pode reservar consulta.',
        )
      }

      const requisito = await queryOne<{
        id: string
        case_id: string
        status: string
        slot_class: SlotClass
        version: number
      }>(`SELECT * FROM scheduling_requirements WHERE id = $1 FOR UPDATE`, entrada.requirementId)
      if (!requisito) throw new ErroDeCaso('NOT_FOUND', 'Requisito não encontrado.')
      if (requisito.case_id !== entrada.caseId) {
        throw new ErroDeCaso('VALIDATION_ERROR', 'O requisito não pertence a este caso.')
      }
      if (requisito.status === 'CALCULATED') {
        throw new ErroDeCaso('INVALID_TRANSITION', 'O requisito ainda não foi confirmado.')
      }

      const slot = await queryOne<{
        id: string
        resource_id: string
        slot_class: SlotClass
        starts_at: string
        ends_at: string
        status: string
      }>(`SELECT * FROM scheduling_slots WHERE id = $1 FOR UPDATE`, entrada.slotId)
      if (!slot) throw new ErroDeCaso('NOT_FOUND', 'Vaga não encontrada.')
      if (slot.status !== 'OPEN') {
        throw new ErroDeCaso('SLOT_TAKEN', 'Esta vaga está bloqueada.')
      }
      if (slot.slot_class !== requisito.slot_class) {
        throw new ErroDeCaso(
          'INCOMPATIBLE_SLOT',
          `A vaga é ${slot.slot_class} e o requisito pede ${requisito.slot_class}.`,
        )
      }

      await execute(
        `INSERT INTO scheduling_bookings (
           id, case_id, requirement_id, requirement_version, slot_id, resource_id,
           kind, slot_class, starts_at, ends_at, status, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,'INITIAL',$7,$8,$9,'CONFIRMED',$10::jsonb)`,
        bookingId,
        entrada.caseId,
        requisito.id,
        requisito.version,
        slot.id,
        slot.resource_id,
        slot.slot_class,
        slot.starts_at,
        slot.ends_at,
        JSON.stringify(atorRecepcao),
      )

      await execute(
        `INSERT INTO scheduling_command_receipts (idempotency_key, action, case_id, input_fingerprint, result_json)
         VALUES ($1,'BOOK',$2,$3,$4::jsonb)`,
        entrada.idempotencyKey,
        entrada.caseId,
        `${entrada.requirementId}:${entrada.slotId}`,
        JSON.stringify({ bookingId }),
      )

      await execute(
        `UPDATE preop_cases SET status = 'SCHEDULED', version = version + 1, updated_at = NOW()
          WHERE id = $1`,
        entrada.caseId,
      )

      await registrarEvento({
        caseId: entrada.caseId,
        eventType: 'BOOKING_CONFIRMED',
        fromStatus: 'READY_FOR_SCHEDULING',
        toStatus: 'SCHEDULED',
        actor: atorRecepcao,
        payload: {
          bookingId,
          kind: 'INITIAL',
          slotId: slot.id,
          startsAt: slot.starts_at,
          slotClass: slot.slot_class,
        },
        receiptDomain: 'SCHEDULING',
        receiptId: entrada.idempotencyKey,
        commandEventIndex: 1,
      })
    })
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) {
      throw new ErroDeCaso('SLOT_TAKEN', 'Esta vaga acabou de ser reservada por outra pessoa.')
    }
    throw erro
  }

  const criado = await obterBooking(bookingId)
  if (!criado) throw new ErroDeCaso('NOT_FOUND', 'A reserva não foi gravada.')
  return criado
}

/**
 * Move a reserva para outra vaga — é o que o arrastar do calendário pede.
 *
 * A validação é idêntica à da reserva original, porque arrastar não é um gesto
 * mais fraco que clicar: mesma classe, vaga livre, caso coerente. Falhou, o
 * renderer chama `revert()` e o desenho volta para onde estava.
 */
export async function moverReserva(entrada: {
  bookingId: string
  slotId: string
  expectedVersion: number
}): Promise<BookingDTO> {
  await garantirContaSintetica()
  const atorRecepcao = ator('RECEPCAO')

  try {
    await transaction(async () => {
      const booking = await queryOne<LinhaBooking>(
        `SELECT * FROM scheduling_bookings WHERE id = $1 FOR UPDATE`,
        entrada.bookingId,
      )
      if (!booking) throw new ErroDeCaso('NOT_FOUND', 'Reserva não encontrada.')
      if (booking.version !== entrada.expectedVersion) {
        throw new ErroDeCaso('VERSION_CONFLICT', 'A reserva mudou em outra janela.')
      }
      if (booking.status !== 'CONFIRMED') {
        throw new ErroDeCaso('INVALID_TRANSITION', 'Só uma reserva confirmada pode ser movida.')
      }

      const slot = await queryOne<{
        id: string
        resource_id: string
        slot_class: SlotClass
        starts_at: string
        ends_at: string
        status: string
      }>(`SELECT * FROM scheduling_slots WHERE id = $1 FOR UPDATE`, entrada.slotId)
      if (!slot) throw new ErroDeCaso('NOT_FOUND', 'Vaga de destino não encontrada.')
      if (slot.status !== 'OPEN') throw new ErroDeCaso('SLOT_TAKEN', 'A vaga de destino está bloqueada.')
      if (slot.slot_class !== booking.slot_class) {
        throw new ErroDeCaso(
          'INCOMPATIBLE_SLOT',
          `A vaga de destino é ${slot.slot_class} e a consulta precisa de ${booking.slot_class}.`,
        )
      }

      const ocupada = await queryOne<{ id: string }>(
        `SELECT id FROM scheduling_bookings
          WHERE slot_id = $1 AND id <> $2 AND status IN ('CONFIRMED','CHECKED_IN','COMPLETED')`,
        entrada.slotId,
        entrada.bookingId,
      )
      if (ocupada) throw new ErroDeCaso('SLOT_TAKEN', 'A vaga de destino já tem consulta marcada.')

      await execute(
        `UPDATE scheduling_bookings
            SET slot_id = $2, resource_id = $3, starts_at = $4, ends_at = $5,
                version = version + 1, updated_at = NOW()
          WHERE id = $1`,
        entrada.bookingId,
        slot.id,
        slot.resource_id,
        slot.starts_at,
        slot.ends_at,
      )

      await execute(
        `UPDATE preop_cases SET version = version + 1, updated_at = NOW() WHERE id = $1`,
        booking.case_id,
      )

      await registrarEvento({
        caseId: booking.case_id,
        eventType: 'BOOKING_RESCHEDULED',
        fromStatus: 'SCHEDULED',
        toStatus: 'SCHEDULED',
        actor: atorRecepcao,
        payload: {
          bookingId: entrada.bookingId,
          previousSlotId: booking.slot_id,
          slotId: slot.id,
          startsAt: slot.starts_at,
        },
        receiptDomain: 'SCHEDULING',
        receiptId: `${entrada.bookingId}:move:${slot.id}`,
        commandEventIndex: 1,
      })
    })
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) {
      throw new ErroDeCaso('SLOT_TAKEN', 'A vaga de destino acabou de ser ocupada.')
    }
    throw erro
  }

  const movido = await obterBooking(entrada.bookingId)
  if (!movido) throw new ErroDeCaso('NOT_FOUND', 'Reserva não encontrada depois de mover.')
  return movido
}

export async function cancelarReserva(entrada: {
  bookingId: string
  motivo: string
  expectedVersion: number
}): Promise<BookingDTO> {
  await garantirContaSintetica()
  const atorRecepcao = ator('RECEPCAO')
  const motivo = entrada.motivo?.trim() ?? ''
  if (motivo.length < 10 || motivo.length > 500) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Cancelar uma consulta exige motivo de 10 a 500 caracteres.')
  }

  await transaction(async () => {
    const booking = await queryOne<LinhaBooking>(
      `SELECT * FROM scheduling_bookings WHERE id = $1 FOR UPDATE`,
      entrada.bookingId,
    )
    if (!booking) throw new ErroDeCaso('NOT_FOUND', 'Reserva não encontrada.')
    if (booking.version !== entrada.expectedVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'A reserva mudou em outra janela.')
    }
    if (!['CONFIRMED', 'CHECKED_IN'].includes(booking.status)) {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Esta reserva já foi encerrada.')
    }

    await execute(
      `UPDATE scheduling_bookings
          SET status = 'CANCELLED', closed_at = NOW(), closed_reason = $2,
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      entrada.bookingId,
      motivo,
    )

    // O caso volta para a fila de agendamento: cancelar consulta não cancela caso.
    await execute(
      `UPDATE preop_cases SET status = 'READY_FOR_SCHEDULING', version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      booking.case_id,
    )

    await registrarEvento({
      caseId: booking.case_id,
      eventType: 'BOOKING_CANCELLED',
      fromStatus: 'SCHEDULED',
      toStatus: 'READY_FOR_SCHEDULING',
      actor: atorRecepcao,
      reason: motivo,
      payload: { bookingId: entrada.bookingId },
      receiptDomain: 'SCHEDULING',
      receiptId: `${entrada.bookingId}:cancel`,
      commandEventIndex: 1,
    })
  })

  const cancelado = await obterBooking(entrada.bookingId)
  if (!cancelado) throw new ErroDeCaso('NOT_FOUND', 'Reserva não encontrada depois de cancelar.')
  return cancelado
}

/** Fila da recepção: casos com requisito publicado e ainda sem consulta marcada. */
export async function filaParaAgendar(): Promise<
  Array<{
    caseId: string
    displayCode: string
    personName: string
    procedureDescription: string
    requirementId: string
    slotClass: SlotClass
    durationMinutes: number
    operationalExplanation: string[]
    requiredCapabilities: string[]
    readySince: string
  }>
> {
  return queryAll(
    `SELECT c.id AS "caseId", c.display_code AS "displayCode",
            c.person_snapshot ->> 'fullName' AS "personName",
            c.procedure_snapshot ->> 'description' AS "procedureDescription",
            r.id AS "requirementId", r.slot_class AS "slotClass",
            r.duration_minutes AS "durationMinutes",
            r.operational_explanation AS "operationalExplanation",
            r.required_capabilities AS "requiredCapabilities",
            r.published_at AS "readySince"
       FROM preop_cases c
       JOIN scheduling_requirements r ON r.case_id = c.id AND r.status IN ('CONFIRMED','OVERRIDDEN')
      WHERE c.status = 'READY_FOR_SCHEDULING'
      ORDER BY r.published_at`,
  )
}
