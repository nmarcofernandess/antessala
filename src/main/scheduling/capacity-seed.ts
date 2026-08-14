import { execute, queryOne } from '../db/query'
import type { SlotClass } from '../../shared/clinical/caso'

/**
 * Capacidade inicial da agenda pré-anestésica.
 *
 * Isto é só o ponto de partida do primeiro boot: três consultórios e quatro
 * semanas, para que o app não abra com agenda vazia. Depois disso quem manda é
 * a tela de Capacidade — criar sala, mudar horário, gerar mais período — e o
 * banco, contra o qual as reservas são gravadas. Não é fixture de tela.
 *
 * A agenda é da consulta pré-anestésica. Nenhuma linha daqui representa sala
 * cirúrgica, e o produto não agenda cirurgia.
 */

const CONSULTORIOS = [
  { id: 'consultorio-1', nome: 'Consultório 1', ordem: 1, capabilities: ['SALA_ACESSIVEL', 'ESPACO_ACOMPANHANTE'] },
  { id: 'consultorio-2', nome: 'Consultório 2', ordem: 2, capabilities: ['ESPACO_ACOMPANHANTE'] },
  { id: 'consultorio-3', nome: 'Consultório 3', ordem: 3, capabilities: ['SALA_ACESSIVEL', 'APOIO_COMUNICACAO'] },
] as const

const DURACAO: Record<SlotClass, number> = { QUICK: 20, STANDARD: 35, EXTENDED: 50 }
const BUFFER: Record<SlotClass, number> = { QUICK: 5, STANDARD: 5, EXTENDED: 10 }

/** Cada consultório começa o dia num ponto diferente do ciclo, para haver mistura. */
const CICLO: SlotClass[] = ['STANDARD', 'QUICK', 'EXTENDED', 'STANDARD', 'QUICK']

const PERIODOS = [
  { inicio: 8 * 60, fim: 12 * 60 },
  { inicio: 13 * 60 + 30, fim: 17 * 60 },
]

const DIAS_A_FRENTE = 28

function comMinutos(base: Date, minutosDoDia: number): Date {
  const d = new Date(base)
  d.setHours(0, 0, 0, 0)
  d.setMinutes(minutosDoDia)
  return d
}

/**
 * Gera vagas para os próximos dias úteis, sem duplicar o que já existe.
 *
 * A unicidade por `(resource_id, starts_at)` é quem garante idempotência: rodar
 * duas vezes não cria vaga repetida, e a reserva já gravada numa vaga
 * preexistente continua de pé.
 */
export async function semearCapacidade(hoje = new Date()): Promise<{ criadas: number }> {
  for (const c of CONSULTORIOS) {
    await execute(
      `INSERT INTO scheduling_resources (id, nome, kind, capabilities, ordem)
       VALUES ($1,$2,'CONSULTORIO',$3::jsonb,$4)
       ON CONFLICT (id) DO NOTHING`,
      c.id,
      c.nome,
      JSON.stringify(c.capabilities),
      c.ordem,
    )
  }

  let criadas = 0
  const inicio = new Date(hoje)
  inicio.setHours(0, 0, 0, 0)

  for (let dia = 0; dia < DIAS_A_FRENTE; dia++) {
    const data = new Date(inicio)
    data.setDate(inicio.getDate() + dia)
    const semana = data.getDay()
    if (semana === 0 || semana === 6) continue

    for (const [indice, consultorio] of CONSULTORIOS.entries()) {
      let passo = indice
      for (const periodo of PERIODOS) {
        let minuto = periodo.inicio
        while (minuto < periodo.fim) {
          const classe = CICLO[passo % CICLO.length]
          const duracao = DURACAO[classe]
          const ocupacao = duracao + BUFFER[classe]
          if (minuto + duracao > periodo.fim) break

          const comeco = comMinutos(data, minuto)
          const fim = comMinutos(data, minuto + duracao)
          const slotId = `${consultorio.id}:${comeco.toISOString()}`

          const { changes } = await execute(
            `INSERT INTO scheduling_slots (id, resource_id, slot_class, starts_at, ends_at, status)
             VALUES ($1,$2,$3,$4,$5,'OPEN')
             ON CONFLICT (resource_id, starts_at) DO NOTHING`,
            slotId,
            consultorio.id,
            classe,
            comeco.toISOString(),
            fim.toISOString(),
          )
          criadas += changes

          minuto += ocupacao
          passo++
        }
      }
    }
  }

  if (criadas > 0) {
    console.log(`[agenda] ${criadas} vagas de consulta pré-anestésica geradas.`)
  }
  return { criadas }
}

/** Garante que existe capacidade adiante mesmo depois de o app ficar dias fechado. */
export async function garantirCapacidadeFutura(): Promise<void> {
  const linha = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM scheduling_slots WHERE starts_at > NOW()`,
  )
  if ((linha?.total ?? 0) < 40) await semearCapacidade()
}
