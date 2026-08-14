/**
 * `demo-workload-v1` — a regra que traduz entrevista em minutos de vaga.
 *
 * Vinte minutos de base. Cada domínio com achado positivo soma cinco, e no
 * máximo três domínios pagam — o quarto em diante bate no teto e soma zero,
 * porque a entrevista não cresce indefinidamente com a lista de queixas. Volume
 * de medicação (≥5) e de diagnóstico (≥3) somam cinco cada, uma vez. A
 * acomodação soma dez e não entra no teto, porque ela não é sobre conversar: é
 * sobre a sala. Acima de cinquenta minutos a demonstração declara que saiu da
 * faixa em vez de truncar.
 *
 * A regra mora em `shared` e é executada pelo **processo principal**. O renderer
 * a reexibe para explicar o número na tela, mas quem publica requisito é o main:
 * compatibilidade autoritativa nunca sai do renderer.
 *
 * A regra não atribui risco, ASA, gravidade nem aptidão. Ela responde uma
 * pergunta operacional — quanto tempo esta conversa provavelmente leva — e cada
 * parcela é rastreável até o bloco que a produziu.
 */

import {
  positiva,
  tratada,
  type DadosAcomodacao,
  type DadosAcompanhante,
  type DadosAlergias,
  type DadosCapacidadeFuncional,
  type DadosCardiovascular,
  type DadosCondicoesEspeciais,
  type DadosContexto,
  type DadosDiagnosticos,
  type DadosExames,
  type DadosHabitos,
  type DadosHistoriaAnestesica,
  type DadosJejum,
  type DadosMedicacoes,
  type DadosObservacoes,
  type DadosRespiratorio,
  type DadosSangramento,
  type DadosSinaisVitais,
} from './anamnese-tipos'

export const BASE_MINUTOS = 20
export const TETO_DOMINIOS = 3

/** Classes de vaga do contrato. `FORA_DA_FAIXA` não é vaga: é recusa honesta. */
export type ClasseVaga = 'RAPIDA' | 'NORMAL' | 'ESTENDIDA' | 'FORA_DA_FAIXA'

/** Nome canônico da classe no domínio de agenda. */
export const CLASSE_CANONICA: Record<ClasseVaga, 'QUICK' | 'STANDARD' | 'EXTENDED' | null> = {
  RAPIDA: 'QUICK',
  NORMAL: 'STANDARD',
  ESTENDIDA: 'EXTENDED',
  FORA_DA_FAIXA: null,
}

export const BUFFER_POR_CLASSE: Record<ClasseVaga, number> = {
  RAPIDA: 5,
  NORMAL: 5,
  ESTENDIDA: 10,
  FORA_DA_FAIXA: 10,
}

export type Sinal = {
  rotulo: string
  origem: string
  minutos: number
  noTeto?: boolean
}

export type Requisito = {
  minutos: number
  classe: ClasseVaga
  sinais: Sinal[]
  /** Blocos da composição que ainda não receberam tratamento. */
  pendentes: string[]
  explicacao: string
}

/** Bloco persistido de uma anamnese. `dados` é o payload do widget. */
export type BlocoAnamnese = {
  id: string
  tipo: string
  dados: unknown
}

/**
 * O que a regra sabe sobre cada widget.
 *
 * Deliberadamente separado do registro visual: aqui não há ícone, componente
 * nem texto de tela. `tratado` decide completude, `sinal` decide minutos, e um
 * widget pode ter os dois, um ou nenhum — `vital_signs` é tratado mas nunca
 * soma; `escort_and_transport` é requisito de vaga que o cálculo não remunera.
 */
type Carga<D> = {
  nome: string
  tratado: (d: D) => boolean
  /** Domínio sujeito ao teto de três. */
  dominio?: boolean
  /** Minutos somados fora do teto. Só a acomodação usa. */
  minutosForaDoTeto?: number
  sinal?: (d: D) => boolean
}

const carga = <D,>(c: Carga<D>): Carga<never> => c as unknown as Carga<never>

export const CARGA_POR_WIDGET: Record<string, Carga<never>> = {
  procedure_context: carga<DadosContexto>({
    nome: 'Contexto do procedimento',
    tratado: (d) => d.indicacao.trim().length > 0,
  }),

  allergies: carga<DadosAlergias>({
    nome: 'Alergias',
    dominio: true,
    tratado: (d) => tratada(d.temAlergia),
    sinal: (d) => positiva(d.temAlergia),
  }),

  anesthesia_history: carga<DadosHistoriaAnestesica>({
    nome: 'História anestésica',
    dominio: true,
    tratado: (d) => tratada(d.anestesiaPrevia),
    sinal: (d) => positiva(d.complicacaoPessoal) || positiva(d.viaAereaDificil),
  }),

  cardiovascular: carga<DadosCardiovascular>({
    nome: 'Cardiovascular',
    dominio: true,
    tratado: (d) =>
      [d.dorToracica, d.dispneiaRepouso, d.sincope, d.palpitacao, d.edema].every(tratada),
    sinal: (d) =>
      [d.dorToracica, d.dispneiaRepouso, d.sincope, d.palpitacao, d.edema].some(positiva),
  }),

  respiratory: carga<DadosRespiratorio>({
    nome: 'Respiratório',
    dominio: true,
    tratado: (d) =>
      [d.dispneia, d.sibilo, d.infeccaoRecente, d.apneiaSono, d.suporteRespiratorio].every(tratada),
    sinal: (d) =>
      [d.dispneia, d.sibilo, d.infeccaoRecente, d.apneiaSono, d.suporteRespiratorio].some(positiva),
  }),

  bleeding_thrombosis: carga<DadosSangramento>({
    nome: 'Sangramento e trombose',
    dominio: true,
    tratado: (d) => [d.sangramentoAnormal, d.trombosePrevia, d.anticoagulante].every(tratada),
    sinal: (d) => [d.sangramentoAnormal, d.trombosePrevia, d.anticoagulante].some(positiva),
  }),

  medications: carga<DadosMedicacoes>({
    nome: 'Medicações em uso',
    tratado: (d) => tratada(d.usaMedicacao),
    // Volume, não domínio: o que custa tempo é conciliar muitos itens.
    sinal: (d) => positiva(d.usaMedicacao) && d.itens.length >= 5,
  }),

  diagnoses: carga<DadosDiagnosticos>({
    nome: 'Diagnósticos',
    tratado: (d) => tratada(d.temDiagnostico),
    sinal: (d) => positiva(d.temDiagnostico) && d.itens.length >= 3,
  }),

  accommodations: carga<DadosAcomodacao>({
    nome: 'Acomodação necessária',
    minutosForaDoTeto: 10,
    tratado: (d) => [d.comunicacao, d.mobilidade, d.representanteLegal].every(tratada),
    sinal: (d) => [d.comunicacao, d.mobilidade, d.representanteLegal].some(positiva),
  }),

  vital_signs: carga<DadosSinaisVitais>({
    nome: 'Sinais vitais',
    tratado: (d) =>
      [d.sistolica, d.diastolica, d.frequenciaCardiaca, d.saturacao, d.peso, d.altura].every(
        tratada,
      ),
  }),

  functional_capacity: carga<DadosCapacidadeFuncional>({
    nome: 'Capacidade funcional',
    tratado: (d) => tratada(d.atividade) && tratada(d.limitadoPorSintoma),
  }),

  habits_substances: carga<DadosHabitos>({
    nome: 'Hábitos e substâncias',
    dominio: true,
    tratado: (d) => [d.tabaco, d.alcool, d.outrasSubstancias].every(tratada),
    sinal: (d) =>
      d.tabaco.valor === 'ATUAL' || d.alcool.valor === 'ATUAL' || positiva(d.outrasSubstancias),
  }),

  special_conditions: carga<DadosCondicoesEspeciais>({
    nome: 'Condições especiais',
    dominio: true,
    tratado: (d) => tratada(d.gestante) && tratada(d.lactante),
    sinal: (d) => positiva(d.gestante) || positiva(d.lactante),
  }),

  exams_pending: carga<DadosExames>({
    nome: 'Exames',
    tratado: (d) => d.itens.length > 0,
  }),

  clinical_notes: carga<DadosObservacoes>({
    nome: 'Observações',
    tratado: (d) => d.nota.trim().length > 0,
  }),

  fasting_guidance: carga<DadosJejum>({
    nome: 'Orientação de jejum',
    tratado: (d) => tratada(d.orientado),
  }),

  escort_and_transport: carga<DadosAcompanhante>({
    nome: 'Acompanhante e retorno',
    // Requisito de vaga, não achado que paga tempo de conversa.
    tratado: (d) => tratada(d.temAcompanhante) && tratada(d.formaRetorno),
  }),
}

export function cargaDoWidget(tipo: string): Carga<never> | undefined {
  return CARGA_POR_WIDGET[tipo]
}

/**
 * Calcula o requisito da entrevista contra a composição aplicada ao caso.
 *
 * `composicao` é a lista de tipos que o protocolo pede. **Incluído é
 * obrigatório**: o que está nela precisa estar tratado para publicar; o que
 * ficou de fora nunca bloqueia, mesmo acrescentado depois.
 */
export function calcularRequisito(blocos: BlocoAnamnese[], composicao: string[]): Requisito {
  const sinais: Sinal[] = []
  let dominiosPagos = 0

  const exigidos = new Set(composicao)
  const tratadosPorTipo = new Map<string, boolean>()

  for (const b of blocos) {
    const def = cargaDoWidget(b.tipo)
    if (!def) continue

    const dados = b.dados as never

    // Um bloco do protocolo repetido conta como tratado se qualquer instância estiver.
    if (exigidos.has(b.tipo)) {
      tratadosPorTipo.set(b.tipo, (tratadosPorTipo.get(b.tipo) ?? false) || def.tratado(dados))
    }

    if (!def.sinal?.(dados)) continue

    if (def.minutosForaDoTeto) {
      sinais.push({ rotulo: def.nome, origem: b.tipo, minutos: def.minutosForaDoTeto })
      continue
    }

    if (def.dominio) {
      if (dominiosPagos < TETO_DOMINIOS) {
        sinais.push({ rotulo: def.nome, origem: b.tipo, minutos: 5 })
        dominiosPagos++
      } else {
        sinais.push({ rotulo: def.nome, origem: b.tipo, minutos: 0, noTeto: true })
      }
      continue
    }

    sinais.push({ rotulo: def.nome, origem: b.tipo, minutos: 5 })
  }

  // Pendência é bloco que a composição pede e o caso não resolveu — seja porque
  // ninguém respondeu, seja porque o bloco foi removido do caso.
  const pendentes = composicao
    .filter((tipo) => !tratadosPorTipo.get(tipo))
    .map((tipo) => cargaDoWidget(tipo)?.nome)
    .filter((nome): nome is string => !!nome)

  const minutos = BASE_MINUTOS + sinais.reduce((s, x) => s + x.minutos, 0)
  const classe: ClasseVaga =
    minutos === BASE_MINUTOS
      ? 'RAPIDA'
      : minutos <= 35
        ? 'NORMAL'
        : minutos <= 50
          ? 'ESTENDIDA'
          : 'FORA_DA_FAIXA'

  const pagos = sinais.filter((s) => s.minutos > 0)

  return {
    minutos,
    classe,
    sinais,
    pendentes,
    explicacao: pagos.length
      ? `Base de ${BASE_MINUTOS} min mais ${pagos
          .map((s) => `${s.rotulo.toLowerCase()} (+${s.minutos})`)
          .join(', ')}.`
      : `Base de ${BASE_MINUTOS} min. Nenhum achado somou tempo.`,
  }
}

/**
 * Duração canônica da vaga.
 *
 * O contrato de agenda só conhece 20, 35 e 50; a regra produz qualquer múltiplo
 * de cinco entre 20 e 50. A classe é quem manda, porque é ela que casa com o
 * template de slot — os minutos calculados continuam na explicação.
 */
export const DURACAO_POR_CLASSE: Record<'QUICK' | 'STANDARD' | 'EXTENDED', number> = {
  QUICK: 20,
  STANDARD: 35,
  EXTENDED: 50,
}
