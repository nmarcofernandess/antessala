import { execute, queryAll, queryOne, transaction } from '../db/query'
import { garantirContaSintetica } from '../auth/session'
import { ErroDeCaso, type SlotClass } from '../../shared/clinical/caso'
import { BUFFER_POR_CLASSE, DURACAO_POR_CLASSE } from '../../shared/clinical/carga'

/**
 * Quando cada consultório atende, e quanto do tempo pertence a cada tipo de
 * consulta.
 *
 * Nada de horário é pré-criado. O expediente é um intervalo; a consulta é
 * encaixada nele quando alguém marca. Horários fixos desperdiçavam o dia: uma
 * vaga longa que ninguém usou não virava duas curtas, e a sala ficava vazia com
 * gente esperando.
 *
 * A cota é o contrapeso disso. Sem ela, uma fila de casos curtos comeria o dia
 * inteiro e o caso longo nunca acharia lugar. Com ela, uma fatia do dia fica
 * reservada para cada tipo — e quando a fatia acaba, o serviço recusa dizendo
 * qual acabou.
 */

const DURACAO = DURACAO_POR_CLASSE
const BUFFER: Record<SlotClass, number> = {
  QUICK: BUFFER_POR_CLASSE.RAPIDA,
  STANDARD: BUFFER_POR_CLASSE.NORMAL,
  EXTENDED: BUFFER_POR_CLASSE.ESTENDIDA,
}

/** Quanto tempo uma consulta desta classe ocupa a sala, buffer incluído. */
export function ocupacao(classe: SlotClass): number {
  return DURACAO[classe] + BUFFER[classe]
}

/** Até onde adiante a agenda aceita marcar. */
export const HORIZONTE_SEMANAS = 8

export type Pausa = { id: string; inicio: number; fim: number }

export type DiaDisponivel = {
  weekday: number
  ativo: boolean
  inicio: number
  fim: number
  pausas: Pausa[]
}

export type Cotas = Record<SlotClass, number>

export type DisponibilidadeDTO = {
  resourceId: string
  nome: string
  ativo: boolean
  capabilities: string[]
  cotas: Cotas
  dias: DiaDisponivel[]
  consultasFuturas: number
}

const PADRAO: DiaDisponivel[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  ativo: weekday >= 1 && weekday <= 5,
  inicio: 8 * 60,
  fim: 17 * 60,
  pausas: weekday >= 1 && weekday <= 5 ? [{ id: 'almoco', inicio: 12 * 60, fim: 13 * 60 + 30 }] : [],
}))

const COTAS_PADRAO: Cotas = { QUICK: 40, STANDARD: 40, EXTENDED: 20 }

/* ══════════════ leitura da regra ══════════════ */

export async function obterDisponibilidade(): Promise<DisponibilidadeDTO[]> {
  const recursos = await queryAll<{
    id: string
    nome: string
    ativo: boolean
    capabilities: string[]
    cotas: Cotas
    consultasFuturas: number
  }>(
    `SELECT r.id, r.nome, r.ativo, r.capabilities, r.cotas,
            COALESCE((
              SELECT COUNT(*) FROM scheduling_bookings b
               WHERE b.resource_id = r.id AND b.starts_at >= NOW()
                 AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
            ), 0)::int AS "consultasFuturas"
       FROM scheduling_resources r
      ORDER BY r.ordem, r.nome`,
  )

  const linhas = await queryAll<{
    resource_id: string
    weekday: number
    ativo: boolean
    inicio_min: number
    fim_min: number
    pausas: Pausa[]
  }>(`SELECT * FROM scheduling_availability`)

  return recursos.map((r) => ({
    resourceId: r.id,
    nome: r.nome,
    ativo: r.ativo,
    capabilities: r.capabilities ?? [],
    cotas: { ...COTAS_PADRAO, ...(r.cotas ?? {}) },
    consultasFuturas: r.consultasFuturas,
    dias: Array.from({ length: 7 }, (_, weekday) => {
      const l = linhas.find((x) => x.resource_id === r.id && x.weekday === weekday)
      return l
        ? {
            weekday,
            ativo: l.ativo,
            inicio: l.inicio_min,
            fim: l.fim_min,
            pausas: l.pausas ?? [],
          }
        : { weekday, ativo: false, inicio: 8 * 60, fim: 17 * 60, pausas: [] }
    }),
  }))
}

function validarDia(d: DiaDisponivel): void {
  if (d.fim <= d.inicio) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'O expediente precisa terminar depois de começar.')
  }
  for (const p of d.pausas) {
    if (p.fim <= p.inicio || p.inicio < d.inicio || p.fim > d.fim) {
      throw new ErroDeCaso('VALIDATION_ERROR', 'Cada pausa precisa caber dentro do expediente.')
    }
  }
}

export async function salvarDisponibilidade(entrada: {
  resourceId: string
  cotas: Cotas
  dias: DiaDisponivel[]
}): Promise<DisponibilidadeDTO> {
  await garantirContaSintetica()
  entrada.dias.forEach(validarDia)

  const soma = Object.values(entrada.cotas).reduce((t, n) => t + n, 0)
  if (soma !== 100) {
    throw new ErroDeCaso(
      'VALIDATION_ERROR',
      `As cotas precisam somar 100% — hoje somam ${soma}%.`,
    )
  }
  for (const [classe, valor] of Object.entries(entrada.cotas)) {
    if (valor < 0 || valor > 100 || !Number.isInteger(valor)) {
      throw new ErroDeCaso('VALIDATION_ERROR', `Cota inválida para ${classe}.`)
    }
  }

  await transaction(async () => {
    await execute(
      `UPDATE scheduling_resources SET cotas = $2::jsonb WHERE id = $1`,
      entrada.resourceId,
      JSON.stringify(entrada.cotas),
    )
    for (const d of entrada.dias) {
      await execute(
        `INSERT INTO scheduling_availability (resource_id, weekday, ativo, inicio_min, fim_min, pausas)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (resource_id, weekday) DO UPDATE
           SET ativo = EXCLUDED.ativo, inicio_min = EXCLUDED.inicio_min,
               fim_min = EXCLUDED.fim_min, pausas = EXCLUDED.pausas`,
        entrada.resourceId,
        d.weekday,
        d.ativo,
        d.inicio,
        d.fim,
        JSON.stringify(d.pausas ?? []),
      )
    }
  })

  const lista = await obterDisponibilidade()
  return lista.find((l) => l.resourceId === entrada.resourceId)!
}

/* ══════════════ o dia de uma sala ══════════════ */

export type Intervalo = { inicio: Date; fim: Date }

export type ConsultaMarcada = {
  bookingId: string
  caseId: string
  displayCode: string
  personName: string
  slotClass: SlotClass
  status: string
  version: number
  inicio: Date
  fim: Date
  ocupaAte: Date
}

export type DiaDaSala = {
  resourceId: string
  nome: string
  capabilities: string[]
  /** Expediente menos pausas: onde é possível atender. */
  atendimento: Intervalo[]
  bloqueios: Intervalo[]
  consultas: ConsultaMarcada[]
  /** Buracos onde ainda cabe alguém. */
  livres: Intervalo[]
  minutosDeAtendimento: number
  minutosLivres: number
  /** Minutos reservados e já usados por classe. */
  cota: Record<SlotClass, { reservado: number; usado: number }>
}

function comMinutos(dia: Date, minutos: number): Date {
  const d = new Date(dia)
  d.setHours(0, 0, 0, 0)
  d.setMinutes(minutos)
  return d
}

function subtrair(base: Intervalo[], corte: Intervalo): Intervalo[] {
  const saida: Intervalo[] = []
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

function minutosDe(intervalos: Intervalo[]): number {
  return intervalos.reduce((t, i) => t + (i.fim.getTime() - i.inicio.getTime()) / 60_000, 0)
}

/**
 * Reconstrói o dia de uma sala: onde se atende, o que já está marcado, o que
 * sobrou e quanto de cada cota foi gasto.
 *
 * É a função da qual tudo depende — grade, sugestões e a própria reserva. Ela
 * não guarda estado: lê a regra e as consultas e calcula. Não existe "vaga"
 * persistida para sair de sincronia com a agenda.
 */
export async function diaDaSala(resourceId: string, dia: Date): Promise<DiaDaSala | null> {
  const recurso = await queryOne<{
    id: string
    nome: string
    ativo: boolean
    capabilities: string[]
    cotas: Cotas
  }>(`SELECT id, nome, ativo, capabilities, cotas FROM scheduling_resources WHERE id = $1`, resourceId)
  if (!recurso || !recurso.ativo) return null

  const regra = await queryOne<{
    ativo: boolean
    inicio_min: number
    fim_min: number
    pausas: Pausa[]
  }>(
    `SELECT ativo, inicio_min, fim_min, pausas FROM scheduling_availability
      WHERE resource_id = $1 AND weekday = $2`,
    resourceId,
    dia.getDay(),
  )
  if (!regra?.ativo) return null

  let atendimento: Intervalo[] = [
    { inicio: comMinutos(dia, regra.inicio_min), fim: comMinutos(dia, regra.fim_min) },
  ]
  for (const p of regra.pausas ?? []) {
    atendimento = subtrair(atendimento, {
      inicio: comMinutos(dia, p.inicio),
      fim: comMinutos(dia, p.fim),
    })
  }

  const inicioDoDia = comMinutos(dia, 0)
  const fimDoDia = comMinutos(dia, 24 * 60)

  const bloqueiosCru = await queryAll<{ starts_at: string; ends_at: string }>(
    `SELECT starts_at, ends_at FROM scheduling_blocks
      WHERE resource_id = $1 AND starts_at < $3 AND ends_at > $2`,
    resourceId,
    inicioDoDia.toISOString(),
    fimDoDia.toISOString(),
  )
  const bloqueios = bloqueiosCru.map((b) => ({
    inicio: new Date(b.starts_at),
    fim: new Date(b.ends_at),
  }))

  const marcadas = await queryAll<{
    id: string
    case_id: string
    display_code: string
    person_name: string
    slot_class: SlotClass
    status: string
    version: number
    starts_at: string
    ends_at: string
    buffer_minutes: number
  }>(
    `SELECT b.id, b.case_id, c.display_code, c.person_snapshot ->> 'fullName' AS person_name,
            b.slot_class, b.status, b.version, b.starts_at, b.ends_at, b.buffer_minutes
       FROM scheduling_bookings b
       JOIN preop_cases c ON c.id = b.case_id
      WHERE b.resource_id = $1 AND b.starts_at >= $2 AND b.starts_at < $3
        AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
      ORDER BY b.starts_at`,
    resourceId,
    inicioDoDia.toISOString(),
    fimDoDia.toISOString(),
  )

  const consultas: ConsultaMarcada[] = marcadas.map((m) => {
    const fim = new Date(m.ends_at)
    const ocupaAte = new Date(fim.getTime() + m.buffer_minutes * 60_000)
    return {
      bookingId: m.id,
      caseId: m.case_id,
      displayCode: m.display_code,
      personName: m.person_name,
      slotClass: m.slot_class,
      status: m.status,
      version: m.version,
      inicio: new Date(m.starts_at),
      fim,
      ocupaAte,
    }
  })

  let livres = atendimento
  for (const b of bloqueios) livres = subtrair(livres, b)
  for (const c of consultas) livres = subtrair(livres, { inicio: c.inicio, fim: c.ocupaAte })

  const minutosDeAtendimento = minutosDe(atendimento)
  const cotas = { ...COTAS_PADRAO, ...(recurso.cotas ?? {}) }
  const cota = {} as DiaDaSala['cota']
  for (const classe of ['QUICK', 'STANDARD', 'EXTENDED'] as SlotClass[]) {
    const usado = consultas
      .filter((c) => c.slotClass === classe)
      .reduce((t, c) => t + (c.ocupaAte.getTime() - c.inicio.getTime()) / 60_000, 0)
    cota[classe] = {
      reservado: Math.round((minutosDeAtendimento * (cotas[classe] ?? 0)) / 100),
      usado,
    }
  }

  return {
    resourceId,
    nome: recurso.nome,
    capabilities: recurso.capabilities ?? [],
    atendimento,
    bloqueios,
    consultas,
    livres,
    minutosDeAtendimento,
    minutosLivres: minutosDe(livres),
    cota,
  }
}

/** Onde uma consulta desta classe caberia hoje, nesta sala. */
export function encaixesNoDia(dia: DiaDaSala, classe: SlotClass, agora = new Date()): Date[] {
  const precisa = ocupacao(classe)
  const restante = dia.cota[classe].reservado - dia.cota[classe].usado
  if (restante < precisa) return []

  const saida: Date[] = []
  for (const janela of dia.livres) {
    let cursor = new Date(Math.max(janela.inicio.getTime(), agora.getTime()))
    // Encaixes começam em marcas de 5 minutos: horário quebrado por aritmética
    // de buffer é ruim de ler e pior de combinar com alguém.
    const resto = cursor.getMinutes() % 5
    if (resto !== 0) cursor = new Date(cursor.getTime() + (5 - resto) * 60_000)

    while (cursor.getTime() + precisa * 60_000 <= janela.fim.getTime()) {
      saida.push(new Date(cursor))
      cursor = new Date(cursor.getTime() + precisa * 60_000)
    }
  }
  return saida
}

/** Quantas consultas de cada classe ainda cabem no dia desta sala. */
export function capacidadeDoDia(dia: DiaDaSala): Record<SlotClass, number> {
  return {
    QUICK: encaixesNoDia(dia, 'QUICK').length,
    STANDARD: encaixesNoDia(dia, 'STANDARD').length,
    EXTENDED: encaixesNoDia(dia, 'EXTENDED').length,
  }
}

/* ══════════════ seed ══════════════ */

export async function semearDisponibilidadePadrao(): Promise<void> {
  const recursos = await queryAll<{ id: string }>(`SELECT id FROM scheduling_resources`)
  for (const r of recursos) {
    for (const d of PADRAO) {
      await execute(
        `INSERT INTO scheduling_availability (resource_id, weekday, ativo, inicio_min, fim_min, pausas)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (resource_id, weekday) DO NOTHING`,
        r.id,
        d.weekday,
        d.ativo,
        d.inicio,
        d.fim,
        JSON.stringify(d.pausas),
      )
    }
  }
}
