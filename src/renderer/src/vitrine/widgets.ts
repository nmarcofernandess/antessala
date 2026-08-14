/**
 * VITRINE — catálogo de widgets da anamnese pré-anestésica.
 *
 * Os nomes canônicos vêm de `hack/domains/ANALYST-anamnese-e-catalogos.md`.
 * A regra de dimensionamento replica `src/shared/mvp/workflow.ts`.
 */

export type EstadoResposta =
  | 'NAO_PERGUNTADO'
  | 'RESPONDIDO'
  | 'NEGATIVO'
  | 'NAO_SABE'
  | 'RECUSOU'
  | 'NAO_SE_APLICA'
  | 'NAO_REALIZADO'

export const ESTADOS_RESPOSTA: Record<
  EstadoResposta,
  { curto: string; nome: string; tom: string }
> = {
  NAO_PERGUNTADO: { curto: '—', nome: 'Não perguntado', tom: 'text-muted-foreground/70' },
  RESPONDIDO: { curto: 'Sim', nome: 'Respondido', tom: 'text-emerald-600 dark:text-emerald-400' },
  NEGATIVO: { curto: 'Não', nome: 'Negativo documentado', tom: 'text-foreground' },
  NAO_SABE: { curto: '?', nome: 'Não sabe', tom: 'text-amber-600 dark:text-amber-400' },
  RECUSOU: { curto: 'R', nome: 'Recusou responder', tom: 'text-amber-600 dark:text-amber-400' },
  NAO_SE_APLICA: { curto: 'NA', nome: 'Não se aplica', tom: 'text-muted-foreground' },
  NAO_REALIZADO: { curto: 'NR', nome: 'Não realizado', tom: 'text-muted-foreground' },
}

/** Estados que a enfermagem alterna no cartão. `NAO_PERGUNTADO` é o estado inicial. */
export const CICLO: EstadoResposta[] = [
  'NAO_PERGUNTADO',
  'RESPONDIDO',
  'NEGATIVO',
  'NAO_SABE',
  'RECUSOU',
]

export type Categoria = 'contexto' | 'antecedentes' | 'sistemas' | 'medidas' | 'apoio'

export const CATEGORIAS: Record<Categoria, { nome: string }> = {
  contexto: { nome: 'Contexto' },
  antecedentes: { nome: 'Antecedentes' },
  sistemas: { nome: 'Sistemas' },
  medidas: { nome: 'Medidas' },
  apoio: { nome: 'Apoio' },
}

export type DefWidget = {
  tipo: string
  nome: string
  descricao: string
  categoria: Categoria
  campos: string[]
  /** Código do sinal na regra; ausente = não pontua minuto. */
  sinal?: string
  /** Minutos que o sinal soma quando positivo. */
  minutos?: number
  /** Sujeito ao teto de três revisões de domínio. */
  dominio?: boolean
}

export const WIDGETS: DefWidget[] = [
  { tipo: 'procedure_context', nome: 'Contexto do procedimento', categoria: 'contexto',
    descricao: 'Indicação, data planejada, lateralidade e observação do encaminhamento.',
    campos: ['indication', 'plannedDate', 'laterality', 'referralNotes'] },

  { tipo: 'allergies', nome: 'Alergias', categoria: 'antecedentes',
    descricao: 'Substância, reação e gravidade. Negativa é valor documentado.',
    campos: ['hasAllergy', 'items[].substance', 'items[].reaction', 'items[].severity'],
    sinal: 'ALLERGY_REVIEW', minutos: 5, dominio: true },

  { tipo: 'anesthesia_history', nome: 'História anestésica', categoria: 'antecedentes',
    descricao: 'Anestesia prévia, complicação pessoal, via aérea difícil e história familiar.',
    campos: ['previousAnesthesia', 'difficultAirwayHistory', 'personalComplication', 'familyAnesthesiaComplication'],
    sinal: 'ANESTHESIA_HISTORY_REVIEW', minutos: 5, dominio: true },

  { tipo: 'cardiovascular', nome: 'Cardiovascular', categoria: 'sistemas',
    descricao: 'Dor torácica, dispneia em repouso, síncope, palpitação, edema.',
    campos: ['chestPain', 'dyspneaAtRest', 'syncope', 'palpitation', 'edema', 'knownCardiovascularDisease'],
    sinal: 'CARDIOVASCULAR_REVIEW', minutos: 5, dominio: true },

  { tipo: 'respiratory', nome: 'Respiratório', categoria: 'sistemas',
    descricao: 'Dispneia, sibilo, infecção recente, apneia do sono e suporte.',
    campos: ['dyspnea', 'wheezing', 'recentRespiratoryInfection', 'sleepApneaDiagnosis', 'usesRespiratorySupport'],
    sinal: 'RESPIRATORY_REVIEW', minutos: 5, dominio: true },

  { tipo: 'bleeding_thrombosis', nome: 'Sangramento e trombose', categoria: 'sistemas',
    descricao: 'Sangramento anormal, trombose prévia e uso de anticoagulante.',
    campos: ['abnormalBleeding', 'priorThrombosis', 'receivesAnticoagulantOrAntiplatelet'],
    sinal: 'BLEEDING_REVIEW', minutos: 5, dominio: true },

  { tipo: 'habits_substances', nome: 'Hábitos e substâncias', categoria: 'antecedentes',
    descricao: 'Tabaco e álcool distinguem nunca, ex-usuário e atual.',
    campos: ['tobacco', 'alcohol', 'recreationalSubstances'],
    sinal: 'SUBSTANCE_REVIEW', minutos: 5, dominio: true },

  { tipo: 'special_conditions', nome: 'Condições especiais', categoria: 'apoio',
    descricao: 'Gestação, lactação e outras condições declaradas.',
    campos: ['pregnant', 'lactating', 'otherCondition'],
    sinal: 'SPECIAL_CONDITION_REVIEW', minutos: 5, dominio: true },

  { tipo: 'accommodations', nome: 'Acomodação necessária', categoria: 'apoio',
    descricao: 'Comunicação, mobilidade e acompanhante. Vira capability da vaga.',
    campos: ['communicationAccommodation', 'mobilityAccommodation', 'legalRepresentativeNeeded'],
    sinal: 'ACCOMMODATION', minutos: 10 },

  { tipo: 'medications', nome: 'Medicações em uso', categoria: 'antecedentes',
    descricao: 'Item de catálogo com princípio ativo, dose, frequência e último uso.',
    campos: ['usesMedication', 'items[].catalogId', 'items[].dose', 'items[].lastUse'],
    sinal: 'MEDICATION_VOLUME', minutos: 5 },

  { tipo: 'diagnoses', nome: 'Diagnósticos', categoria: 'antecedentes',
    descricao: 'CID-10 estável, sintomas atuais e frase de controle do paciente.',
    campos: ['hasDiagnosis', 'items[].cidId', 'items[].currentSymptoms'],
    sinal: 'DIAGNOSIS_VOLUME', minutos: 5 },

  { tipo: 'functional_capacity', nome: 'Capacidade funcional', categoria: 'medidas',
    descricao: 'Atividade relatada e limitação. MET é metadado, nunca valor do paciente.',
    campos: ['activity', 'limitedBySymptoms', 'limitationDescription'] },

  { tipo: 'vital_signs', nome: 'Sinais vitais', categoria: 'medidas',
    descricao: 'Cada medida não aferida usa não realizado, nunca zero.',
    campos: ['systolicBpMmHg', 'heartRateBpm', 'oxygenSaturationPct', 'weightKg', 'heightCm'] },

  { tipo: 'exams_pending', nome: 'Exames pendentes', categoria: 'medidas',
    descricao: 'Exame ausente vira pendência do caso — nunca soma minuto.',
    campos: ['items[].name', 'items[].status'] },

  { tipo: 'clinical_notes', nome: 'Observações', categoria: 'apoio',
    descricao: 'Texto puro com autoria e horário.',
    campos: ['note'] },
]

/** Protocolo pré-anestésico: ordem inicial dos blocos. */
export const PROTOCOLO = [
  'procedure_context', 'allergies', 'anesthesia_history', 'cardiovascular',
  'respiratory', 'bleeding_thrombosis', 'medications', 'diagnoses',
  'accommodations', 'vital_signs',
]

export type Bloco = {
  id: string
  tipo: string
  estado: EstadoResposta
  /** Quantidade, para os widgets de volume. */
  quantidade?: number
}

export type Sinal = { rotulo: string; minutos: number; noTeto?: boolean }

export type Requisito = {
  minutos: number
  classe: 'RAPIDA' | 'NORMAL' | 'ESTENDIDA' | 'FORA_DA_FAIXA'
  sinais: Sinal[]
  explicacao: string
  incompleto: boolean
}

/**
 * Réplica da regra `demo-workload-v1`: base 20, teto de três revisões de
 * domínio, volume de medicação e diagnóstico somam uma vez, acomodação +10.
 */
export function calcular(blocos: Bloco[]): Requisito {
  const sinais: Sinal[] = []
  let dominiosPagos = 0

  for (const b of blocos) {
    const def = WIDGETS.find((w) => w.tipo === b.tipo)
    if (!def?.sinal || !def.dominio) continue
    if (b.estado !== 'RESPONDIDO') continue
    if (dominiosPagos < 3) {
      sinais.push({ rotulo: def.nome, minutos: def.minutos ?? 5 })
      dominiosPagos++
    } else {
      sinais.push({ rotulo: def.nome, minutos: 0, noTeto: true })
    }
  }

  const med = blocos.find((b) => b.tipo === 'medications')
  if (med?.estado === 'RESPONDIDO' && (med.quantidade ?? 0) >= 5) {
    sinais.push({ rotulo: 'Volume de medicação', minutos: 5 })
  }
  const dia = blocos.find((b) => b.tipo === 'diagnoses')
  if (dia?.estado === 'RESPONDIDO' && (dia.quantidade ?? 0) >= 3) {
    sinais.push({ rotulo: 'Volume de diagnósticos', minutos: 5 })
  }
  const acc = blocos.find((b) => b.tipo === 'accommodations')
  if (acc?.estado === 'RESPONDIDO') {
    sinais.push({ rotulo: 'Acomodação necessária', minutos: 10 })
  }

  const minutos = 20 + sinais.reduce((s, x) => s + x.minutos, 0)
  const classe =
    minutos === 20 ? 'RAPIDA' : minutos <= 35 ? 'NORMAL' : minutos <= 50 ? 'ESTENDIDA' : 'FORA_DA_FAIXA'

  const incompleto = blocos.some((b) => b.estado === 'NAO_PERGUNTADO')
  const pagos = sinais.filter((s) => s.minutos > 0)

  return {
    minutos,
    classe,
    sinais,
    incompleto,
    explicacao: pagos.length
      ? `Base de 20 min + ${pagos.map((s) => `${s.rotulo} (+${s.minutos})`).join(' + ')}.`
      : 'Base de 20 min; nenhuma resposta positiva adicionou tempo.',
  }
}
