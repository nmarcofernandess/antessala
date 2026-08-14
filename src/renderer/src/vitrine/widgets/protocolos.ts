/**
 * Protocolos de coleta por procedimento.
 *
 * Um protocolo é uma **composição de coleta**: ele decide quais perguntas o
 * formulário faz, nunca o que o paciente tem nem o que se conclui. O que separa
 * um protocolo do outro é o **regime e a anestesia previstos para o
 * procedimento** — atributos operacionais da cirurgia, não julgamento de quem
 * vai operar. Uma facectomia com anestesia local em regime ambulatorial não
 * coleta o mesmo que uma artroplastia com internação, e é isso que estas listas
 * dizem.
 *
 * Nenhuma instituição validou estas onze composições. Elas são decisão da
 * demonstração — `DEMO_DECISION` no vocabulário dos contratos — e a tela declara
 * isso. Um protocolo não é protocolo hospitalar, não atribui risco, não define
 * conduta e não substitui avaliação.
 *
 * Regra de completude desta fase, decidida pelo dono do produto: **incluído é
 * obrigatório**. Os blocos da composição precisam estar tratados para publicar;
 * os que ficaram de fora não bloqueiam. Um bloco acrescentado depois é
 * complementar e não vira obrigatório retroativamente.
 */

import { widgetPorTipo, type Bloco } from './registro'

export type Protocolo = {
  id: string
  nome: string
  /** Procedimentos de `PROCEDIMENTOS` que aplicam este protocolo. */
  procedimentos: string[]
  /** Regime e anestesia previstos — é o que justifica a composição. */
  regime: string
  /** Ordem dos blocos. Incluído na lista significa obrigatório para publicar. */
  blocos: string[]
  versao: number
}

/* ══════════════ famílias de composição ══════════════ */

/**
 * Internação, anestesia geral ou bloqueio. A entrevista percorre todos os
 * domínios e ainda registra jejum, porque o preparo é parte da internação.
 */
const INTERNACAO = [
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
  'special_conditions',
  'exams_pending',
  'fasting_guidance',
  'clinical_notes',
]

/**
 * Ambulatorial de médio porte: sai a capacidade funcional e as condições
 * especiais, entra o acompanhante — porque a pessoa vai para casa no mesmo dia.
 */
const AMBULATORIAL_MEDIO = [
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
  'exams_pending',
  'fasting_guidance',
  'escort_and_transport',
  'clinical_notes',
]

/**
 * Ambulatorial com sedação: exame curto, alta no mesmo dia. Jejum e
 * acompanhante continuam, a revisão por sistemas encolhe.
 */
const AMBULATORIAL_SEDACAO = [
  'procedure_context',
  'allergies',
  'anesthesia_history',
  'cardiovascular',
  'respiratory',
  'medications',
  'diagnoses',
  'vital_signs',
  'accommodations',
  'fasting_guidance',
  'escort_and_transport',
  'clinical_notes',
]

/**
 * Ambulatorial com anestesia local: a entrevista mais curta que o produto tem.
 * Sem jejum, porque não há sedação; sem revisão por sistemas.
 */
const AMBULATORIAL_LOCAL = [
  'procedure_context',
  'allergies',
  'medications',
  'diagnoses',
  'vital_signs',
  'accommodations',
  'escort_and_transport',
  'exams_pending',
  'clinical_notes',
]

/** Laparoscopia ginecológica: médio porte com condições especiais. */
const GINECOLOGICO = [
  'procedure_context',
  'allergies',
  'anesthesia_history',
  'cardiovascular',
  'respiratory',
  'bleeding_thrombosis',
  'medications',
  'diagnoses',
  'special_conditions',
  'vital_signs',
  'accommodations',
  'fasting_guidance',
  'escort_and_transport',
  'clinical_notes',
]

/* ══════════════ os protocolos ══════════════ */

/** Fallback para procedimento sem composição própria: coleta tudo. */
export const PROTOCOLO_GERAL: Protocolo = {
  id: 'geral',
  nome: 'Protocolo geral completo',
  procedimentos: [],
  regime: 'Aplicado quando o procedimento não tem composição própria',
  blocos: [...INTERNACAO, 'escort_and_transport'],
  versao: 1,
}

export const PROTOCOLOS: Protocolo[] = [
  {
    id: 'artroplastia_quadril',
    nome: 'Artroplastia de quadril',
    procedimentos: ['Artroplastia de quadril'],
    regime: 'Internação · anestesia geral ou bloqueio',
    blocos: INTERNACAO,
    versao: 1,
  },
  {
    id: 'osteossintese_femur',
    nome: 'Osteossíntese de fêmur',
    procedimentos: ['Osteossíntese de fêmur'],
    regime: 'Internação · anestesia geral ou bloqueio',
    blocos: INTERNACAO,
    versao: 1,
  },
  {
    id: 'colecistectomia',
    nome: 'Colecistectomia',
    procedimentos: ['Colecistectomia videolaparoscópica'],
    regime: 'Internação curta · anestesia geral',
    blocos: INTERNACAO.filter((b) => b !== 'functional_capacity'),
    versao: 1,
  },
  {
    id: 'rtu',
    nome: 'Ressecção transuretral',
    procedimentos: ['Ressecção transuretral'],
    regime: 'Internação curta · bloqueio ou geral',
    blocos: INTERNACAO.filter((b) => b !== 'special_conditions'),
    versao: 1,
  },
  {
    id: 'herniorrafia',
    nome: 'Herniorrafia inguinal',
    procedimentos: ['Herniorrafia inguinal'],
    regime: 'Ambulatorial · bloqueio ou geral',
    blocos: AMBULATORIAL_MEDIO,
    versao: 1,
  },
  {
    id: 'artroscopia_joelho',
    nome: 'Artroscopia de joelho',
    procedimentos: ['Artroscopia de joelho'],
    regime: 'Ambulatorial · bloqueio ou geral',
    blocos: AMBULATORIAL_MEDIO,
    versao: 1,
  },
  {
    id: 'septoplastia',
    nome: 'Septoplastia',
    procedimentos: ['Septoplastia'],
    regime: 'Ambulatorial · anestesia geral',
    blocos: AMBULATORIAL_MEDIO.filter((b) => b !== 'exams_pending'),
    versao: 1,
  },
  {
    id: 'endoscopia',
    nome: 'Endoscopia digestiva',
    procedimentos: ['Endoscopia digestiva alta'],
    regime: 'Ambulatorial · sedação',
    blocos: AMBULATORIAL_SEDACAO,
    versao: 1,
  },
  {
    id: 'colonoscopia',
    nome: 'Colonoscopia',
    procedimentos: ['Colonoscopia diagnóstica'],
    regime: 'Ambulatorial · sedação com preparo',
    blocos: AMBULATORIAL_SEDACAO,
    versao: 1,
  },
  {
    id: 'facectomia',
    nome: 'Facectomia',
    procedimentos: ['Facectomia com implante'],
    regime: 'Ambulatorial · anestesia local',
    blocos: AMBULATORIAL_LOCAL,
    versao: 1,
  },
  {
    id: 'videolaparoscopia',
    nome: 'Videolaparoscopia diagnóstica',
    procedimentos: ['Videolaparoscopia diagnóstica'],
    regime: 'Ambulatorial · anestesia geral',
    blocos: GINECOLOGICO,
    versao: 1,
  },
]

/** O protocolo do procedimento, ou o geral quando não há composição própria. */
export function protocoloPara(procedimento: string | undefined): Protocolo {
  if (!procedimento) return PROTOCOLO_GERAL
  return (
    PROTOCOLOS.find((p) =>
      p.procedimentos.some((x) => x.toLowerCase() === procedimento.trim().toLowerCase()),
    ) ?? PROTOCOLO_GERAL
  )
}

/**
 * Materializa os blocos do protocolo.
 *
 * Cada aplicação gera identificadores próprios: aplicar o mesmo protocolo duas
 * vezes no mesmo caso não pode produzir dois blocos com o mesmo id, que é o
 * defeito que o composer do DietFlow carrega ao copiar ids do template.
 */
let sequencia = 0

export function aplicar(protocolo: Protocolo): Bloco[] {
  return protocolo.blocos
    .filter((tipo) => widgetPorTipo(tipo))
    .map((tipo) => ({
      id: `${tipo}__${++sequencia}`,
      tipo,
      dados: widgetPorTipo(tipo)!.dadosIniciais(),
    }))
}

/** Acrescenta ao caso só os blocos do protocolo que ainda não estão lá. */
export function acrescentarFaltantes(protocolo: Protocolo, atuais: Bloco[]): Bloco[] {
  const presentes = new Set(atuais.map((b) => b.tipo))
  const novos = protocolo.blocos
    .filter((tipo) => !presentes.has(tipo) && widgetPorTipo(tipo))
    .map((tipo) => ({
      id: `${tipo}__${++sequencia}`,
      tipo,
      dados: widgetPorTipo(tipo)!.dadosIniciais(),
    }))
  return [...atuais, ...novos]
}
