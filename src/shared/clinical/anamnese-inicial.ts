/**
 * Estado inicial de um bloco de anamnese num caso real.
 *
 * Vazio quer dizer **não perguntado**, nunca "não". É a lei do produto virando
 * estrutura de dados: um caso recém-aberto não contém uma única negativa, porque
 * ninguém ainda conversou com a pessoa. A vitrine tem respostas de exemplo para
 * mostrar o widget preenchido; o caso de verdade nasce em silêncio.
 */

import { NAO_PERGUNTADO } from './anamnese-tipos'

const naoPerguntado = () => ({ ...NAO_PERGUNTADO })

const VAZIOS: Record<string, () => unknown> = {
  procedure_context: () => ({
    indicacao: '',
    dataPlanejada: undefined,
    lateralidade: undefined,
    observacaoEncaminhamento: undefined,
  }),
  allergies: () => ({ temAlergia: naoPerguntado(), itens: [] }),
  anesthesia_history: () => ({
    anestesiaPrevia: naoPerguntado(),
    complicacaoPessoal: naoPerguntado(),
    viaAereaDificil: naoPerguntado(),
    nauseaVomitoPos: naoPerguntado(),
    complicacaoFamiliar: naoPerguntado(),
  }),
  cardiovascular: () => ({
    dorToracica: naoPerguntado(),
    dispneiaRepouso: naoPerguntado(),
    sincope: naoPerguntado(),
    palpitacao: naoPerguntado(),
    edema: naoPerguntado(),
  }),
  respiratory: () => ({
    dispneia: naoPerguntado(),
    sibilo: naoPerguntado(),
    infeccaoRecente: naoPerguntado(),
    apneiaSono: naoPerguntado(),
    suporteRespiratorio: naoPerguntado(),
  }),
  bleeding_thrombosis: () => ({
    sangramentoAnormal: naoPerguntado(),
    trombosePrevia: naoPerguntado(),
    anticoagulante: naoPerguntado(),
  }),
  medications: () => ({ usaMedicacao: naoPerguntado(), itens: [] }),
  diagnoses: () => ({ temDiagnostico: naoPerguntado(), itens: [] }),
  accommodations: () => ({
    comunicacao: naoPerguntado(),
    mobilidade: naoPerguntado(),
    representanteLegal: naoPerguntado(),
  }),
  vital_signs: () => ({
    sistolica: naoPerguntado(),
    diastolica: naoPerguntado(),
    frequenciaCardiaca: naoPerguntado(),
    saturacao: naoPerguntado(),
    peso: naoPerguntado(),
    altura: naoPerguntado(),
  }),
  functional_capacity: () => ({
    atividade: naoPerguntado(),
    limitadoPorSintoma: naoPerguntado(),
  }),
  habits_substances: () => ({
    tabaco: naoPerguntado(),
    alcool: naoPerguntado(),
    outrasSubstancias: naoPerguntado(),
  }),
  special_conditions: () => ({ gestante: naoPerguntado(), lactante: naoPerguntado() }),
  exams_pending: () => ({ itens: [] }),
  clinical_notes: () => ({ nota: '' }),
  fasting_guidance: () => ({ orientado: naoPerguntado() }),
  escort_and_transport: () => ({
    temAcompanhante: naoPerguntado(),
    formaRetorno: naoPerguntado(),
  }),
}

export function dadosVazios(tipo: string): unknown {
  return VAZIOS[tipo]?.() ?? {}
}

export function existeWidget(tipo: string): boolean {
  return tipo in VAZIOS
}

/**
 * Materializa a composição do protocolo como blocos de um caso.
 *
 * IDs novos a cada aplicação: aplicar o mesmo protocolo duas vezes não pode
 * produzir dois blocos com o mesmo identificador.
 */
export function materializarComposicao(
  composicao: string[],
  gerarId: () => string,
): Array<{ id: string; tipo: string; dados: unknown }> {
  return composicao
    .filter(existeWidget)
    .map((tipo) => ({ id: gerarId(), tipo, dados: dadosVazios(tipo) }))
}
