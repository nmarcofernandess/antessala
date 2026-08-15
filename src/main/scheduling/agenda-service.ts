import { randomUUID } from 'node:crypto'
import { execute, queryAll, queryOne, transaction } from '../db/query'
import { ator, garantirContaSintetica } from '../auth/session'
import { registrarEvento } from '../clinical/case-service'
import {
  ErroDeCaso,
  type AgendaIntervaloDTO,
  type BookingDTO,
  type CaseStatus,
  type DiaDaAgendaDTO,
  type SlotClass,
  type SugestaoDTO,
} from '../../shared/clinical/caso'
import {
  capacidadeDoDia,
  diaDaSala,
  encaixesNoDia,
  ocupacao,
  HORIZONTE_SEMANAS,
  type DiaDaSala,
} from './availability-service'

/**
 * Agenda da consulta pré-anestésica.
 *
 * Não existe vaga persistida. O expediente é um intervalo, a consulta é
 * encaixada nele, e "o que está livre" é sempre calculado — nunca uma linha que
 * pode ficar dessincronizada da realidade.
 *
 * O renderer coleta intenção; **toda** validação acontece aqui: dentro do
 * expediente, fora das pausas e bloqueios, sem sobrepor outra consulta, com a
 * sala tendo o que o caso exige e com cota da classe ainda disponível.
 *
 * Concorrência: o PGlite não traz `btree_gist`, então não há como barrar
 * sobreposição por constraint. A barreira é `pg_advisory_xact_lock` por sala e
 * dia, com a verificação feita dentro do mesmo lock — dois cliques simultâneos
 * na mesma sala se enfileiram, e o segundo lê o que o primeiro gravou.
 */

/* ══════════════ leitura ══════════════ */

type LinhaBooking = {
  id: string
  case_id: string
  requirement_id: string
  resource_id: string
  kind: 'INITIAL' | 'RETURN'
  slot_class: SlotClass
  starts_at: string
  ends_at: string
  buffer_minutes: number
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
    resourceId: l.resource_id,
    resourceName: l.resource_name ?? '',
    kind: l.kind,
    slotClass: l.slot_class,
    startsAt: l.starts_at,
    endsAt: l.ends_at,
    bufferMinutes: l.buffer_minutes,
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

export async function obterBooking(bookingId: string): Promise<BookingDTO | null> {
  const linha = await queryOne<LinhaBooking>(`${SELECT_BOOKING} WHERE b.id = $1`, bookingId)
  return linha ? daLinha(linha) : null
}

function chaveDoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function iso(i: { inicio: Date; fim: Date }): { inicio: string; fim: string } {
  return { inicio: i.inicio.toISOString(), fim: i.fim.toISOString() }
}

function comoDTO(dia: DiaDaSala, data: Date): DiaDaAgendaDTO {
  return {
    data: chaveDoDia(data),
    resourceId: dia.resourceId,
    resourceName: dia.nome,
    atendimento: dia.atendimento.map(iso),
    livres: dia.livres.map(iso),
    bloqueios: dia.bloqueios.map(iso),
    consultas: dia.consultas.map((c) => ({
      bookingId: c.bookingId,
      caseId: c.caseId,
      displayCode: c.displayCode,
      personName: c.personName,
      slotClass: c.slotClass,
      status: c.status,
      version: c.version,
      inicio: c.inicio.toISOString(),
      fim: c.fim.toISOString(),
      ocupaAte: c.ocupaAte.toISOString(),
    })),
    minutosDeAtendimento: dia.minutosDeAtendimento,
    minutosLivres: dia.minutosLivres,
    capacidade: capacidadeDoDia(dia),
    cota: dia.cota,
  }
}

/** O que a agenda mostra num intervalo: as salas e o que acontece em cada dia. */
export async function listarIntervalo(entrada: {
  de: string
  ate: string
}): Promise<AgendaIntervaloDTO> {
  const recursos = await queryAll<{ id: string; name: string; capabilities: string[] }>(
    `SELECT id, nome AS name, capabilities FROM scheduling_resources WHERE ativo ORDER BY ordem, nome`,
  )

  const de = new Date(entrada.de)
  const ate = new Date(entrada.ate)
  const dias: DiaDaAgendaDTO[] = []

  for (const r of recursos) {
    for (let d = new Date(de); d <= ate; d.setDate(d.getDate() + 1)) {
      const dia = await diaDaSala(r.id, new Date(d))
      if (dia) dias.push(comoDTO(dia, new Date(d)))
    }
  }

  return { resources: recursos, dias }
}

/* ══════════════ sugestões ══════════════ */

/**
 * Os próximos horários que servem para este requisito.
 *
 * Varre os dias adiante, sala por sala, e devolve os encaixes em ordem de quem
 * vem primeiro. É isso que a tela oferece — ninguém navega calendário atrás de
 * buraco.
 */
export async function sugerirHorarios(entrada: {
  requirementId: string
  limite?: number
}): Promise<SugestaoDTO[]> {
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

  const exigidas = requisito.required_capabilities ?? []
  const recursos = await queryAll<{ id: string; nome: string; capabilities: string[] }>(
    `SELECT id, nome, capabilities FROM scheduling_resources WHERE ativo ORDER BY ordem, nome`,
  )
  const compativeis = recursos.filter((r) =>
    exigidas.every((c) => (r.capabilities ?? []).includes(c)),
  )

  const limite = entrada.limite ?? 12
  const agora = new Date()
  const saida: SugestaoDTO[] = []

  for (let passo = 0; passo < HORIZONTE_SEMANAS * 7 && saida.length < limite; passo++) {
    const data = new Date(agora)
    data.setDate(data.getDate() + passo)

    for (const r of compativeis) {
      const dia = await diaDaSala(r.id, data)
      if (!dia) continue
      for (const inicio of encaixesNoDia(dia, requisito.slot_class, agora)) {
        saida.push({
          resourceId: r.id,
          resourceName: r.nome,
          startsAt: inicio.toISOString(),
          endsAt: new Date(
            inicio.getTime() + (ocupacao(requisito.slot_class) - buffer(requisito.slot_class)) * 60_000,
          ).toISOString(),
          slotClass: requisito.slot_class,
        })
      }
    }
  }

  return saida
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limite)
}

function buffer(classe: SlotClass): number {
  return ocupacao(classe) - { QUICK: 20, STANDARD: 35, EXTENDED: 50 }[classe]
}

/* ══════════════ reserva ══════════════ */

/**
 * Serializa quem mexe no mesmo dia da mesma sala.
 *
 * Sem `btree_gist` não há constraint de sobreposição; este lock é o que garante
 * que a verificação e a escrita aconteçam sem ninguém entrar no meio.
 */
async function travarDia(resourceId: string, dia: Date): Promise<void> {
  await queryOne(`SELECT pg_advisory_xact_lock(hashtext($1)) AS travado`, `${resourceId}:${chaveDoDia(dia)}`)
}

/** Recusa o horário que não cabe — e diz qual foi o motivo. */
function exigirEncaixe(dia: DiaDaSala, classe: SlotClass, inicio: Date): void {
  const precisa = ocupacao(classe)
  const fim = new Date(inicio.getTime() + precisa * 60_000)

  const dentro = dia.livres.some((j) => j.inicio <= inicio && j.fim >= fim)
  if (!dentro) {
    throw new ErroDeCaso(
      'SLOT_TAKEN',
      'Este horário não está livre nesta sala — outra consulta, um bloqueio ou o fim do expediente pegam parte dele.',
    )
  }

  const restante = dia.cota[classe].reservado - dia.cota[classe].usado
  if (restante < precisa) {
    throw new ErroDeCaso(
      'INCOMPATIBLE_SLOT',
      `A reserva de tempo para esta classe acabou neste dia: restam ${Math.max(restante, 0)} min e a consulta precisa de ${precisa}.`,
    )
  }
}

export async function reservar(entrada: {
  caseId: string
  requirementId: string
  resourceId: string
  startsAt: string
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
  const inicio = new Date(entrada.startsAt)

  await transaction(async () => {
    await travarDia(entrada.resourceId, inicio)

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
      duration_minutes: number
      buffer_minutes: number
      version: number
      required_capabilities: string[]
    }>(`SELECT * FROM scheduling_requirements WHERE id = $1 FOR UPDATE`, entrada.requirementId)
    if (!requisito) throw new ErroDeCaso('NOT_FOUND', 'Requisito não encontrado.')
    if (requisito.case_id !== entrada.caseId) {
      throw new ErroDeCaso('VALIDATION_ERROR', 'O requisito não pertence a este caso.')
    }
    if (requisito.status === 'CALCULATED') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'O requisito ainda não foi confirmado.')
    }

    const dia = await diaDaSala(entrada.resourceId, inicio)
    if (!dia) {
      throw new ErroDeCaso('SLOT_TAKEN', 'Esta sala não atende neste dia.')
    }
    for (const exigida of requisito.required_capabilities ?? []) {
      if (!dia.capabilities.includes(exigida)) {
        throw new ErroDeCaso(
          'INCOMPATIBLE_SLOT',
          'Esta sala não tem o que o caso exige.',
        )
      }
    }
    exigirEncaixe(dia, requisito.slot_class, inicio)

    const fim = new Date(inicio.getTime() + requisito.duration_minutes * 60_000)

    await execute(
      `INSERT INTO scheduling_bookings (
         id, case_id, requirement_id, requirement_version, resource_id, buffer_minutes,
         kind, slot_class, starts_at, ends_at, status, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,'INITIAL',$7,$8,$9,'CONFIRMED',$10::jsonb)`,
      bookingId,
      entrada.caseId,
      requisito.id,
      requisito.version,
      entrada.resourceId,
      requisito.buffer_minutes,
      requisito.slot_class,
      inicio.toISOString(),
      fim.toISOString(),
      JSON.stringify(atorRecepcao),
    )

    await execute(
      `INSERT INTO scheduling_command_receipts (idempotency_key, action, case_id, input_fingerprint, result_json)
       VALUES ($1,'BOOK',$2,$3,$4::jsonb)`,
      entrada.idempotencyKey,
      entrada.caseId,
      `${entrada.requirementId}:${entrada.resourceId}:${inicio.toISOString()}`,
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
        resourceId: entrada.resourceId,
        startsAt: inicio.toISOString(),
        slotClass: requisito.slot_class,
      },
      receiptDomain: 'SCHEDULING',
      receiptId: entrada.idempotencyKey,
      commandEventIndex: 1,
    })
  })

  const criado = await obterBooking(bookingId)
  if (!criado) throw new ErroDeCaso('NOT_FOUND', 'A reserva não foi gravada.')
  return criado
}

/** Remarcar: mesma validação da reserva, com o compromisso anterior liberado. */
export async function moverReserva(entrada: {
  bookingId: string
  resourceId: string
  startsAt: string
  expectedVersion: number
}): Promise<BookingDTO> {
  await garantirContaSintetica()
  const atorRecepcao = ator('RECEPCAO')
  const inicio = new Date(entrada.startsAt)

  await transaction(async () => {
    await travarDia(entrada.resourceId, inicio)

    const booking = await queryOne<LinhaBooking>(
      `SELECT * FROM scheduling_bookings WHERE id = $1 FOR UPDATE`,
      entrada.bookingId,
    )
    if (!booking) throw new ErroDeCaso('NOT_FOUND', 'Reserva não encontrada.')
    if (booking.version !== entrada.expectedVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'A reserva mudou em outra janela.')
    }
    if (booking.status !== 'CONFIRMED') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Só uma reserva confirmada pode ser remarcada.')
    }

    const dia = await diaDaSala(entrada.resourceId, inicio)
    if (!dia) throw new ErroDeCaso('SLOT_TAKEN', 'Esta sala não atende neste dia.')

    // O próprio compromisso não pode bloquear a si mesmo ao ser movido dentro
    // do mesmo dia: ele sai da conta antes da verificação.
    const semEleMesmo: DiaDaSala = {
      ...dia,
      consultas: dia.consultas.filter((c) => c.bookingId !== entrada.bookingId),
    }
    let livres = semEleMesmo.atendimento
    for (const b of semEleMesmo.bloqueios) livres = subtrairIntervalo(livres, b)
    for (const c of semEleMesmo.consultas) {
      livres = subtrairIntervalo(livres, { inicio: c.inicio, fim: c.ocupaAte })
    }
    semEleMesmo.livres = livres
    const usado = semEleMesmo.consultas
      .filter((c) => c.slotClass === booking.slot_class)
      .reduce((t, c) => t + (c.ocupaAte.getTime() - c.inicio.getTime()) / 60_000, 0)
    semEleMesmo.cota = {
      ...dia.cota,
      [booking.slot_class]: { ...dia.cota[booking.slot_class], usado },
    }

    exigirEncaixe(semEleMesmo, booking.slot_class, inicio)

    const duracao = (new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60_000
    const fim = new Date(inicio.getTime() + duracao * 60_000)

    await execute(
      `UPDATE scheduling_bookings
          SET resource_id = $2, starts_at = $3, ends_at = $4,
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      entrada.bookingId,
      entrada.resourceId,
      inicio.toISOString(),
      fim.toISOString(),
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
        de: booking.starts_at,
        para: inicio.toISOString(),
        resourceId: entrada.resourceId,
      },
      receiptDomain: 'SCHEDULING',
      receiptId: `${entrada.bookingId}:move:${inicio.toISOString()}`,
      commandEventIndex: 1,
    })
  })

  const movido = await obterBooking(entrada.bookingId)
  if (!movido) throw new ErroDeCaso('NOT_FOUND', 'Reserva não encontrada depois de mover.')
  return movido
}

function subtrairIntervalo(
  base: Array<{ inicio: Date; fim: Date }>,
  corte: { inicio: Date; fim: Date },
): Array<{ inicio: Date; fim: Date }> {
  const saida: Array<{ inicio: Date; fim: Date }> = []
  for (const b of base) {
    if (corte.fim <= b.inicio || corte.inicio >= b.fim) {
      saida.push(b)
      continue
    }
    if (corte.inicio > b.inicio) saida.push({ inicio: b.inicio, fim: corte.inicio })
    if (corte.fim < b.fim) saida.push({ inicio: corte.fim, fim: b.fim })
  }
  return saida
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

/* ══════════════ chegada e ausência ══════════════ */

/**
 * Registra que a pessoa chegou.
 *
 * O relógio nunca faz isso sozinho. Passar da hora marcada não é chegada nem
 * ausência: são duas coisas que **alguém** afirma, e por isso existem dois
 * comandos com autoria em vez de um job varrendo a agenda.
 */
export async function registrarChegada(entrada: {
  bookingId: string
  expectedVersion: number
}): Promise<BookingDTO> {
  await garantirContaSintetica()
  const atorRecepcao = ator('RECEPCAO')

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
      throw new ErroDeCaso('INVALID_TRANSITION', 'Só uma consulta confirmada recebe chegada.')
    }

    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      booking.case_id,
    )
    if (caso?.status !== 'SCHEDULED') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'O caso não está aguardando a consulta marcada.')
    }

    await execute(
      `UPDATE scheduling_bookings
          SET status = 'CHECKED_IN', checked_in_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      entrada.bookingId,
    )

    await execute(
      `UPDATE preop_cases SET status = 'WAITING_ANESTHESIA', version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      booking.case_id,
    )

    await registrarEvento({
      caseId: booking.case_id,
      eventType: 'BOOKING_CHECKED_IN',
      fromStatus: 'SCHEDULED',
      toStatus: 'WAITING_ANESTHESIA',
      actor: atorRecepcao,
      payload: { bookingId: entrada.bookingId, startsAt: booking.starts_at },
      receiptDomain: 'SCHEDULING',
      receiptId: `${entrada.bookingId}:checkin`,
      commandEventIndex: 1,
    })
  })

  const atualizado = await obterBooking(entrada.bookingId)
  if (!atualizado) throw new ErroDeCaso('NOT_FOUND', 'Reserva não encontrada depois da chegada.')
  return atualizado
}

/**
 * Registra que a pessoa não veio.
 *
 * O caso volta para a fila de agendamento — faltar não encerra caso, e remarcar
 * é a continuação normal da história.
 */
export async function registrarAusencia(entrada: {
  bookingId: string
  expectedVersion: number
  nota?: string
}): Promise<BookingDTO> {
  await garantirContaSintetica()
  const atorRecepcao = ator('RECEPCAO')
  const nota = entrada.nota?.trim() || null
  if (nota && nota.length > 500) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'A nota da ausência passa de 500 caracteres.')
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
    if (booking.status !== 'CONFIRMED') {
      throw new ErroDeCaso(
        'INVALID_TRANSITION',
        'Ausência só se registra em consulta confirmada que ninguém atendeu.',
      )
    }

    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      booking.case_id,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')

    await execute(
      `UPDATE scheduling_bookings
          SET status = 'NO_SHOW', closed_at = NOW(), closed_reason = $2,
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      entrada.bookingId,
      nota,
    )

    await execute(
      `UPDATE preop_cases SET status = 'READY_FOR_SCHEDULING', version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      booking.case_id,
    )

    await registrarEvento({
      caseId: booking.case_id,
      eventType: 'BOOKING_NO_SHOW',
      fromStatus: caso.status,
      toStatus: 'READY_FOR_SCHEDULING',
      actor: atorRecepcao,
      reason: nota,
      payload: { bookingId: entrada.bookingId, startsAt: booking.starts_at },
      receiptDomain: 'SCHEDULING',
      receiptId: `${entrada.bookingId}:no-show`,
      commandEventIndex: 1,
    })
  })

  const atualizado = await obterBooking(entrada.bookingId)
  if (!atualizado) throw new ErroDeCaso('NOT_FOUND', 'Reserva não encontrada depois da ausência.')
  return atualizado
}

/* ══════════════ bloqueio ══════════════ */

export async function bloquear(entrada: {
  resourceId: string
  inicio: string
  fim: string
  motivo: string
}): Promise<void> {
  await garantirContaSintetica()
  const quem = ator('RECEPCAO')
  const motivo = entrada.motivo?.trim() ?? ''
  if (motivo.length < 5 || motivo.length > 200) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Bloquear exige motivo de 5 a 200 caracteres.')
  }

  const inicio = new Date(entrada.inicio)
  const fim = new Date(entrada.fim)
  if (fim <= inicio) throw new ErroDeCaso('VALIDATION_ERROR', 'O bloqueio precisa ter duração.')

  const conflito = await queryOne<{ id: string }>(
    `SELECT id FROM scheduling_bookings
      WHERE resource_id = $1 AND status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
        AND starts_at < $3 AND ends_at > $2`,
    entrada.resourceId,
    inicio.toISOString(),
    fim.toISOString(),
  )
  if (conflito) {
    throw new ErroDeCaso(
      'SLOT_TAKEN',
      'Há consulta marcada nesse intervalo. Remarque ou cancele antes de bloquear.',
    )
  }

  await execute(
    `INSERT INTO scheduling_blocks (id, resource_id, starts_at, ends_at, motivo, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    randomUUID(),
    entrada.resourceId,
    inicio.toISOString(),
    fim.toISOString(),
    motivo,
    JSON.stringify(quem),
  )
}

export async function desbloquear(blockId: string): Promise<void> {
  await execute(`DELETE FROM scheduling_blocks WHERE id = $1`, blockId)
}

/* ══════════════ fila ══════════════ */

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
