export type DemoRole =
  | 'ADMIN'
  | 'RECEPCAO'
  | 'ENFERMAGEM'
  | 'ANESTESIOLOGISTA'
  | 'SOLICITANTE'

export type DemoCaseStatus =
  | 'WAITING_NURSING'
  | 'NURSING_IN_PROGRESS'
  | 'TRIAGE_PENDING'
  | 'READY_FOR_SCHEDULING'
  | 'SCHEDULED'
  | 'WAITING_ANESTHESIA'
  | 'IN_ASSESSMENT'
  | 'PENDING'
  | 'WAITING_RETURN'
  | 'READY_FOR_HANDOFF'
  | 'DELIVERED_TO_REQUESTER'
  | 'CANCELLED'

export type AnswerSource =
  | 'PATIENT_REPORT'
  | 'REFERRAL'
  | 'MEASUREMENT'
  | 'PROFESSIONAL_OBSERVATION'

export type SemanticAnswer =
  | { state: 'ANSWERED'; value: boolean | number | string; source: AnswerSource }
  | {
      state: 'UNKNOWN' | 'NOT_APPLICABLE' | 'NOT_ASKED' | 'REFUSED' | 'NOT_PERFORMED'
      source: AnswerSource
    }

export type DemoCase = {
  id: string
  displayCode: string
  personName: string
  sex: string
  age: number
  procedure: string
  requesterService: string
  externalReference: string | null
  status: DemoCaseStatus
  version: number
  createdAt: string
}

export type DemoRequirement = {
  slotClass: 'QUICK' | 'STANDARD' | 'EXTENDED' | 'OUT_OF_DEMO_RANGE'
  minutes: number
  signals: Array<{ code: string; label: string; minutes: number }>
  explanation: string
}

const TRANSITIONS: Record<DemoCaseStatus, readonly DemoCaseStatus[]> = {
  WAITING_NURSING: ['NURSING_IN_PROGRESS', 'CANCELLED'],
  NURSING_IN_PROGRESS: ['TRIAGE_PENDING', 'READY_FOR_SCHEDULING', 'CANCELLED'],
  TRIAGE_PENDING: ['NURSING_IN_PROGRESS', 'CANCELLED'],
  READY_FOR_SCHEDULING: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['WAITING_ANESTHESIA', 'CANCELLED'],
  WAITING_ANESTHESIA: ['IN_ASSESSMENT', 'CANCELLED'],
  IN_ASSESSMENT: ['PENDING', 'READY_FOR_HANDOFF'],
  PENDING: ['IN_ASSESSMENT', 'WAITING_RETURN'],
  WAITING_RETURN: ['WAITING_ANESTHESIA', 'CANCELLED'],
  READY_FOR_HANDOFF: ['DELIVERED_TO_REQUESTER'],
  DELIVERED_TO_REQUESTER: [],
  CANCELLED: [],
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `case-${Date.now()}-${Math.random()}`
}

export function createDemoCase(
  input: Omit<DemoCase, 'id' | 'displayCode' | 'status' | 'version' | 'createdAt'>,
): DemoCase {
  const id = randomId()
  return {
    ...input,
    externalReference: input.externalReference?.trim() || null,
    id,
    displayCode: `ANT-${id.slice(0, 8).toUpperCase()}`,
    status: 'WAITING_NURSING',
    version: 1,
    createdAt: new Date().toISOString(),
  }
}

export function transitionCase(
  from: DemoCaseStatus,
  to: DemoCaseStatus,
): DemoCaseStatus {
  if (!TRANSITIONS[from].includes(to)) {
    throw new Error(`Transição inválida: ${from} → ${to}`)
  }
  return to
}

function positiveBoolean(answer: SemanticAnswer | undefined): boolean {
  return answer?.state === 'ANSWERED' && answer.value === true
}

function answeredNumber(answer: SemanticAnswer | undefined): number | null {
  return answer?.state === 'ANSWERED' && typeof answer.value === 'number'
    ? answer.value
    : null
}

export function calculateDemoRequirement(
  answers: Record<string, SemanticAnswer>,
): DemoRequirement {
  const signals: DemoRequirement['signals'] = []
  const domainSignals = [
    ['allergy', 'ALLERGY_REVIEW', 'Revisão de alergias'],
    ['anesthesiaHistory', 'ANESTHESIA_HISTORY_REVIEW', 'Histórico anestésico'],
    ['cardiovascular', 'CARDIOVASCULAR_REVIEW', 'Revisão cardiovascular'],
    ['respiratory', 'RESPIRATORY_REVIEW', 'Revisão respiratória'],
    ['bleeding', 'BLEEDING_REVIEW', 'Revisão de sangramento'],
    ['substances', 'SUBSTANCE_REVIEW', 'Revisão de hábitos'],
    ['specialConditions', 'SPECIAL_CONDITION_REVIEW', 'Condição especial'],
  ] as const

  for (const [path, code, label] of domainSignals) {
    if (positiveBoolean(answers[path]) && signals.filter((item) => item.minutes === 5).length < 3) {
      signals.push({ code, label, minutes: 5 })
    }
  }

  if ((answeredNumber(answers.medicationsCount) ?? 0) >= 5) {
    signals.push({ code: 'MEDICATION_VOLUME', label: 'Volume de medicações', minutes: 5 })
  }
  if ((answeredNumber(answers.diagnosesCount) ?? 0) >= 3) {
    signals.push({ code: 'DIAGNOSIS_VOLUME', label: 'Volume de diagnósticos', minutes: 5 })
  }
  if (positiveBoolean(answers.accommodations)) {
    signals.push({ code: 'ACCOMMODATION', label: 'Necessidade de acomodação', minutes: 10 })
  }

  const minutes = 20 + signals.reduce((sum, signal) => sum + signal.minutes, 0)
  const slotClass =
    minutes === 20
      ? 'QUICK'
      : minutes <= 35
        ? 'STANDARD'
        : minutes <= 50
          ? 'EXTENDED'
          : 'OUT_OF_DEMO_RANGE'

  return {
    minutes,
    slotClass,
    signals,
    explanation: signals.length
      ? `Base de 20 min + ${signals.map((item) => `${item.label} (+${item.minutes})`).join(' + ')}.`
      : 'Base de 20 min; nenhuma resposta positiva adicionou tempo.',
  }
}

export const ROLE_LABELS: Record<DemoRole, string> = {
  ADMIN: 'Administração',
  RECEPCAO: 'Recepção',
  ENFERMAGEM: 'Enfermagem',
  ANESTESIOLOGISTA: 'Anestesiologista',
  SOLICITANTE: 'Serviço solicitante',
}
