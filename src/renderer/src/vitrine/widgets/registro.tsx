/**
 * VITRINE — registro dos widgets pré-anestésicos e o caso que abre a tela.
 *
 * O caso é o de Marta Ribeiro Alves, 78 anos, artroplastia de quadril. Ele foi
 * escolhido porque exercita a regra inteira sem forçar: alergia grave, história
 * anestésica com complicação, sete medicações, quatro diagnósticos e uma
 * acomodação de sala — o suficiente para a consulta estourar o teto de domínios
 * e ainda assim caber na vaga estendida.
 */

import type { ComponentType } from 'react'
import {
  Accessibility,
  Activity,
  CalendarClock,
  Cigarette,
  ClipboardList,
  Droplets,
  FileText,
  Gauge,
  HeartPulse,
  Pill,
  ShieldAlert,
  Stethoscope,
  Syringe,
  UserRound,
  Wind,
  type LucideIcon,
} from 'lucide-react'

import { WidgetAlergias } from './Alergias'
import { WidgetDiagnosticos } from './Diagnosticos'
import { WidgetMedicacoes } from './Medicacoes'
import {
  WidgetCardiovascular,
  WidgetHistoriaAnestesica,
  WidgetRespiratorio,
  WidgetSangramento,
} from './Sistemas'
import { WidgetCapacidadeFuncional, WidgetSinaisVitais } from './Medidas'
import {
  WidgetAcomodacao,
  WidgetCondicoesEspeciais,
  WidgetContexto,
  WidgetExames,
  WidgetHabitos,
  WidgetObservacoes,
} from './Apoio'
import { positiva, responder, tratada } from './tipos'
import type {
  DadosAcomodacao,
  DadosAlergias,
  DadosCapacidadeFuncional,
  DadosCardiovascular,
  DadosCondicoesEspeciais,
  DadosContexto,
  DadosDiagnosticos,
  DadosExames,
  DadosHabitos,
  DadosHistoriaAnestesica,
  DadosMedicacoes,
  DadosObservacoes,
  DadosRespiratorio,
  DadosSangramento,
  DadosSinaisVitais,
} from './tipos'

/* ══════════════ tipo do registro ══════════════ */

export type Categoria = 'contexto' | 'antecedentes' | 'sistemas' | 'medidas' | 'apoio'

export const CATEGORIAS: Record<Categoria, string> = {
  contexto: 'Contexto',
  antecedentes: 'Antecedentes',
  sistemas: 'Revisão por sistemas',
  medidas: 'Medidas',
  apoio: 'Apoio e acomodação',
}

export type Bloco = {
  id: string
  tipo: string
  dados: unknown
}

export type DefWidget = {
  tipo: string
  nome: string
  /** Como a enfermagem descreveria o bloco — não a definição técnica dele. */
  descricao: string
  categoria: Categoria
  icone: LucideIcon
  Componente: ComponentType<{ dados: never; onChange: (d: never) => void }>
  dadosIniciais: () => unknown
  /** O bloco recebeu tratamento suficiente para ser publicado? */
  tratado: (d: never) => boolean
  /** Resumo de uma linha exibido com o bloco fechado. */
  resumo: (d: never) => string
  /** Domínio que soma cinco minutos quando positivo, sujeito ao teto de três. */
  dominio?: boolean
  /** Este bloco tem algum achado que soma tempo? */
  sinal?: (d: never) => boolean
  /** Minutos que o bloco soma fora do teto — só a acomodação usa. */
  minutosForaDoTeto?: number
}

/** Atalho de tipagem: cada widget conhece seus dados, o registro não precisa. */
const def = <D,>(w: {
  tipo: string
  nome: string
  descricao: string
  categoria: Categoria
  icone: LucideIcon
  Componente: ComponentType<{ dados: D; onChange: (d: D) => void }>
  dadosIniciais: () => D
  tratado: (d: D) => boolean
  resumo: (d: D) => string
  dominio?: boolean
  sinal?: (d: D) => boolean
  minutosForaDoTeto?: number
}): DefWidget => w as unknown as DefWidget

/* ══════════════ o caso ══════════════ */

export const PACIENTE = {
  nome: 'Marta Ribeiro Alves',
  idade: 78,
  codigo: 'ANT-4A91C2',
  procedimento: 'Artroplastia total de quadril',
  servico: 'Ortopedia',
  solicitante: 'Dr. Aurélio Prado · CRM-SP 118432',
}

const enfermeira = 'Enf. Renata Duarte'

/* ══════════════ registro ══════════════ */

export const WIDGETS: DefWidget[] = [
  def<DadosContexto>({
    tipo: 'procedure_context',
    nome: 'Contexto do procedimento',
    descricao: 'O que veio escrito no encaminhamento.',
    categoria: 'contexto',
    icone: CalendarClock,
    Componente: WidgetContexto,
    dadosIniciais: () => ({
      indicacao: 'Artroplastia total de quadril direito',
      dataPlanejada: '22 de setembro de 2026',
      lateralidade: 'Direita',
      observacaoEncaminhamento:
        'Coxartrose avançada à direita, dor incapacitante há oito meses, sem melhora com tratamento conservador.',
    }),
    tratado: (d) => d.indicacao.trim().length > 0,
    resumo: (d) => `${d.indicacao} · ${d.lateralidade ?? 'sem lateralidade'}`,
  }),

  def<DadosAlergias>({
    tipo: 'allergies',
    nome: 'Alergias',
    descricao: 'A que o paciente é alérgico e o que aconteceu.',
    categoria: 'antecedentes',
    icone: ShieldAlert,
    dominio: true,
    Componente: WidgetAlergias,
    dadosIniciais: () => ({
      temAlergia: responder(true),
      itens: [
        {
          id: 'alergia_1',
          fonte: 'MEDICAMENTO',
          substancia: 'Dipirona Sódica',
          classe: 'ANALGESICOS',
          reacao: 'Placas vermelhas por todo o corpo e inchaço nos lábios, cerca de meia hora depois do comprimido.',
          gravidade: 'MODERADA',
          tipo: 'ALERGIA',
        },
        {
          id: 'alergia_2',
          fonte: 'LATEX',
          substancia: 'Luva de látex',
          reacao: 'Coceira e vermelhidão onde a luva encostou, some sozinho em algumas horas.',
          gravidade: 'LEVE',
          tipo: 'ALERGIA',
        },
      ],
    }),
    tratado: (d) => tratada(d.temAlergia),
    resumo: (d) =>
      positiva(d.temAlergia)
        ? d.itens.map((i) => i.substancia).join(', ')
        : 'Nenhuma alergia conhecida',
    sinal: (d) => positiva(d.temAlergia),
  }),

  def<DadosHistoriaAnestesica>({
    tipo: 'anesthesia_history',
    nome: 'História anestésica',
    descricao: 'Como foram as anestesias anteriores.',
    categoria: 'antecedentes',
    icone: Syringe,
    dominio: true,
    Componente: WidgetHistoriaAnestesica,
    dadosIniciais: () => ({
      anestesiaPrevia: responder(true),
      complicacaoPessoal: responder(true),
      descricaoComplicacao:
        'Na cesárea, há muitos anos, a pressão caiu muito durante a raquianestesia e ela precisou ficar mais tempo em observação.',
      viaAereaDificil: responder(false),
      nauseaVomitoPos: responder(true),
      complicacaoFamiliar: { estado: 'NAO_SABE' },
    }),
    tratado: (d) => tratada(d.anestesiaPrevia),
    resumo: (d) =>
      positiva(d.complicacaoPessoal)
        ? 'Anestesia prévia com complicação relatada'
        : positiva(d.anestesiaPrevia)
          ? 'Anestesia prévia sem complicação'
          : 'Primeira anestesia',
    sinal: (d) => positiva(d.complicacaoPessoal) || positiva(d.viaAereaDificil),
  }),

  def<DadosCardiovascular>({
    tipo: 'cardiovascular',
    nome: 'Cardiovascular',
    descricao: 'Dor no peito, falta de ar, desmaio, palpitação, inchaço.',
    categoria: 'sistemas',
    icone: HeartPulse,
    dominio: true,
    Componente: WidgetCardiovascular,
    dadosIniciais: () => ({
      dorToracica: responder(false),
      dispneiaRepouso: responder(false),
      sincope: responder(false),
      palpitacao: responder(true),
      edema: responder(true),
      detalhe:
        'Sente o coração acelerar quando sobe a rampa de casa. Os tornozelos incham no fim do dia e melhoram com a perna elevada.',
    }),
    tratado: (d) =>
      [d.dorToracica, d.dispneiaRepouso, d.sincope, d.palpitacao, d.edema].every(tratada),
    resumo: (d) => {
      const n = [d.dorToracica, d.dispneiaRepouso, d.sincope, d.palpitacao, d.edema].filter(
        positiva,
      ).length
      return n === 0 ? 'Sem achados' : n === 1 ? '1 achado positivo' : `${n} achados positivos`
    },
    sinal: (d) =>
      [d.dorToracica, d.dispneiaRepouso, d.sincope, d.palpitacao, d.edema].some(positiva),
  }),

  def<DadosRespiratorio>({
    tipo: 'respiratory',
    nome: 'Respiratório',
    descricao: 'Falta de ar, chiado, infecção recente, apneia, suporte.',
    categoria: 'sistemas',
    icone: Wind,
    dominio: true,
    Componente: WidgetRespiratorio,
    dadosIniciais: () => ({
      dispneia: responder(true),
      sibilo: responder(false),
      infeccaoRecente: responder(false),
      apneiaSono: responder(false),
      suporteRespiratorio: responder(false),
      descricaoSuporte:
        'Cansa ao subir um lance de escada, mas atribui à dor no quadril e ao pouco condicionamento.',
    }),
    tratado: (d) =>
      [d.dispneia, d.sibilo, d.infeccaoRecente, d.apneiaSono, d.suporteRespiratorio].every(
        tratada,
      ),
    resumo: (d) => {
      const n = [
        d.dispneia,
        d.sibilo,
        d.infeccaoRecente,
        d.apneiaSono,
        d.suporteRespiratorio,
      ].filter(positiva).length
      return n === 0 ? 'Sem achados' : n === 1 ? '1 achado positivo' : `${n} achados positivos`
    },
    sinal: (d) =>
      [d.dispneia, d.sibilo, d.infeccaoRecente, d.apneiaSono, d.suporteRespiratorio].some(
        positiva,
      ),
  }),

  def<DadosSangramento>({
    tipo: 'bleeding_thrombosis',
    nome: 'Sangramento e trombose',
    descricao: 'Sangra fácil, já teve coágulo, toma anticoagulante.',
    categoria: 'sistemas',
    icone: Droplets,
    dominio: true,
    Componente: WidgetSangramento,
    dadosIniciais: () => ({
      sangramentoAnormal: responder(false),
      trombosePrevia: responder(false),
      anticoagulante: responder(true),
      detalhe:
        'Toma Ácido Acetilsalicílico 100 mg todo dia de manhã, por orientação do cardiologista. Ninguém falou em suspender.',
    }),
    tratado: (d) => [d.sangramentoAnormal, d.trombosePrevia, d.anticoagulante].every(tratada),
    resumo: (d) =>
      positiva(d.anticoagulante)
        ? 'Em uso de antiagregante'
        : [d.sangramentoAnormal, d.trombosePrevia].some(positiva)
          ? 'Achado positivo'
          : 'Sem achados',
    sinal: (d) => [d.sangramentoAnormal, d.trombosePrevia, d.anticoagulante].some(positiva),
  }),

  def<DadosMedicacoes>({
    tipo: 'medications',
    nome: 'Medicações em uso',
    descricao: 'O que ele toma hoje, incluindo por conta própria.',
    categoria: 'antecedentes',
    icone: Pill,
    Componente: WidgetMedicacoes,
    dadosIniciais: () => ({
      usaMedicacao: responder(true),
      itens: [
        { id: 'm1', nome: 'Losartana Potássica', classe: 'ANTI-HIPERTENSIVOS', dose: '50 mg', frequencia: '2x ao dia', ultimoUso: 'Hoje, 7h' },
        { id: 'm2', nome: 'Cloridrato de Metformina', classe: 'ANTIDIABETICOS', dose: '850 mg', frequencia: '2x ao dia', ultimoUso: 'Hoje, 12h' },
        { id: 'm3', nome: 'Ácido Acetilsalicílico', classe: 'ANTIAGREGANTES PLAQUETARIOS', dose: '100 mg', frequencia: '1x ao dia', ultimoUso: 'Hoje, 7h' },
        { id: 'm4', nome: 'Levotiroxina Sódica', classe: 'HORMONIOS', dose: '75 mcg', frequencia: 'Em jejum', ultimoUso: 'Hoje, 6h' },
      ],
    }),
    tratado: (d) => tratada(d.usaMedicacao),
    resumo: (d) =>
      positiva(d.usaMedicacao)
        ? `${d.itens.length} medicações · ${new Set(d.itens.map((i) => i.classe)).size} classes`
        : 'Não usa medicação',
    sinal: (d) => positiva(d.usaMedicacao) && d.itens.length >= 5,
  }),

  def<DadosDiagnosticos>({
    tipo: 'diagnoses',
    nome: 'Diagnósticos',
    descricao: 'Doenças que já disseram que ele tem.',
    categoria: 'antecedentes',
    icone: Stethoscope,
    Componente: WidgetDiagnosticos,
    dadosIniciais: () => ({
      temDiagnostico: responder(true),
      itens: [
        {
          id: 'd1',
          codigo: 'I10',
          descricao: 'Hipertensão essencial (primária)',
          capitulo: 'Doenças do aparelho circulatório',
          sintomasAtuais: 'Sem sintomas no dia a dia',
          controlePaciente: 'Diz que a pressão fica boa desde que não esqueça o remédio',
        },
        {
          id: 'd2',
          codigo: 'E11',
          descricao: 'Diabetes mellitus não-insulino-dependente',
          capitulo: 'Doenças endócrinas, nutricionais e metabólicas',
          sintomasAtuais: 'Nega poliúria e visão turva',
          controlePaciente: 'Mede o dedo de manhã, costuma dar entre 110 e 140',
        },
        {
          id: 'd3',
          codigo: 'E03',
          descricao: 'Outros hipotireoidismos',
          capitulo: 'Doenças endócrinas, nutricionais e metabólicas',
          controlePaciente: 'Faz exame de tireoide uma vez por ano e nunca mudaram a dose',
        },
        {
          id: 'd4',
          codigo: 'M16',
          descricao: 'Coxartrose [artrose do quadril]',
          capitulo: 'Doenças do sistema osteomuscular e do tecido conjuntivo',
          sintomasAtuais: 'Dor ao apoiar o peso e ao virar na cama à noite',
          controlePaciente: 'Diz que a dor não deixa mais ela dormir de lado',
        },
      ],
    }),
    tratado: (d) => tratada(d.temDiagnostico),
    resumo: (d) =>
      positiva(d.temDiagnostico)
        ? d.itens.map((i) => i.codigo).join(' · ')
        : 'Nenhum diagnóstico prévio',
    sinal: (d) => positiva(d.temDiagnostico) && d.itens.length >= 3,
  }),

  def<DadosAcomodacao>({
    tipo: 'accommodations',
    nome: 'Acomodação necessária',
    descricao: 'O que a vaga precisa ter para receber este paciente.',
    categoria: 'apoio',
    icone: Accessibility,
    minutosForaDoTeto: 10,
    Componente: WidgetAcomodacao,
    dadosIniciais: () => ({
      comunicacao: responder(false),
      mobilidade: responder(true),
      descricaoMobilidade: 'Anda com andador e precisa de sala térrea, com apoio para sentar e levantar.',
      representanteLegal: responder(false),
    }),
    tratado: (d) => [d.comunicacao, d.mobilidade, d.representanteLegal].every(tratada),
    resumo: (d) => {
      const itens = [
        positiva(d.comunicacao) && 'apoio de comunicação',
        positiva(d.mobilidade) && 'sala acessível',
        positiva(d.representanteLegal) && 'representante legal',
      ].filter(Boolean)
      return itens.length ? itens.join(', ') : 'Sem recurso adicional'
    },
    sinal: (d) =>
      [d.comunicacao, d.mobilidade, d.representanteLegal].some(positiva),
  }),

  def<DadosSinaisVitais>({
    tipo: 'vital_signs',
    nome: 'Sinais vitais',
    descricao: 'O que foi aferido agora, na sala.',
    categoria: 'medidas',
    icone: Gauge,
    Componente: WidgetSinaisVitais,
    dadosIniciais: () => ({
      sistolica: responder(148),
      diastolica: responder(86),
      frequenciaCardiaca: responder(78),
      saturacao: responder(96),
      peso: responder(71.4),
      altura: responder(158),
    }),
    tratado: (d) =>
      [d.sistolica, d.diastolica, d.frequenciaCardiaca, d.saturacao, d.peso, d.altura].every(
        tratada,
      ),
    resumo: (d) =>
      `PA ${d.sistolica.valor ?? '—'}/${d.diastolica.valor ?? '—'} · FC ${d.frequenciaCardiaca.valor ?? '—'} · SpO₂ ${d.saturacao.valor ?? '—'}%`,
  }),

  def<DadosCapacidadeFuncional>({
    tipo: 'functional_capacity',
    nome: 'Capacidade funcional',
    descricao: 'O esforço que ele dá conta de fazer hoje.',
    categoria: 'medidas',
    icone: Activity,
    Componente: WidgetCapacidadeFuncional,
    dadosIniciais: () => ({
      atividade: responder('Caminhada'),
      metCatalogo: 3.5,
      limitadoPorSintoma: responder(true),
      descricaoLimitacao:
        'Caminha até a padaria da esquina, mas para no meio do caminho por causa da dor no quadril, não por falta de ar.',
    }),
    tratado: (d) => tratada(d.atividade) && tratada(d.limitadoPorSintoma),
    resumo: (d) =>
      d.atividade.valor
        ? `${d.atividade.valor}${d.metCatalogo ? ` · ${d.metCatalogo} MET` : ''}`
        : 'Sem atividade relatada',
  }),

  def<DadosHabitos>({
    tipo: 'habits_substances',
    nome: 'Hábitos e substâncias',
    descricao: 'Tabaco, álcool e outras substâncias.',
    categoria: 'antecedentes',
    icone: Cigarette,
    dominio: true,
    Componente: WidgetHabitos,
    dadosIniciais: () => ({
      tabaco: responder<'NUNCA' | 'EX_USUARIO' | 'ATUAL'>('EX_USUARIO'),
      detalheTabaco: 'Fumou dos 20 aos 55 anos, cerca de meio maço por dia. Parou há mais de vinte anos.',
      alcool: responder<'NUNCA' | 'EX_USUARIO' | 'ATUAL'>('NUNCA'),
      outrasSubstancias: responder(false),
    }),
    tratado: (d) => [d.tabaco, d.alcool, d.outrasSubstancias].every(tratada),
    resumo: (d) => {
      const t = d.tabaco.valor
      return t === 'ATUAL'
        ? 'Tabagista atual'
        : t === 'EX_USUARIO'
          ? 'Ex-tabagista'
          : 'Nunca fumou'
    },
    sinal: (d) => d.tabaco.valor === 'ATUAL' || d.alcool.valor === 'ATUAL' || positiva(d.outrasSubstancias),
  }),

  def<DadosCondicoesEspeciais>({
    tipo: 'special_conditions',
    nome: 'Condições especiais',
    descricao: 'Gestação, lactação e outras condições declaradas.',
    categoria: 'apoio',
    icone: UserRound,
    dominio: true,
    Componente: WidgetCondicoesEspeciais,
    dadosIniciais: () => ({
      gestante: { estado: 'NAO_SE_APLICA' },
      lactante: { estado: 'NAO_SE_APLICA' },
    }),
    tratado: (d) => tratada(d.gestante) && tratada(d.lactante),
    resumo: (d) =>
      positiva(d.gestante)
        ? `Gestante${d.semanasGestacao ? ` · ${d.semanasGestacao} semanas` : ''}`
        : d.outraCondicao || 'Nenhuma condição especial',
    sinal: (d) => positiva(d.gestante) || positiva(d.lactante),
  }),

  def<DadosExames>({
    tipo: 'exams_pending',
    nome: 'Exames',
    descricao: 'O que ele trouxe e o que está faltando.',
    categoria: 'medidas',
    icone: FileText,
    Componente: WidgetExames,
    dadosIniciais: () => ({
      itens: [
        { id: 'e1', nome: 'Hemograma completo', status: 'DISPONIVEL', data: '02/08/2026' },
        { id: 'e2', nome: 'Glicemia de jejum', status: 'DISPONIVEL', data: '02/08/2026' },
        { id: 'e3', nome: 'Eletrocardiograma', status: 'SOLICITADO' },
        { id: 'e4', nome: 'Radiografia de tórax', status: 'AUSENTE' },
      ],
    }),
    tratado: (d) => d.itens.length > 0,
    resumo: (d) => {
      const pend = d.itens.filter((i) => i.status !== 'DISPONIVEL').length
      return pend === 0 ? 'Todos em mãos' : `${pend} pendente${pend > 1 ? 's' : ''}`
    },
  }),

  def<DadosObservacoes>({
    tipo: 'clinical_notes',
    nome: 'Observações',
    descricao: 'O que não coube em nenhum campo.',
    categoria: 'apoio',
    icone: ClipboardList,
    Componente: WidgetObservacoes,
    dadosIniciais: () => ({
      nota: 'Veio acompanhada da filha, que ajuda com os horários dos remédios. Ouve bem de perto, mas pede para repetir quando há barulho na sala. Pergunta várias vezes se vai poder voltar a dançar depois da cirurgia.',
      autor: enfermeira,
      horario: '14 ago 2026, 09h12',
    }),
    tratado: (d) => d.nota.trim().length > 0,
    resumo: (d) => (d.nota ? 'Observação registrada' : 'Sem observação'),
  }),
]

/** Ordem em que o protocolo pré-anestésico abre a entrevista. */
export const PROTOCOLO = [
  'procedure_context',
  'allergies',
  'anesthesia_history',
  'cardiovascular',
  'respiratory',
  'bleeding_thrombosis',
  'medications',
  'diagnoses',
  'accommodations',
  'vital_signs',
  'functional_capacity',
  'habits_substances',
  'exams_pending',
  'clinical_notes',
]

export function widgetPorTipo(tipo: string): DefWidget | undefined {
  return WIDGETS.find((w) => w.tipo === tipo)
}
