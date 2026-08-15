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
  cancelar: (input: Parameters<typeof client['cases.cancel']>[0]) =>
    chamar(() => client['cases.cancel'](input)),
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
  chegada: (input: Parameters<typeof client['scheduling.checkIn']>[0]) =>
    chamar(() => client['scheduling.checkIn'](input)),
  ausencia: (input: Parameters<typeof client['scheduling.noShow']>[0]) =>
    chamar(() => client['scheduling.noShow'](input)),
}

export const capacidade = {
  consultorios: () => chamar(() => client['capacity.resources']()),
  salvarConsultorio: (input: Parameters<typeof client['capacity.saveResource']>[0]) =>
    chamar(() => client['capacity.saveResource'](input)),
  disponibilidade: () => chamar(() => client['capacity.availability']()),
  salvarDisponibilidade: (input: Parameters<typeof client['capacity.saveAvailability']>[0]) =>
    chamar(() => client['capacity.saveAvailability'](input)),
  bloquearVaga: (input: Parameters<typeof client['capacity.blockSlot']>[0]) =>
    chamar(() => client['capacity.blockSlot'](input)),
  liberarVaga: (slotId: string) => chamar(() => client['capacity.unblockSlot']({ slotId })),
  resumo: () => chamar(() => client['capacity.summary']()),
}

/* ══════════════ avaliação ══════════════ */

export const encontros = {
  iniciar: (input: Parameters<typeof client['encounters.start']>[0]) =>
    chamar(() => client['encounters.start'](input)),
  doCaso: (caseId: string) => chamar(() => client['encounters.get']({ caseId })),
  salvar: (input: Parameters<typeof client['encounters.saveAssessment']>[0]) =>
    chamar(() => client['encounters.saveAssessment'](input)),
  interromper: (input: Parameters<typeof client['encounters.interrupt']>[0]) =>
    chamar(() => client['encounters.interrupt'](input)),
  retomar: (input: Parameters<typeof client['encounters.resumeReview']>[0]) =>
    chamar(() => client['encounters.resumeReview'](input)),
}

export const pendencias = {
  abrir: (input: Parameters<typeof client['pendencies.open']>[0]) =>
    chamar(() => client['pendencies.open'](input)),
  responder: (input: Parameters<typeof client['pendencies.submitEvidence']>[0]) =>
    chamar(() => client['pendencies.submitEvidence'](input)),
  revisar: (input: Parameters<typeof client['pendencies.reviewEvidence']>[0]) =>
    chamar(() => client['pendencies.reviewEvidence'](input)),
  encerrar: (input: Parameters<typeof client['pendencies.cancel']>[0]) =>
    chamar(() => client['pendencies.cancel'](input)),
}

export const resultados = {
  doCaso: (caseId: string) => chamar(() => client['results.getForCase']({ caseId })),
  finalizar: (input: Parameters<typeof client['results.finalize']>[0]) =>
    chamar(() => client['results.finalize'](input)),
  revisar: (input: Parameters<typeof client['results.revise']>[0]) =>
    chamar(() => client['results.revise'](input)),
}

export const entregas = {
  enviar: (input: Parameters<typeof client['deliveries.send']>[0]) =>
    chamar(() => client['deliveries.send'](input)),
  confirmar: (input: Parameters<typeof client['deliveries.acknowledge']>[0]) =>
    chamar(() => client['deliveries.acknowledge'](input)),
}

/** Chave de idempotência do comando — protege contra o clique duplo. */
export function novaChave(): string {
  return globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
