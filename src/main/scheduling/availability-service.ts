import { execute, queryAll, queryOne, transaction } from '../db/query'
import { garantirContaSintetica } from '../auth/session'
import { ErroDeCaso, type SlotClass } from '../../shared/clinical/caso'
import { BUFFER_POR_CLASSE, DURACAO_POR_CLASSE } from '../../shared/clinical/carga'

/**
 * A disponibilidade é a regra; as vagas são a materialização dela.
 *
 * Antes a operação abria vagas semana a semana — trabalho repetido para dizer
 * a mesma coisa toda segunda. Aqui se declara uma vez como o consultório
 * funciona (que dias, que horas, com que pausas, oferecendo que tamanhos de
 * vaga) e o serviço materializa isso para frente até o horizonte.
 *
 * Reconciliar é a parte que não pode errar: quando a regra muda, as vagas
 * livres que não pertencem mais a ela somem, e as que faltavam nascem. Vaga com
 * consulta marcada **nunca** é tocada — ela é um compromisso com uma pessoa, e
 * desmarcar alguém é decisão de agenda, não efeito colateral de configuração.
 */

/** Quantas semanas de vaga o app mantém abertas à frente. */
export const HORIZONTE_SEMANAS = 8

const DURACAO = DURACAO_POR_CLASSE
const BUFFER: Record<SlotClass, number> = {
  QUICK: BUFFER_POR_CLASSE.RAPIDA,
  STANDARD: BUFFER_POR_CLASSE.NORMAL,
  EXTENDED: BUFFER_POR_CLASSE.ESTENDIDA,
}

export type Pausa = { id: string; inicio: number; fim: number }

export type DiaDisponivel = {
  weekday: number
  ativo: boolean
  inicio: number
  fim: number
  pausas: Pausa[]
}

export type DisponibilidadeDTO = {
  resourceId: string
  nome: string
  ativo: boolean
  capabilities: string[]
  mistura: SlotClass[]
  dias: DiaDisponivel[]
  vagasFuturas: number
  vagasOcupadas: number
}

const PADRAO: DiaDisponivel[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  ativo: weekday >= 1 && weekday <= 5,
  inicio: 8 * 60,
  fim: 17 * 60,
  pausas: weekday >= 1 && weekday <= 5 ? [{ id: 'almoco', inicio: 12 * 60, fim: 13 * 60 + 30 }] : [],
}))

export async function obterDisponibilidade(): Promise<DisponibilidadeDTO[]> {
  const recursos = await queryAll<{
    id: string
    nome: string
    ativo: boolean
    capabilities: string[]
    mistura: SlotClass[]
    vagasFuturas: number
    vagasOcupadas: number
  }>(
    `SELECT r.id, r.nome, r.ativo, r.capabilities, r.mistura,
            COALESCE(f.total, 0)::int AS "vagasFuturas",
            COALESCE(f.ocupadas, 0)::int AS "vagasOcupadas"
       FROM scheduling_resources r
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total,
                COUNT(*) FILTER (
                  WHERE EXISTS (
                    SELECT 1 FROM scheduling_bookings b
                     WHERE b.slot_id = s.id AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
                  )
                ) AS ocupadas
           FROM scheduling_slots s
          WHERE s.resource_id = r.id AND s.starts_at >= NOW()
       ) f ON TRUE
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

  return recursos.map((r) => {
    const doRecurso = linhas.filter((l) => l.resource_id === r.id)
    const dias: DiaDisponivel[] = Array.from({ length: 7 }, (_, weekday) => {
      const l = doRecurso.find((x) => x.weekday === weekday)
      if (!l) return { weekday, ativo: false, inicio: 8 * 60, fim: 17 * 60, pausas: [] }
      return {
        weekday,
        ativo: l.ativo,
        inicio: l.inicio_min,
        fim: l.fim_min,
        pausas: l.pausas ?? [],
      }
    })
    return {
      resourceId: r.id,
      nome: r.nome,
      ativo: r.ativo,
      capabilities: r.capabilities ?? [],
      mistura: r.mistura ?? ['STANDARD', 'QUICK', 'EXTENDED'],
      dias,
      vagasFuturas: r.vagasFuturas,
      vagasOcupadas: r.vagasOcupadas,
    }
  })
}

function validarDia(d: DiaDisponivel): DiaDisponivel {
  if (d.fim <= d.inicio) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'O expediente precisa terminar depois de começar.')
  }
  for (const p of d.pausas) {
    if (p.fim <= p.inicio || p.inicio < d.inicio || p.fim > d.fim) {
      throw new ErroDeCaso('VALIDATION_ERROR', 'Cada pausa precisa caber dentro do expediente.')
    }
  }
  return d
}

/**
 * Salva a regra e materializa as vagas até o horizonte.
 *
 * Salvar e materializar acontecem juntos porque a operação não pensa em dois
 * passos: mudou o horário, quer ver a agenda mudar.
 */
export async function salvarDisponibilidade(entrada: {
  resourceId: string
  mistura: SlotClass[]
  dias: DiaDisponivel[]
}): Promise<{ criadas: number; removidas: number }> {
  await garantirContaSintetica()
  if (entrada.mistura.length === 0) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Escolha ao menos um tamanho de vaga.')
  }
  entrada.dias.forEach(validarDia)

  await transaction(async () => {
    await execute(
      `UPDATE scheduling_resources SET mistura = $2::jsonb WHERE id = $1`,
      entrada.resourceId,
      JSON.stringify(entrada.mistura),
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

  return materializar(entrada.resourceId)
}

function comMinutos(dia: Date, minutos: number): Date {
  const d = new Date(dia)
  d.setHours(0, 0, 0, 0)
  d.setMinutes(minutos)
  return d
}

/** Os horários que a regra manda existir num dia, na ordem do ciclo de classes. */
function horariosDoDia(
  dia: Date,
  regra: DiaDisponivel,
  mistura: SlotClass[],
  passoInicial: number,
): Array<{ classe: SlotClass; inicio: Date; fim: Date }> {
  if (!regra.ativo || mistura.length === 0) return []

  const blocos: Array<{ inicio: number; fim: number }> = []
  let cursor = regra.inicio
  for (const p of [...regra.pausas].sort((a, b) => a.inicio - b.inicio)) {
    if (p.inicio > cursor) blocos.push({ inicio: cursor, fim: p.inicio })
    cursor = Math.max(cursor, p.fim)
  }
  if (cursor < regra.fim) blocos.push({ inicio: cursor, fim: regra.fim })

  const saida: Array<{ classe: SlotClass; inicio: Date; fim: Date }> = []
  let passo = passoInicial
  for (const bloco of blocos) {
    let minuto = bloco.inicio
    while (minuto < bloco.fim) {
      const classe = mistura[passo % mistura.length]
      const duracao = DURACAO[classe]
      if (minuto + duracao > bloco.fim) break
      saida.push({
        classe,
        inicio: comMinutos(dia, minuto),
        fim: comMinutos(dia, minuto + duracao),
      })
      minuto += duracao + BUFFER[classe]
      passo++
    }
  }
  return saida
}

/**
 * Reconcilia as vagas de um consultório com a regra, até o horizonte.
 *
 * Cria o que falta, apaga o que sobrou — e preserva, sem exceção, toda vaga
 * que já tem consulta marcada.
 */
export async function materializar(
  resourceId: string,
  semanas = HORIZONTE_SEMANAS,
): Promise<{ criadas: number; removidas: number }> {
  const recurso = await queryOne<{ id: string; ordem: number; mistura: SlotClass[]; ativo: boolean }>(
    `SELECT id, ordem, mistura, ativo FROM scheduling_resources WHERE id = $1`,
    resourceId,
  )
  if (!recurso) throw new ErroDeCaso('NOT_FOUND', 'Consultório não encontrado.')

  const regras = await queryAll<{
    weekday: number
    ativo: boolean
    inicio_min: number
    fim_min: number
    pausas: Pausa[]
  }>(`SELECT * FROM scheduling_availability WHERE resource_id = $1`, resourceId)

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const limite = new Date(hoje)
  limite.setDate(limite.getDate() + semanas * 7)

  const desejados = new Map<string, { classe: SlotClass; inicio: Date; fim: Date }>()
  if (recurso.ativo) {
    // O deslocamento por consultório mantém a mistura variada entre as salas:
    // sem ele, todas abrem o mesmo tamanho de vaga no mesmo horário.
    let passo = recurso.ordem
    for (let d = new Date(hoje); d < limite; d.setDate(d.getDate() + 1)) {
      const regra = regras.find((r) => r.weekday === d.getDay())
      if (!regra?.ativo) continue
      const doDia = horariosDoDia(
        new Date(d),
        {
          weekday: regra.weekday,
          ativo: regra.ativo,
          inicio: regra.inicio_min,
          fim: regra.fim_min,
          pausas: regra.pausas ?? [],
        },
        recurso.mistura ?? ['STANDARD'],
        passo,
      )
      // A chave carrega a classe: mudar a mistura muda a vaga daquele horário,
      // e casar só por horário deixaria a vaga antiga sobreviver com o tamanho
      // errado — a agenda passaria a oferecer o que a regra não oferece mais.
      for (const h of doDia) desejados.set(`${h.inicio.toISOString()}|${h.classe}`, h)
      passo += doDia.length
    }
  }

  const existentes = await queryAll<{
    id: string
    starts_at: string
    slot_class: SlotClass
    ocupada: boolean
  }>(
    `SELECT s.id, s.starts_at, s.slot_class,
            EXISTS (
              SELECT 1 FROM scheduling_bookings b
               WHERE b.slot_id = s.id AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
            ) AS ocupada
       FROM scheduling_slots s
      WHERE s.resource_id = $1 AND s.starts_at >= $2 AND s.starts_at < $3`,
    resourceId,
    hoje.toISOString(),
    limite.toISOString(),
  )

  let criadas = 0
  let removidas = 0

  await transaction(async () => {
    for (const e of existentes) {
      const chave = `${new Date(e.starts_at).toISOString()}|${e.slot_class}`
      if (desejados.has(chave)) {
        desejados.delete(chave)
        continue
      }
      if (e.ocupada) continue
      const { changes } = await execute(`DELETE FROM scheduling_slots WHERE id = $1`, e.id)
      removidas += changes
    }

    for (const [chave, h] of desejados) {
      const { changes } = await execute(
        `INSERT INTO scheduling_slots (id, resource_id, slot_class, starts_at, ends_at, status)
         VALUES ($1,$2,$3,$4,$5,'OPEN')
         ON CONFLICT (resource_id, starts_at) DO NOTHING`,
        `${resourceId}:${chave}`,
        resourceId,
        h.classe,
        h.inicio.toISOString(),
        h.fim.toISOString(),
      )
      criadas += changes
    }
  })

  return { criadas, removidas }
}

/** Materializa todos os consultórios — usado no boot e depois de editar sala. */
export async function materializarTudo(): Promise<{ criadas: number; removidas: number }> {
  const recursos = await queryAll<{ id: string }>(`SELECT id FROM scheduling_resources`)
  let criadas = 0
  let removidas = 0
  for (const r of recursos) {
    const parcial = await materializar(r.id)
    criadas += parcial.criadas
    removidas += parcial.removidas
  }
  return { criadas, removidas }
}

/** Disponibilidade inicial: dias úteis, 8h–17h com pausa de almoço. */
export async function semearDisponibilidadePadrao(): Promise<void> {
  const recursos = await queryAll<{ id: string }>(`SELECT id FROM scheduling_resources`)
  for (const r of recursos) {
    const jaTem = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM scheduling_availability WHERE resource_id = $1`,
      r.id,
    )
    if ((jaTem?.total ?? 0) > 0) continue
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
