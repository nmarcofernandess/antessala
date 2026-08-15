import { execute } from '../db/query'
import { materializarTudo, semearDisponibilidadePadrao } from './availability-service'

/**
 * Os consultórios do primeiro boot.
 *
 * Só as salas nascem aqui, para o app não abrir sem lugar nenhum de atender.
 * **Quando** cada uma atende é regra editável — vive em `scheduling_availability`
 * e é dela que as vagas são materializadas. Isto não é fixture de tela: é o
 * ponto de partida de uma configuração que a operação assume em seguida.
 *
 * A agenda é da consulta pré-anestésica. Nenhuma linha daqui representa sala
 * cirúrgica, e o produto não agenda cirurgia.
 */

const CONSULTORIOS = [
  { id: 'consultorio-1', nome: 'Consultório 1', ordem: 1, capabilities: ['SALA_ACESSIVEL', 'ESPACO_ACOMPANHANTE'] },
  { id: 'consultorio-2', nome: 'Consultório 2', ordem: 2, capabilities: ['ESPACO_ACOMPANHANTE'] },
  { id: 'consultorio-3', nome: 'Consultório 3', ordem: 3, capabilities: ['SALA_ACESSIVEL', 'APOIO_COMUNICACAO'] },
] as const

/**
 * Cria as salas, a disponibilidade padrão e materializa as vagas.
 *
 * Idempotente: rodar de novo não duplica sala nem vaga, e não sobrescreve a
 * disponibilidade que a operação já editou.
 */
export async function semearCapacidade(): Promise<{ criadas: number }> {
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

  await semearDisponibilidadePadrao()
  const { criadas } = await materializarTudo()
  if (criadas > 0) {
    console.log(`[agenda] ${criadas} vagas de consulta pré-anestésica materializadas.`)
  }
  return { criadas }
}

/** No boot, a agenda volta a cobrir o horizonte inteiro. */
export async function garantirCapacidadeFutura(): Promise<void> {
  await semearCapacidade()
}
