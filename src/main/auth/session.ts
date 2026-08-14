import { execute, queryOne } from '../db/query'
import type { ActorSnapshot, Papel } from '../../shared/clinical/caso'

/**
 * Ator do comando — resolvido **somente aqui**, no processo principal.
 *
 * A demonstração tem uma conta sintética integrada que enxerga todas as
 * ferramentas. Isso não a transforma num superpapel sem regra: cada comando
 * declara sob qual responsabilidade está agindo, e é essa responsabilidade que
 * fica gravada no evento. Quem abriu o caso agiu como recepção; quem finalizou a
 * entrevista agiu como enfermagem — mesma conta, autorias distintas.
 *
 * O renderer nunca envia ator. Se enviasse, seria ignorado: identidade vinda da
 * tela é sugestão, não autoridade.
 */

export const CONTA_SINTETICA = {
  id: 'conta-demo',
  nome: 'Conta da demonstração',
  conta: 'demonstracao-integrada',
} as const

let garantida = false

/** Cria a conta sintética uma vez por banco. Idempotente. */
export async function garantirContaSintetica(): Promise<void> {
  if (garantida) return
  await execute(
    `INSERT INTO usuarios (id, nome, conta) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    CONTA_SINTETICA.id,
    CONTA_SINTETICA.nome,
    CONTA_SINTETICA.conta,
  )
  garantida = true
}

/**
 * O ator de um comando, sob a responsabilidade declarada pelo próprio comando.
 *
 * O papel não vem do renderer: cada ação do main sabe qual responsabilidade
 * exerce. `cases.create` é sempre recepção; `anamnesis.finalize` é sempre
 * enfermagem. A tela não escolhe.
 */
export function ator(papel: Papel): ActorSnapshot {
  return {
    actorId: CONTA_SINTETICA.id,
    displayName: CONTA_SINTETICA.nome,
    role: papel,
  }
}

/** Só para teste: força a próxima chamada a reinserir a conta. */
export function esquecerContaSintetica(): void {
  garantida = false
}

export async function contaExiste(): Promise<boolean> {
  const linha = await queryOne<{ id: string }>('SELECT id FROM usuarios WHERE id = $1', CONTA_SINTETICA.id)
  return Boolean(linha)
}
