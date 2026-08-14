/**
 * VITRINE — modelo de resposta dos widgets pré-anestésicos.
 *
 * Duas leis do produto moldam este arquivo:
 *
 * 1. Ausência de resposta não significa negativa. Por isso `Resposta<T>` tem
 *    estado próprio: o silêncio (`NAO_PERGUNTADO`) é distinto do "não" que a
 *    enfermagem ouviu e registrou (`RESPONDIDO` com valor `false`).
 * 2. O bloco não é marcado como tratado por um botão. Ele se torna tratado
 *    quando a pergunta que o define recebe resposta — o estado é consequência
 *    do preenchimento, não uma etiqueta que alguém escolhe.
 */

export type EstadoResposta =
  | 'NAO_PERGUNTADO'
  | 'RESPONDIDO'
  | 'NAO_SABE'
  | 'RECUSOU'
  | 'NAO_SE_APLICA'
  | 'NAO_REALIZADO'

export type Resposta<T> = {
  estado: EstadoResposta
  valor?: T
}

export const NAO_PERGUNTADO: Resposta<never> = { estado: 'NAO_PERGUNTADO' }

export function responder<T>(valor: T): Resposta<T> {
  return { estado: 'RESPONDIDO', valor }
}

/** A pergunta foi tratada? `NAO_PERGUNTADO` é o único silêncio real. */
export function tratada(r: Resposta<unknown> | undefined): boolean {
  return !!r && r.estado !== 'NAO_PERGUNTADO'
}

/** A resposta é um sim documentado? Só isso conta como sinal para a agenda. */
export function positiva(r: Resposta<boolean> | undefined): boolean {
  return r?.estado === 'RESPONDIDO' && r.valor === true
}

export const ROTULO_ESTADO: Record<EstadoResposta, string> = {
  NAO_PERGUNTADO: 'Ainda não perguntado',
  RESPONDIDO: 'Respondido',
  NAO_SABE: 'Não sabe informar',
  RECUSOU: 'Preferiu não responder',
  NAO_SE_APLICA: 'Não se aplica',
  NAO_REALIZADO: 'Não aferido',
}

/* ══════════════ dados por widget ══════════════ */

export type Gravidade = 'LEVE' | 'MODERADA' | 'GRAVE'
export type TipoReacao = 'ALERGIA' | 'INTOLERANCIA' | 'OUTRA_REACAO'
export type FonteSubstancia = 'MEDICAMENTO' | 'ALIMENTO' | 'LATEX' | 'OUTRA'

export type ItemAlergia = {
  id: string
  fonte: FonteSubstancia
  substancia: string
  /** Classe terapêutica quando a substância veio do catálogo de medicamentos. */
  classe?: string
  reacao: string
  gravidade?: Gravidade
  tipo?: TipoReacao
}

export type DadosAlergias = {
  temAlergia: Resposta<boolean>
  itens: ItemAlergia[]
}

export type ItemMedicacao = {
  id: string
  nome: string
  classe: string
  dose?: string
  frequencia?: string
  ultimoUso?: string
}

export type DadosMedicacoes = {
  usaMedicacao: Resposta<boolean>
  itens: ItemMedicacao[]
}

export type ItemDiagnostico = {
  id: string
  codigo: string
  descricao: string
  capitulo: string
  sintomasAtuais?: string
  /** Frase do próprio paciente sobre o controle da condição. */
  controlePaciente?: string
}

export type DadosDiagnosticos = {
  temDiagnostico: Resposta<boolean>
  itens: ItemDiagnostico[]
}

export type DadosHistoriaAnestesica = {
  anestesiaPrevia: Resposta<boolean>
  complicacaoPessoal: Resposta<boolean>
  descricaoComplicacao?: string
  viaAereaDificil: Resposta<boolean>
  nauseaVomitoPos: Resposta<boolean>
  complicacaoFamiliar: Resposta<boolean>
}

export type DadosCardiovascular = {
  dorToracica: Resposta<boolean>
  dispneiaRepouso: Resposta<boolean>
  sincope: Resposta<boolean>
  palpitacao: Resposta<boolean>
  edema: Resposta<boolean>
  detalhe?: string
}

export type DadosRespiratorio = {
  dispneia: Resposta<boolean>
  sibilo: Resposta<boolean>
  infeccaoRecente: Resposta<boolean>
  apneiaSono: Resposta<boolean>
  suporteRespiratorio: Resposta<boolean>
  descricaoSuporte?: string
}

export type DadosSangramento = {
  sangramentoAnormal: Resposta<boolean>
  trombosePrevia: Resposta<boolean>
  anticoagulante: Resposta<boolean>
  detalhe?: string
}

export type MedidaVital = Resposta<number>

export type DadosSinaisVitais = {
  sistolica: MedidaVital
  diastolica: MedidaVital
  frequenciaCardiaca: MedidaVital
  saturacao: MedidaVital
  peso: MedidaVital
  altura: MedidaVital
}

export type DadosCapacidadeFuncional = {
  atividade: Resposta<string>
  /** MET do catálogo, guardado como metadado da atividade — nunca do paciente. */
  metCatalogo?: number
  limitadoPorSintoma: Resposta<boolean>
  descricaoLimitacao?: string
}

export type DadosAcomodacao = {
  comunicacao: Resposta<boolean>
  descricaoComunicacao?: string
  mobilidade: Resposta<boolean>
  descricaoMobilidade?: string
  representanteLegal: Resposta<boolean>
}

export type UsoSubstancia = 'NUNCA' | 'EX_USUARIO' | 'ATUAL'

export type DadosHabitos = {
  tabaco: Resposta<UsoSubstancia>
  detalheTabaco?: string
  alcool: Resposta<UsoSubstancia>
  detalheAlcool?: string
  outrasSubstancias: Resposta<boolean>
}

export type DadosCondicoesEspeciais = {
  gestante: Resposta<boolean>
  semanasGestacao?: number
  lactante: Resposta<boolean>
  outraCondicao?: string
}

export type StatusExame = 'DISPONIVEL' | 'SOLICITADO' | 'AUSENTE'

export type ItemExame = {
  id: string
  nome: string
  status: StatusExame
  data?: string
}

export type DadosExames = {
  itens: ItemExame[]
}

export type DadosContexto = {
  indicacao: string
  dataPlanejada?: string
  lateralidade?: string
  observacaoEncaminhamento?: string
}

export type DadosObservacoes = {
  nota: string
  autor?: string
  horario?: string
}
