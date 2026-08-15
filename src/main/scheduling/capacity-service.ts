import { execute, queryAll, queryOne, transaction } from '../db/query'
import { garantirContaSintetica } from '../auth/session'
import { ErroDeCaso, type SlotClass } from '../../shared/clinical/caso'
/**
 * Capacidade da agenda: consultórios e as vagas que eles oferecem.
 *
 * Aqui mora a diferença entre um app de demonstração e um app operável: a
 * oferta deixa de ser constante compilada e passa a ser algo que a operação
 * edita. Quem sabe quantos consultórios existem e a que horas eles abrem é o
 * serviço, não quem escreveu o seed.
 *
 * Aqui moram as salas. **Quando** elas atendem é outra coisa, e vive em
 * `availability-service`: a regra semanal, de onde as vagas são materializadas.
 *
 * Uma recusa guia tudo: vaga com consulta marcada não é apagada nem bloqueada
 * por gestão de capacidade — desmarcar alguém é decisão de agenda, com motivo e
 * autoria.
 */

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
