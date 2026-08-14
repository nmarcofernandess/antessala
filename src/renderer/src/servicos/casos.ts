import { client, temPersistencia } from './client'
import { codigoDoErro, type CodigoErroCaso } from '@shared/clinical/caso'

/**
 * A fronteira do renderer com o domínio do caso.
 *
 * Nada aqui decide: são chamadas tipadas para o processo principal, mais a
 * tradução do erro para algo que a tela consiga tratar. Sem SQL, sem regra, sem
 * ator — o renderer não sabe quem está agindo, e não precisa saber.
 */

export class ErroDeComando extends Error {
  constructor(
    readonly codigo: CodigoErroCaso | null,
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'ErroDeComando'
  }
}

/** Limpa o embrulho do IPC e recupera o código de domínio. */
export function traduzirErro(erro: unknown): ErroDeComando {
  const bruto = (erro instanceof Error ? erro.message : String(erro))
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
  const codigo = codigoDoErro(bruto)
  const limpo = codigo ? bruto.replace(new RegExp(`^${codigo}:\\s*`), '') : bruto
  return new ErroDeComando(codigo, limpo)
}

async function chamar<T>(fn: () => Promise<T>): Promise<T> {
  if (!temPersistencia) {
    throw new ErroDeComando(
      null,
      'Esta tela precisa do banco local e só funciona dentro do aplicativo.',
    )
  }
  try {
    return await fn()
  } catch (erro) {
    throw traduzirErro(erro)
  }
}

/* ══════════════ casos ══════════════ */

export const casos = {
  criar: (input: Parameters<typeof client['cases.create']>[0]) =>
    chamar(() => client['cases.create'](input)),
  listar: (filtro?: Parameters<typeof client['cases.listForActor']>[0]) =>
    chamar(() => client['cases.listForActor'](filtro)),
  obter: (caseId: string) => chamar(() => client['cases.get']({ caseId })),
  contagens: () => chamar(() => client['cases.counts']()),
  servicos: () => chamar(() => client['cases.servicos']()),
  aceitarHandoff: (input: Parameters<typeof client['handoffs.acknowledge']>[0]) =>
    chamar(() => client['handoffs.acknowledge'](input)),
}

/* ══════════════ anamnese ══════════════ */

export const anamnese = {
  abrir: (caseId: string) => chamar(() => client['anamnesis.open']({ caseId })),
  obter: (caseId: string) => chamar(() => client['anamnesis.get']({ caseId })),
  salvar: (input: Parameters<typeof client['anamnesis.saveDraft']>[0]) =>
    chamar(() => client['anamnesis.saveDraft'](input)),
  finalizar: (input: Parameters<typeof client['anamnesis.finalize']>[0]) =>
    chamar(() => client['anamnesis.finalize'](input)),
}

/* ══════════════ requisito ══════════════ */

export const requisitos = {
  calcular: (caseId: string) => chamar(() => client['requirements.calculate']({ caseId })),
  confirmar: (input: Parameters<typeof client['requirements.confirm']>[0]) =>
    chamar(() => client['requirements.confirm'](input)),
  doCaso: (caseId: string) => chamar(() => client['requirements.getForCase']({ caseId })),
}

/* ══════════════ agenda ══════════════ */

export const agenda = {
  intervalo: (de: string, ate: string) => chamar(() => client['scheduling.range']({ de, ate })),
  vagasCompativeis: (input: Parameters<typeof client['scheduling.compatibleSlots']>[0]) =>
    chamar(() => client['scheduling.compatibleSlots'](input)),
  reservar: (input: Parameters<typeof client['scheduling.book']>[0]) =>
    chamar(() => client['scheduling.book'](input)),
  mover: (input: Parameters<typeof client['scheduling.move']>[0]) =>
    chamar(() => client['scheduling.move'](input)),
  cancelar: (input: Parameters<typeof client['scheduling.cancel']>[0]) =>
    chamar(() => client['scheduling.cancel'](input)),
  fila: () => chamar(() => client['scheduling.queue']()),
}

/** Chave de idempotência do comando — protege contra o clique duplo. */
export function novaChave(): string {
  return globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
