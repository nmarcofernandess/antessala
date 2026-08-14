/**
 * Protocolos de coleta — fixture inicial, compartilhada entre main e renderer.
 *
 * Um protocolo é uma **composição de coleta**: decide quais perguntas o
 * formulário faz, nunca o que a pessoa tem nem o que se conclui. O que separa um
 * protocolo do outro é o **regime e a anestesia previstos para o procedimento**
 * — atributos operacionais da cirurgia, não julgamento de quem vai operar.
 *
 * Nenhuma instituição validou estas composições. São decisão da demonstração —
 * `DEMO_DECISION` no vocabulário dos contratos — e a tela declara isso. Um
 * protocolo não é protocolo hospitalar, não atribui risco, não define conduta e
 * não substitui avaliação.
 *
 * Este arquivo é o **estado de nascimento** do banco, não o estado corrente.
 * No app empacotado o `seed` grava estas linhas uma única vez (`ON CONFLICT DO
 * NOTHING`) e a partir daí a verdade é a tabela `protocolos_anamnese`, que o
 * operador edita. Fora do Electron — vitrine no navegador, testes — esta lista
 * é a própria fonte, porque não há banco para persistir.
 */

export type Protocolo = {
  id: string
  nome: string
  /** Procedimentos que aplicam este protocolo. Um procedimento pertence a um só. */
  procedimentos: string[]
  /** Regime e anestesia previstos — é o que justifica a composição. */
  regime: string
  /** Ordem dos blocos. Incluído na lista significa obrigatório para publicar. */
  blocos: string[]
  versao: number
  /** `FIXTURE` nasceu com o app; `OPERADOR` foi criado ou editado na tela. */
  origem?: 'FIXTURE' | 'OPERADOR'
  arquivadoEm?: string | null
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

/** Identificador do fallback. Existe como linha, mas não pode ser arquivado. */
export const ID_PROTOCOLO_GERAL = 'geral'

/** Fallback para procedimento sem composição própria: coleta tudo. */
export const PROTOCOLO_GERAL: Protocolo = {
  id: ID_PROTOCOLO_GERAL,
  nome: 'Protocolo geral completo',
  procedimentos: [],
  regime: 'Aplicado quando o procedimento não tem composição própria',
  blocos: [...INTERNACAO, 'escort_and_transport'],
  versao: 1,
  origem: 'FIXTURE',
}

export const PROTOCOLOS: Protocolo[] = [
  {
    id: 'artroplastia_quadril',
    nome: 'Artroplastia de quadril',
    procedimentos: ['Artroplastia de quadril'],
    regime: 'Internação · anestesia geral ou bloqueio',
    blocos: INTERNACAO,
    versao: 1,
    origem: 'FIXTURE',
  },
  {
    id: 'osteossintese_femur',
    nome: 'Osteossíntese de fêmur',
    procedimentos: ['Osteossíntese de fêmur'],
    regime: 'Internação · anestesia geral ou bloqueio',
    blocos: INTERNACAO,
    versao: 1,
    origem: 'FIXTURE',
  },
  {
    id: 'colecistectomia',
    nome: 'Colecistectomia',
    procedimentos: ['Colecistectomia videolaparoscópica'],
    regime: 'Internação curta · anestesia geral',
    blocos: INTERNACAO.filter((b) => b !== 'functional_capacity'),
    versao: 1,
    origem: 'FIXTURE',
  },
  {
    id: 'rtu',
    nome: 'Ressecção transuretral',
    procedimentos: ['Ressecção transuretral'],
    regime: 'Internação curta · bloqueio ou geral',
    blocos: INTERNACAO.filter((b) => b !== 'special_conditions'),
    versao: 1,
    origem: 'FIXTURE',
  },
  {
    id: 'herniorrafia',
    nome: 'Herniorrafia inguinal',
    procedimentos: ['Herniorrafia inguinal'],
    regime: 'Ambulatorial · bloqueio ou geral',
    blocos: AMBULATORIAL_MEDIO,
    versao: 1,
    origem: 'FIXTURE',
  },
  {
    id: 'artroscopia_joelho',
    nome: 'Artroscopia de joelho',
    procedimentos: ['Artroscopia de joelho'],
    regime: 'Ambulatorial · bloqueio ou geral',
    blocos: AMBULATORIAL_MEDIO,
    versao: 1,
    origem: 'FIXTURE',
  },
  {
    id: 'septoplastia',
    nome: 'Septoplastia',
    procedimentos: ['Septoplastia'],
    regime: 'Ambulatorial · anestesia geral',
    blocos: AMBULATORIAL_MEDIO.filter((b) => b !== 'exams_pending'),
    versao: 1,
    origem: 'FIXTURE',
  },
  {
    id: 'endoscopia',
    nome: 'Endoscopia digestiva',
    procedimentos: ['Endoscopia digestiva alta'],
    regime: 'Ambulatorial · sedação',
    blocos: AMBULATORIAL_SEDACAO,
    versao: 1,
    origem: 'FIXTURE',
  },
  {
    id: 'colonoscopia',
    nome: 'Colonoscopia',
    procedimentos: ['Colonoscopia diagnóstica'],
    regime: 'Ambulatorial · sedação com preparo',
    blocos: AMBULATORIAL_SEDACAO,
    versao: 1,
    origem: 'FIXTURE',
  },
  {
    id: 'facectomia',
    nome: 'Facectomia',
    procedimentos: ['Facectomia com implante'],
    regime: 'Ambulatorial · anestesia local',
    blocos: AMBULATORIAL_LOCAL,
    versao: 1,
    origem: 'FIXTURE',
  },
  {
    id: 'videolaparoscopia',
    nome: 'Videolaparoscopia diagnóstica',
    procedimentos: ['Videolaparoscopia diagnóstica'],
    regime: 'Ambulatorial · anestesia geral',
    blocos: GINECOLOGICO,
    versao: 1,
    origem: 'FIXTURE',
  },
]

/** A fixture inteira, o geral incluído — é o que o primeiro boot grava. */
export const PROTOCOLOS_FIXTURE: Protocolo[] = [PROTOCOLO_GERAL, ...PROTOCOLOS]

/**
 * O protocolo do procedimento dentro de uma lista, ou o geral quando não há
 * composição própria. A lista é parâmetro porque a verdade muda de lugar: no
 * app é a tabela, na vitrine é a fixture.
 */
export function protocoloPara(
  procedimento: string | undefined,
  lista: Protocolo[] = PROTOCOLOS,
): Protocolo {
  if (!procedimento) return PROTOCOLO_GERAL
  const alvo = procedimento.trim().toLowerCase()
  return (
    lista.find(
      (p) =>
        p.id !== ID_PROTOCOLO_GERAL &&
        !p.arquivadoEm &&
        p.procedimentos.some((x) => x.trim().toLowerCase() === alvo),
    ) ??
    lista.find((p) => p.id === ID_PROTOCOLO_GERAL) ??
    PROTOCOLO_GERAL
  )
}
