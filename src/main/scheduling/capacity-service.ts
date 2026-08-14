import { execute, queryAll, queryOne, transaction } from '../db/query'
import { garantirContaSintetica } from '../auth/session'
import { ErroDeCaso, type SlotClass } from '../../shared/clinical/caso'
import { BUFFER_POR_CLASSE, DURACAO_POR_CLASSE } from '../../shared/clinical/carga'

/**
 * Capacidade da agenda: consultórios e as vagas que eles oferecem.
 *
 * Aqui mora a diferença entre um app de demonstração e um app operável: a
 * oferta deixa de ser constante compilada e passa a ser algo que a operação
 * edita. Quem sabe quantos consultórios existem e a que horas eles abrem é o
 * serviço, não quem escreveu o seed.
 *
 * Duas recusas guiam tudo: vaga com consulta marcada não é apagada nem movida
 * por gestão de capacidade — remarcar é decisão de agenda, com motivo e autoria
 * —, e desativar consultório não some com o que já foi combinado com alguém.
 */

// Duração e buffer vêm da mesma regra que calcula o requisito: se um dia a
// vaga rápida mudar de 20 minutos, a agenda muda junto sem ninguém lembrar.
const DURACAO = DURACAO_POR_CLASSE
const BUFFER: Record<SlotClass, number> = {
  QUICK: BUFFER_POR_CLASSE.RAPIDA,
  STANDARD: BUFFER_POR_CLASSE.NORMAL,
  EXTENDED: BUFFER_POR_CLASSE.ESTENDIDA,
}

export const CAPABILITIES_CONHECIDAS = [
  { id: 'SALA_ACESSIVEL', rotulo: 'Sala acessível' },
  { id: 'ESPACO_ACOMPANHANTE', rotulo: 'Espaço para acompanhante' },
  { id: 'APOIO_COMUNICACAO', rotulo: 'Apoio à comunicação' },
] as const

export type RecursoDTO = {
  id: string
  nome: string
  kind: string
  capabilities: string[]
  ordem: number
  ativo: boolean
  /** Vagas futuras, para a tela dizer o tamanho da oferta sem contar na mão. */
  vagasFuturas: number
  vagasOcupadas: number
}

export async function listarRecursos(): Promise<RecursoDTO[]> {
  return queryAll<RecursoDTO>(
    `SELECT r.id, r.nome, r.kind, r.capabilities, r.ordem, r.ativo,
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
}

function exigirTexto(valor: string, campo: string, min: number, max: number): string {
  const limpo = valor?.trim() ?? ''
  if (limpo.length < min || limpo.length > max) {
    throw new ErroDeCaso('VALIDATION_ERROR', `${campo} precisa ter entre ${min} e ${max} caracteres.`)
  }
  return limpo
}

function idDoNome(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `consultorio-${Date.now()}`
}

/**
 * Cria ou edita um consultório.
 *
 * `capabilities` não é enfeite: é o que o requisito do caso consulta para saber
 * se a sala serve. Tirar uma capability de um consultório muda quem cabe nele
 * daqui para frente — as consultas já marcadas continuam onde estão.
 */
export async function salvarRecurso(entrada: {
  id?: string
  nome: string
  capabilities: string[]
  ativo?: boolean
}): Promise<RecursoDTO> {
  await garantirContaSintetica()
  const nome = exigirTexto(entrada.nome, 'O nome do consultório', 2, 80)
  const capabilities = entrada.capabilities.filter((c) =>
    CAPABILITIES_CONHECIDAS.some((k) => k.id === c),
  )
  const id = entrada.id ?? idDoNome(nome)

  const existente = await queryOne<{ id: string }>(
    `SELECT id FROM scheduling_resources WHERE id = $1`,
    id,
  )

  if (existente) {
    await execute(
      `UPDATE scheduling_resources SET nome = $2, capabilities = $3::jsonb, ativo = $4 WHERE id = $1`,
      id,
      nome,
      JSON.stringify(capabilities),
      entrada.ativo ?? true,
    )
  } else {
    const ultima = await queryOne<{ maior: number }>(
      `SELECT COALESCE(MAX(ordem), 0) AS maior FROM scheduling_resources`,
    )
    await execute(
      `INSERT INTO scheduling_resources (id, nome, kind, capabilities, ordem, ativo)
       VALUES ($1,$2,'CONSULTORIO',$3::jsonb,$4,$5)`,
      id,
      nome,
      JSON.stringify(capabilities),
      (ultima?.maior ?? 0) + 1,
      entrada.ativo ?? true,
    )
  }

  const lista = await listarRecursos()
  const salvo = lista.find((r) => r.id === id)
  if (!salvo) throw new ErroDeCaso('NOT_FOUND', 'Consultório não encontrado depois de salvar.')
  return salvo
}

export type PlanoDeVagas = {
  resourceIds: string[]
  /** Datas `YYYY-MM-DD`, inclusive. */
  de: string
  ate: string
  /** 0 = domingo. Vazio significa todos os dias. */
  diasDaSemana: number[]
  /** Blocos em minutos do dia, ex.: 8h → 480. */
  blocos: Array<{ inicio: number; fim: number }>
  /** Sequência de classes repetida dentro de cada bloco. */
  mistura: SlotClass[]
}

function comMinutos(dia: Date, minutos: number): Date {
  const d = new Date(dia)
  d.setHours(0, 0, 0, 0)
  d.setMinutes(minutos)
  return d
}

/**
 * Gera vagas no intervalo, sem duplicar o que já existe.
 *
 * A unicidade `(resource_id, starts_at)` é quem garante que rodar duas vezes
 * não cria vaga repetida — a operação pode reexecutar o plano depois de mudar
 * um detalhe sem limpar nada antes.
 */
export async function gerarVagas(plano: PlanoDeVagas): Promise<{ criadas: number; puladas: number }> {
  await garantirContaSintetica()

  if (plano.resourceIds.length === 0) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Escolha pelo menos um consultório.')
  }
  if (plano.mistura.length === 0) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Escolha pelo menos um tipo de vaga.')
  }
  if (plano.blocos.length === 0) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Defina pelo menos um período de atendimento.')
  }
  for (const b of plano.blocos) {
    if (b.fim <= b.inicio) {
      throw new ErroDeCaso('VALIDATION_ERROR', 'Cada período precisa terminar depois de começar.')
    }
  }

  const inicio = new Date(`${plano.de}T00:00:00`)
  const fim = new Date(`${plano.ate}T00:00:00`)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'Datas inválidas.')
  }
  if (fim < inicio) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'A data final precisa ser igual ou posterior à inicial.')
  }
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000)
  if (dias > 180) {
    throw new ErroDeCaso('VALIDATION_ERROR', 'O intervalo máximo de geração é de 180 dias.')
  }

  let criadas = 0
  let puladas = 0

  await transaction(async () => {
    for (const [indice, resourceId] of plano.resourceIds.entries()) {
      const recurso = await queryOne<{ id: string }>(
        `SELECT id FROM scheduling_resources WHERE id = $1`,
        resourceId,
      )
      if (!recurso) throw new ErroDeCaso('NOT_FOUND', `Consultório ${resourceId} não existe.`)

      // Cada consultório entra num ponto diferente do ciclo: sem isso, todos
      // abrem a mesma vaga no mesmo horário e a agenda fica sem variedade.
      let passo = indice

      for (let d = 0; d <= dias; d++) {
        const dia = new Date(inicio)
        dia.setDate(inicio.getDate() + d)
        if (plano.diasDaSemana.length > 0 && !plano.diasDaSemana.includes(dia.getDay())) continue

        for (const bloco of plano.blocos) {
          let minuto = bloco.inicio
          while (minuto < bloco.fim) {
            const classe = plano.mistura[passo % plano.mistura.length]
            const duracao = DURACAO[classe]
            if (minuto + duracao > bloco.fim) break

            const comeco = comMinutos(dia, minuto)
            const termino = comMinutos(dia, minuto + duracao)
            const slotId = `${resourceId}:${comeco.toISOString()}`

            const { changes } = await execute(
              `INSERT INTO scheduling_slots (id, resource_id, slot_class, starts_at, ends_at, status)
               VALUES ($1,$2,$3,$4,$5,'OPEN')
               ON CONFLICT (resource_id, starts_at) DO NOTHING`,
              slotId,
              resourceId,
              classe,
              comeco.toISOString(),
              termino.toISOString(),
            )
            if (changes > 0) criadas++
            else puladas++

            minuto += duracao + BUFFER[classe]
            passo++
          }
        }
      }
    }
  })

  return { criadas, puladas }
}

/**
 * Apaga vagas livres de um intervalo.
 *
 * Só some o que ninguém marcou. Vaga com consulta é combinado com uma pessoa —
 * desfazer isso é remarcar ou cancelar, com motivo, não faxina de capacidade.
 */
export async function removerVagasLivres(entrada: {
  resourceId?: string
  de: string
  ate: string
}): Promise<{ removidas: number; preservadas: number }> {
  const inicio = new Date(`${entrada.de}T00:00:00`).toISOString()
  const fim = new Date(`${entrada.ate}T23:59:59`).toISOString()

  const ocupadas = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total
       FROM scheduling_slots s
      WHERE s.starts_at BETWEEN $1 AND $2
        AND ($3::text IS NULL OR s.resource_id = $3)
        AND EXISTS (
          SELECT 1 FROM scheduling_bookings b
           WHERE b.slot_id = s.id AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
        )`,
    inicio,
    fim,
    entrada.resourceId ?? null,
  )

  const { changes } = await execute(
    `DELETE FROM scheduling_slots s
      WHERE s.starts_at BETWEEN $1 AND $2
        AND ($3::text IS NULL OR s.resource_id = $3)
        AND NOT EXISTS (SELECT 1 FROM scheduling_bookings b WHERE b.slot_id = s.id)`,
    inicio,
    fim,
    entrada.resourceId ?? null,
  )

  return { removidas: changes, preservadas: ocupadas?.total ?? 0 }
}

/** Fecha uma vaga com motivo — férias, manutenção, sala emprestada. */
export async function bloquearVaga(entrada: {
  slotId: string
  motivo: string
}): Promise<void> {
  const motivo = exigirTexto(entrada.motivo, 'O motivo do bloqueio', 5, 200)

  const ocupada = await queryOne<{ id: string }>(
    `SELECT b.id FROM scheduling_bookings b
      WHERE b.slot_id = $1 AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED')`,
    entrada.slotId,
  )
  if (ocupada) {
    throw new ErroDeCaso(
      'SLOT_TAKEN',
      'Esta vaga tem consulta marcada. Cancele ou remarque a consulta antes de bloquear.',
    )
  }

  await execute(
    `UPDATE scheduling_slots SET status = 'BLOCKED', block_reason = $2 WHERE id = $1`,
    entrada.slotId,
    motivo,
  )
}

export async function liberarVaga(slotId: string): Promise<void> {
  await execute(
    `UPDATE scheduling_slots SET status = 'OPEN', block_reason = NULL WHERE id = $1`,
    slotId,
  )
}

/** Resumo da oferta futura, por classe — o que a tela mostra em uma linha. */
export async function resumoDaOferta(): Promise<{
  porClasse: Array<{ slotClass: SlotClass; livres: number; ocupadas: number }>
  ate: string | null
}> {
  const porClasse = await queryAll<{ slotClass: SlotClass; livres: number; ocupadas: number }>(
    `SELECT s.slot_class AS "slotClass",
            COUNT(*) FILTER (WHERE s.status = 'OPEN' AND NOT EXISTS (
              SELECT 1 FROM scheduling_bookings b
               WHERE b.slot_id = s.id AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
            ))::int AS livres,
            COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM scheduling_bookings b
               WHERE b.slot_id = s.id AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED')
            ))::int AS ocupadas
       FROM scheduling_slots s
      WHERE s.starts_at >= NOW()
      GROUP BY s.slot_class`,
  )
  const limite = await queryOne<{ ate: string | null }>(
    `SELECT MAX(starts_at)::text AS ate FROM scheduling_slots`,
  )
  return { porClasse, ate: limite?.ate ?? null }
}
