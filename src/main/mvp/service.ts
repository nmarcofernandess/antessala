import { createHash, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { execute, queryAll, queryOne, transaction } from '../db/query'
import { iaEnviarMensagem } from '../ia/cliente'
import {
  calculateDemoRequirement,
  createDemoCase,
  transitionCase,
  type DemoCase,
  type DemoCaseStatus,
  type DemoRequirement,
  type DemoRole,
  type SemanticAnswer,
} from '../../shared/mvp/workflow'

export type MvpSession = {
  userId: string
  email: string
  name: string
  role: DemoRole
  requesterService: string | null
}

type UserRow = {
  id: string
  email: string
  password_hash: string
  nome: string
  papel: DemoRole
  servico_solicitante: string | null
  ativo: boolean
}

type CaseRow = {
  id: string
  display_code: string
  person_name: string
  sex: string
  age: number
  procedure_name: string
  requester_service: string
  external_reference: string | null
  status: DemoCaseStatus
  version: number
  created_at: string
}

export type MvpSlot = {
  id: string
  startsAt: string
  endsAt: string
  slotClass: 'QUICK' | 'STANDARD' | 'EXTENDED'
  status: 'OPEN' | 'BOOKED' | 'BLOCKED'
}

export type MvpBooking = {
  id: string
  caseId: string
  slotId: string
  kind: 'INITIAL' | 'RETURN'
  status: 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
}

export type MvpPendency = {
  id: string
  caseId: string
  description: string
  impact: 'BLOCKS_CURRENT_RESULT' | 'DOES_NOT_BLOCK_CURRENT_RESULT'
  ownerRole: Exclude<DemoRole, 'ADMIN'>
  requiresReturn: boolean
  status: 'OPEN' | 'EVIDENCE_SUBMITTED' | 'RESOLVED' | 'CANCELLED'
}

export type MvpResult = {
  id: string
  caseId: string
  version: number
  kind: 'FINAL' | 'CORRECTION' | 'ADDENDUM'
  summary: string
  conclusion: string
  reason: string | null
  createdAt: string
}

export type MvpFieldProposal = {
  id: string
  caseId: string
  fieldPath: string
  value: boolean | number | string
  evidence: string
  explanation: string
  status: 'DRAFT' | 'ACCEPTED' | 'REJECTED' | 'CORRECTED'
}

export type MvpKnowledgeRelation = {
  id: string
  subject: string
  predicate: string
  object: string
  rationale: string
  status: 'SUGGESTED' | 'ACTIVE' | 'INACTIVE' | 'SUPERSEDED'
  version: number
}

let currentSession: MvpSession | null = null

const FIXTURE_USERS: Array<{
  id: string
  email: string
  name: string
  role: DemoRole
  service: string | null
}> = [
  { id: 'fixture-admin', email: 'admin@antessala.demo', name: 'Admin Demo', role: 'ADMIN', service: null },
  { id: 'fixture-recepcao', email: 'recepcao@antessala.demo', name: 'Recepção Demo', role: 'RECEPCAO', service: null },
  { id: 'fixture-enfermagem', email: 'enfermagem@antessala.demo', name: 'Enfermagem Demo', role: 'ENFERMAGEM', service: null },
  { id: 'fixture-anestesio', email: 'anestesia@antessala.demo', name: 'Anestesiologista Demo', role: 'ANESTESIOLOGISTA', service: null },
  { id: 'fixture-solicitante', email: 'solicitante@antessala.demo', name: 'Gastroenterologia Demo', role: 'SOLICITANTE', service: 'Gastroenterologia' },
]

function passwordHash(password: string, userId: string): string {
  return scryptSync(password, `antessala:${userId}`, 32).toString('hex')
}

function verifyPassword(password: string, user: UserRow): boolean {
  const actual = Buffer.from(passwordHash(password, user.id), 'hex')
  const expected = Buffer.from(user.password_hash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function requireSession(...roles: DemoRole[]): MvpSession {
  if (!currentSession) throw new Error('Sessão necessária.')
  if (roles.length && !roles.includes(currentSession.role)) throw new Error('FORBIDDEN')
  return currentSession
}

async function audit(action: string, entityType: string, entityId?: string): Promise<void> {
  const session = currentSession
  await execute(
    `INSERT INTO auditoria_eventos (usuario_id, papel, acao, entidade_tipo, entidade_id, resultado)
     VALUES ($1, $2, $3, $4, $5, 'SUCESSO')`,
    session?.userId ?? null,
    session?.role ?? null,
    action,
    entityType,
    entityId ?? null,
  )
}

function mapCase(row: CaseRow): DemoCase {
  return {
    id: row.id,
    displayCode: row.display_code,
    personName: row.person_name,
    sex: row.sex,
    age: row.age,
    procedure: row.procedure_name,
    requesterService: row.requester_service,
    externalReference: row.external_reference,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
  }
}

export async function seedMvpData(): Promise<void> {
  for (const user of FIXTURE_USERS) {
    await execute(
      `INSERT INTO usuarios (id, email, password_hash, nome, papel, servico_solicitante, origem)
       VALUES ($1, $2, $3, $4, $5, $6, 'FIXTURE') ON CONFLICT (id) DO NOTHING`,
      user.id,
      user.email,
      passwordHash('demo123', user.id),
      user.name,
      user.role,
      user.service,
    )
  }

  const base = new Date()
  base.setUTCHours(9, 0, 0, 0)
  base.setUTCDate(base.getUTCDate() + 1)
  const configs = [
    { key: 'quick', slotClass: 'QUICK', minutes: 25 },
    { key: 'standard', slotClass: 'STANDARD', minutes: 40 },
    { key: 'extended', slotClass: 'EXTENDED', minutes: 60 },
  ] as const
  for (let day = 0; day < 5; day += 1) {
    for (let index = 0; index < configs.length; index += 1) {
      const config = configs[index]!
      const startsAt = new Date(base)
      startsAt.setUTCDate(base.getUTCDate() + day)
      startsAt.setUTCHours(9 + index, 0, 0, 0)
      const endsAt = new Date(startsAt.getTime() + config.minutes * 60_000)
      await execute(
        `INSERT INTO scheduling_slots (id, starts_at, ends_at, slot_class)
         VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        `fixture-${day}-${config.key}`,
        startsAt.toISOString(),
        endsAt.toISOString(),
        config.slotClass,
      )
    }
  }
}

export async function login(input: { email: string; password: string }): Promise<MvpSession> {
  const user = await queryOne<UserRow>(
    `SELECT id, email, password_hash, nome, papel, servico_solicitante, ativo
     FROM usuarios WHERE lower(email) = lower($1)`,
    input.email.trim(),
  )
  if (!user || !user.ativo || !verifyPassword(input.password, user)) {
    throw new Error('Credenciais inválidas.')
  }
  currentSession = {
    userId: user.id,
    email: user.email,
    name: user.nome,
    role: user.papel,
    requesterService: user.servico_solicitante,
  }
  await audit('AUTH_LOGIN', 'SESSION')
  return currentSession
}

export async function logout(): Promise<void> {
  if (currentSession) await audit('AUTH_LOGOUT', 'SESSION')
  currentSession = null
}

export function getCurrentSession(): MvpSession | null {
  return currentSession
}

export async function createCase(
  input: Omit<DemoCase, 'id' | 'displayCode' | 'status' | 'version' | 'createdAt'>,
): Promise<DemoCase> {
  const session = requireSession('RECEPCAO')
  const item = createDemoCase(input)
  await transaction(async () => {
    await execute(
      `INSERT INTO preop_cases (
        id, display_code, person_name, sex, age, procedure_name, requester_service,
        external_reference, status, version, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      item.id,
      item.displayCode,
      item.personName,
      item.sex,
      item.age,
      item.procedure,
      item.requesterService,
      item.externalReference,
      item.status,
      item.version,
      item.createdAt,
    )
    await execute(
      `INSERT INTO case_events (case_id, event_type, actor_id) VALUES ($1, 'CASE_OPENED', $2)`,
      item.id,
      session.userId,
    )
    await audit('CASE_CREATE', 'CASE', item.id)
  })
  return item
}

export async function listCasesForCurrentRole(): Promise<DemoCase[]> {
  const session = requireSession()
  const filters: Record<DemoRole, DemoCaseStatus[]> = {
    ADMIN: [],
    RECEPCAO: ['READY_FOR_SCHEDULING', 'SCHEDULED', 'WAITING_RETURN', 'READY_FOR_HANDOFF'],
    ENFERMAGEM: ['WAITING_NURSING', 'NURSING_IN_PROGRESS', 'TRIAGE_PENDING'],
    ANESTESIOLOGISTA: ['WAITING_ANESTHESIA', 'IN_ASSESSMENT', 'PENDING', 'READY_FOR_HANDOFF'],
    SOLICITANTE: ['PENDING', 'READY_FOR_HANDOFF', 'DELIVERED_TO_REQUESTER'],
  }
  if (session.role === 'ADMIN') return []
  const rows = await queryAll<CaseRow>(
    `SELECT * FROM preop_cases
     WHERE status = ANY($1::text[])
       AND ($2::text IS NULL OR requester_service = $2)
     ORDER BY created_at`,
    filters[session.role],
    session.role === 'SOLICITANTE' ? session.requesterService : null,
  )
  return rows.map(mapCase)
}

async function moveCase(caseId: string, to: DemoCaseStatus, eventType: string): Promise<DemoCase> {
  const session = requireSession()
  const current = await queryOne<CaseRow>('SELECT * FROM preop_cases WHERE id = $1', caseId)
  if (!current) throw new Error('NOT_FOUND')
  transitionCase(current.status, to)
  const updated = await queryOne<CaseRow>(
    `UPDATE preop_cases SET status = $2, version = version + 1, updated_at = NOW()
     WHERE id = $1 AND version = $3 RETURNING *`,
    caseId,
    to,
    current.version,
  )
  if (!updated) throw new Error('VERSION_CONFLICT')
  await execute(
    `INSERT INTO case_events (case_id, event_type, actor_id) VALUES ($1,$2,$3)`,
    caseId,
    eventType,
    session.userId,
  )
  return mapCase(updated)
}

export async function startNursing(caseId: string): Promise<DemoCase> {
  requireSession('ENFERMAGEM')
  return moveCase(caseId, 'NURSING_IN_PROGRESS', 'NURSING_STARTED')
}

export async function saveAndSubmitTriage(
  caseId: string,
  answers: Record<string, SemanticAnswer>,
): Promise<DemoRequirement> {
  const session = requireSession('ENFERMAGEM')
  const current = await queryOne<CaseRow>('SELECT * FROM preop_cases WHERE id = $1', caseId)
  if (!current || current.status !== 'NURSING_IN_PROGRESS') throw new Error('INVALID_TRANSITION')
  const requirement = calculateDemoRequirement(answers)
  await transaction(async () => {
    await execute(
      `INSERT INTO clinical_anamneses (case_id, answers, status, authored_by, submitted_at)
       VALUES ($1,$2::jsonb,'FINAL',$3,NOW())
       ON CONFLICT (case_id) DO UPDATE SET answers=EXCLUDED.answers, status='FINAL',
         authored_by=EXCLUDED.authored_by, submitted_at=NOW(), version=clinical_anamneses.version+1`,
      caseId,
      JSON.stringify(answers),
      session.userId,
    )
    await execute(
      `INSERT INTO scheduling_requirements
       (case_id,status,slot_class,minutes,signals,explanation)
       VALUES ($1,'CALCULATED',$2,$3,$4::jsonb,$5)
       ON CONFLICT (case_id) DO UPDATE SET status='CALCULATED',slot_class=EXCLUDED.slot_class,
         minutes=EXCLUDED.minutes,signals=EXCLUDED.signals,explanation=EXCLUDED.explanation,
         version=scheduling_requirements.version+1,updated_at=NOW()`,
      caseId,
      requirement.slotClass,
      requirement.minutes,
      JSON.stringify(requirement.signals),
      requirement.explanation,
    )
    await execute(
      `INSERT INTO case_events (case_id,event_type,actor_id,payload)
       VALUES ($1,'TRIAGE_SUBMITTED',$2,$3::jsonb)`,
      caseId,
      session.userId,
      JSON.stringify({ slotClass: requirement.slotClass, minutes: requirement.minutes }),
    )
    await audit('TRIAGE_SUBMIT', 'CASE', caseId)
  })
  return requirement
}

export async function confirmRequirement(
  caseId: string,
  input: {
    decision: 'CONFIRM' | 'OVERRIDE'
    reason: string | null
    slotClass?: 'QUICK' | 'STANDARD' | 'EXTENDED'
    minutes?: number
  },
): Promise<DemoRequirement> {
  const session = requireSession('ENFERMAGEM')
  const requirement = await queryOne<{
    slot_class: DemoRequirement['slotClass']
    minutes: number
    signals: DemoRequirement['signals']
    explanation: string
  }>('SELECT slot_class, minutes, signals, explanation FROM scheduling_requirements WHERE case_id=$1', caseId)
  if (!requirement) throw new Error('NOT_FOUND')
  if (input.decision === 'OVERRIDE' && (!input.reason?.trim() || !input.slotClass || !input.minutes)) {
    throw new Error('Justificativa e requisito efetivo são obrigatórios.')
  }
  const slotClass = input.decision === 'OVERRIDE' ? input.slotClass! : requirement.slot_class
  const minutes = input.decision === 'OVERRIDE' ? input.minutes! : requirement.minutes
  if (slotClass === 'OUT_OF_DEMO_RANGE') throw new Error('Requisito fora do alcance da demo.')
  await transaction(async () => {
    await execute(
      `UPDATE scheduling_requirements SET status=$2,slot_class=$3,minutes=$4,
       decided_by=$5,decision_reason=$6,version=version+1,updated_at=NOW() WHERE case_id=$1`,
      caseId,
      input.decision === 'CONFIRM' ? 'CONFIRMED' : 'OVERRIDDEN',
      slotClass,
      minutes,
      session.userId,
      input.reason,
    )
    await moveCase(caseId, 'READY_FOR_SCHEDULING', 'REQUIREMENT_PUBLISHED')
    await audit('REQUIREMENT_DECIDE', 'CASE', caseId)
  })
  return { slotClass, minutes, signals: requirement.signals, explanation: requirement.explanation }
}

export async function listCompatibleSlots(caseId: string): Promise<MvpSlot[]> {
  requireSession('RECEPCAO')
  const requirement = await queryOne<{ slot_class: MvpSlot['slotClass']; status: string }>(
    `SELECT slot_class,status FROM scheduling_requirements WHERE case_id=$1`,
    caseId,
  )
  if (!requirement || !['CONFIRMED', 'OVERRIDDEN'].includes(requirement.status)) {
    throw new Error('Requisito ainda não publicado.')
  }
  const rows = await queryAll<{
    id: string
    starts_at: string
    ends_at: string
    slot_class: MvpSlot['slotClass']
    status: MvpSlot['status']
  }>(
    `SELECT * FROM scheduling_slots WHERE status='OPEN' AND slot_class=$1
     AND starts_at > NOW() ORDER BY starts_at`,
    requirement.slot_class,
  )
  return rows.map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    slotClass: row.slot_class,
    status: row.status,
  }))
}

export async function bookCompatibleSlot(caseId: string, slotId: string): Promise<MvpBooking> {
  const session = requireSession('RECEPCAO')
  const slots = await listCompatibleSlots(caseId)
  if (!slots.some((slot) => slot.id === slotId)) throw new Error('SLOT_INCOMPATIBLE')
  const id = randomUUID()
  await transaction(async () => {
    const claimed = await queryOne<{ id: string }>(
      `UPDATE scheduling_slots SET status='BOOKED' WHERE id=$1 AND status='OPEN' RETURNING id`,
      slotId,
    )
    if (!claimed) throw new Error('SLOT_TAKEN')
    await execute(
      `INSERT INTO scheduling_bookings (id,case_id,slot_id,kind,status,created_by)
       VALUES ($1,$2,$3,'INITIAL','CONFIRMED',$4)`,
      id,
      caseId,
      slotId,
      session.userId,
    )
    await moveCase(caseId, 'SCHEDULED', 'BOOKING_CONFIRMED')
    await audit('BOOKING_CONFIRM', 'CASE', caseId)
  })
  return { id, caseId, slotId, kind: 'INITIAL', status: 'CONFIRMED' }
}

export async function checkInBooking(caseId: string): Promise<MvpBooking> {
  requireSession('RECEPCAO')
  const booking = await queryOne<{
    id: string; case_id: string; slot_id: string; kind: MvpBooking['kind']; status: MvpBooking['status']
  }>(`SELECT * FROM scheduling_bookings WHERE case_id=$1 AND status='CONFIRMED' ORDER BY created_at DESC LIMIT 1`, caseId)
  if (!booking) throw new Error('BOOKING_NOT_FOUND')
  await transaction(async () => {
    await execute(`UPDATE scheduling_bookings SET status='CHECKED_IN' WHERE id=$1`, booking.id)
    await moveCase(caseId, 'WAITING_ANESTHESIA', 'BOOKING_CHECKED_IN')
    await audit('BOOKING_CHECK_IN', 'CASE', caseId)
  })
  return { id: booking.id, caseId, slotId: booking.slot_id, kind: booking.kind, status: 'CHECKED_IN' }
}

export async function startAssessment(caseId: string): Promise<{ id: string; caseId: string; kind: 'INITIAL' | 'RETURN'; status: 'OPEN' }> {
  const session = requireSession('ANESTESIOLOGISTA')
  const id = randomUUID()
  const previous = await queryOne<{ count: number }>('SELECT COUNT(*)::int AS count FROM anesthesia_encounters WHERE case_id=$1', caseId)
  const kind = (previous?.count ?? 0) > 0 ? 'RETURN' : 'INITIAL'
  await transaction(async () => {
    await execute(
      `INSERT INTO anesthesia_encounters (id,case_id,kind,status,started_by)
       VALUES ($1,$2,$3,'OPEN',$4)`,
      id, caseId, kind, session.userId,
    )
    await moveCase(caseId, 'IN_ASSESSMENT', 'ASSESSMENT_STARTED')
    await audit('ASSESSMENT_START', 'CASE', caseId)
  })
  return { id, caseId, kind, status: 'OPEN' }
}

export async function openPendency(
  caseId: string,
  input: {
    description: string
    impact: MvpPendency['impact']
    ownerRole: MvpPendency['ownerRole']
    requiresReturn: boolean
  },
): Promise<MvpPendency> {
  const session = requireSession('ANESTESIOLOGISTA')
  if (!input.description.trim()) throw new Error('Descrição obrigatória.')
  const id = randomUUID()
  await transaction(async () => {
    await execute(
      `INSERT INTO case_pendencies
       (id,case_id,description,impact,owner_role,requires_return,status,opened_by)
       VALUES ($1,$2,$3,$4,$5,$6,'OPEN',$7)`,
      id, caseId, input.description.trim(), input.impact, input.ownerRole,
      input.requiresReturn, session.userId,
    )
    if (input.impact === 'BLOCKS_CURRENT_RESULT') {
      await moveCase(caseId, 'PENDING', 'PENDENCY_OPENED')
    }
    await audit('PENDENCY_OPEN', 'CASE', caseId)
  })
  return { id, caseId, ...input, description: input.description.trim(), status: 'OPEN' }
}

export async function submitPendencyEvidence(
  pendencyId: string,
  evidence: string,
): Promise<MvpPendency> {
  const session = requireSession('RECEPCAO', 'ENFERMAGEM', 'SOLICITANTE')
  const row = await queryOne<{
    id: string; case_id: string; description: string; impact: MvpPendency['impact']
    owner_role: MvpPendency['ownerRole']; requires_return: boolean; status: MvpPendency['status']
    requester_service: string
  }>(
    `SELECT p.*,c.requester_service FROM case_pendencies p JOIN preop_cases c ON c.id=p.case_id WHERE p.id=$1`,
    pendencyId,
  )
  if (!row || row.status !== 'OPEN' || row.owner_role !== session.role) throw new Error('FORBIDDEN')
  if (session.role === 'SOLICITANTE' && row.requester_service !== session.requesterService) throw new Error('NOT_FOUND')
  if (!evidence.trim()) throw new Error('Evidência vazia.')
  await execute(
    `UPDATE case_pendencies SET status='EVIDENCE_SUBMITTED',evidence=$2::jsonb WHERE id=$1`,
    pendencyId, JSON.stringify({ text: evidence.trim(), submittedBy: session.userId }),
  )
  await audit('PENDENCY_EVIDENCE_SUBMIT', 'PENDENCY', pendencyId)
  return {
    id: row.id, caseId: row.case_id, description: row.description, impact: row.impact,
    ownerRole: row.owner_role, requiresReturn: row.requires_return, status: 'EVIDENCE_SUBMITTED',
  }
}

export async function listPendencies(caseId: string): Promise<MvpPendency[]> {
  const session = requireSession('RECEPCAO', 'ENFERMAGEM', 'ANESTESIOLOGISTA', 'SOLICITANTE')
  const item = await queryOne<{ requester_service: string }>('SELECT requester_service FROM preop_cases WHERE id=$1', caseId)
  if (!item || (session.role === 'SOLICITANTE' && item.requester_service !== session.requesterService)) throw new Error('NOT_FOUND')
  const rows = await queryAll<{
    id: string; case_id: string; description: string; impact: MvpPendency['impact']
    owner_role: MvpPendency['ownerRole']; requires_return: boolean; status: MvpPendency['status']
  }>(
    `SELECT id,case_id,description,impact,owner_role,requires_return,status FROM case_pendencies
     WHERE case_id=$1 AND ($2::text='ANESTESIOLOGISTA' OR owner_role=$2) ORDER BY created_at`,
    caseId, session.role,
  )
  return rows.map((row) => ({
    id: row.id, caseId: row.case_id, description: row.description, impact: row.impact,
    ownerRole: row.owner_role, requiresReturn: row.requires_return, status: row.status,
  }))
}

export async function acceptPendencyEvidence(
  pendencyId: string,
): Promise<{ id: string; caseId: string; status: 'OPEN' } | null> {
  const session = requireSession('ANESTESIOLOGISTA')
  const row = await queryOne<{
    id: string; case_id: string; impact: MvpPendency['impact']; requires_return: boolean; status: MvpPendency['status']
  }>('SELECT id,case_id,impact,requires_return,status FROM case_pendencies WHERE id=$1', pendencyId)
  if (!row || row.status !== 'EVIDENCE_SUBMITTED') throw new Error('EVIDENCE_NOT_SUBMITTED')
  let request: { id: string; caseId: string; status: 'OPEN' } | null = null
  await transaction(async () => {
    await execute(`UPDATE case_pendencies SET status='RESOLVED',resolved_at=NOW() WHERE id=$1`, pendencyId)
    if (row.impact === 'BLOCKS_CURRENT_RESULT') {
      if (row.requires_return) {
        const requestId = randomUUID()
        await execute(
          `INSERT INTO return_requests (id,case_id,reason,slot_class,status,requested_by)
           SELECT $1,$2,'Retorno após pendência',$3,'OPEN',$4
           FROM scheduling_requirements WHERE case_id=$2`,
          requestId, row.case_id,
          (await queryOne<{ slot_class: string }>('SELECT slot_class FROM scheduling_requirements WHERE case_id=$1', row.case_id))!.slot_class,
          session.userId,
        )
        await execute(`UPDATE anesthesia_encounters SET status='CLOSED',closed_at=NOW() WHERE case_id=$1 AND status='OPEN'`, row.case_id)
        await execute(`UPDATE scheduling_bookings SET status='COMPLETED' WHERE case_id=$1 AND status='CHECKED_IN'`, row.case_id)
        await moveCase(row.case_id, 'WAITING_RETURN', 'RETURN_REQUESTED')
        request = { id: requestId, caseId: row.case_id, status: 'OPEN' }
      } else {
        await moveCase(row.case_id, 'IN_ASSESSMENT', 'PENDENCY_RESOLVED')
      }
    }
    await audit('PENDENCY_EVIDENCE_ACCEPT', 'PENDENCY', pendencyId)
  })
  return request
}

export async function bookReturnSlot(caseId: string, slotId: string): Promise<MvpBooking> {
  const session = requireSession('RECEPCAO')
  const current = await queryOne<CaseRow>('SELECT * FROM preop_cases WHERE id=$1', caseId)
  const request = await queryOne<{ id: string }>(`SELECT id FROM return_requests WHERE case_id=$1 AND status='OPEN'`, caseId)
  if (!current || current.status !== 'WAITING_RETURN' || !request) throw new Error('RETURN_NOT_READY')
  const slots = await listCompatibleSlots(caseId)
  if (!slots.some((slot) => slot.id === slotId)) throw new Error('SLOT_INCOMPATIBLE')
  const id = randomUUID()
  await transaction(async () => {
    const claimed = await queryOne<{ id: string }>(`UPDATE scheduling_slots SET status='BOOKED' WHERE id=$1 AND status='OPEN' RETURNING id`, slotId)
    if (!claimed) throw new Error('SLOT_TAKEN')
    await execute(
      `INSERT INTO scheduling_bookings (id,case_id,slot_id,kind,status,created_by)
       VALUES ($1,$2,$3,'RETURN','CONFIRMED',$4)`, id, caseId, slotId, session.userId,
    )
    await execute(`UPDATE return_requests SET status='BOOKED' WHERE id=$1`, request.id)
    await execute(`INSERT INTO case_events (case_id,event_type,actor_id) VALUES ($1,'RETURN_BOOKED',$2)`, caseId, session.userId)
    await audit('RETURN_BOOK', 'CASE', caseId)
  })
  return { id, caseId, slotId, kind: 'RETURN', status: 'CONFIRMED' }
}

function mapResult(row: {
  id: string; case_id: string; version: number; kind: MvpResult['kind']; summary: string
  conclusion: string; reason: string | null; created_at: string
}): MvpResult {
  return {
    id: row.id, caseId: row.case_id, version: row.version, kind: row.kind,
    summary: row.summary, conclusion: row.conclusion, reason: row.reason, createdAt: row.created_at,
  }
}

export async function getCurrentResult(caseId: string): Promise<MvpResult | null> {
  const session = requireSession('ANESTESIOLOGISTA', 'RECEPCAO', 'SOLICITANTE')
  const row = await queryOne<{
    id: string; case_id: string; version: number; kind: MvpResult['kind']; summary: string
    conclusion: string; reason: string | null; created_at: string; requester_service: string
  }>(
    `SELECT r.*, c.requester_service FROM preop_result_heads h
     JOIN preop_results r ON r.id=h.result_id JOIN preop_cases c ON c.id=r.case_id
     WHERE h.case_id=$1`, caseId,
  )
  if (!row) return null
  if (session.role === 'SOLICITANTE' && row.requester_service !== session.requesterService) throw new Error('NOT_FOUND')
  return mapResult(row)
}

export async function finalizeResult(
  caseId: string,
  input: { summary: string; conclusion: string },
): Promise<MvpResult> {
  const session = requireSession('ANESTESIOLOGISTA')
  if (!input.summary.trim() || !input.conclusion.trim()) throw new Error('Resultado incompleto.')
  const current = await queryOne<CaseRow>('SELECT * FROM preop_cases WHERE id=$1', caseId)
  if (!current || current.status !== 'IN_ASSESSMENT') throw new Error('INVALID_TRANSITION')
  const blocker = await queryOne<{ id: string }>(
    `SELECT id FROM case_pendencies WHERE case_id=$1 AND impact='BLOCKS_CURRENT_RESULT'
     AND status NOT IN ('RESOLVED','CANCELLED') LIMIT 1`, caseId,
  )
  if (blocker) throw new Error('BLOCKING_PENDENCY')
  const id = randomUUID()
  await transaction(async () => {
    await execute(
      `INSERT INTO preop_results
       (id,case_id,version,kind,summary,conclusion,authored_by)
       VALUES ($1,$2,1,'FINAL',$3,$4,$5)`,
      id, caseId, input.summary.trim(), input.conclusion.trim(), session.userId,
    )
    await execute(`INSERT INTO preop_result_heads (case_id,result_id) VALUES ($1,$2)`, caseId, id)
    await execute(`UPDATE anesthesia_encounters SET status='CLOSED',closed_at=NOW() WHERE case_id=$1 AND status='OPEN'`, caseId)
    await execute(`UPDATE scheduling_bookings SET status='COMPLETED' WHERE case_id=$1 AND status='CHECKED_IN'`, caseId)
    await moveCase(caseId, 'READY_FOR_HANDOFF', 'RESULT_FINALIZED')
    await audit('RESULT_FINALIZE', 'CASE', caseId)
  })
  return { id, caseId, version: 1, kind: 'FINAL', summary: input.summary.trim(), conclusion: input.conclusion.trim(), reason: null, createdAt: new Date().toISOString() }
}

export async function reviseResult(
  caseId: string,
  input: { kind: 'CORRECTION' | 'ADDENDUM'; reason: string; summary: string; conclusion: string },
): Promise<MvpResult> {
  const session = requireSession('ANESTESIOLOGISTA')
  const previous = await getCurrentResult(caseId)
  if (!previous) throw new Error('RESULT_NOT_FOUND')
  if (!input.reason.trim()) throw new Error('Motivo obrigatório.')
  const id = randomUUID()
  const version = previous.version + 1
  await transaction(async () => {
    await execute(
      `INSERT INTO preop_results
       (id,case_id,version,kind,summary,conclusion,reason,authored_by,supersedes_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      id, caseId, version, input.kind, input.summary.trim(), input.conclusion.trim(),
      input.reason.trim(), session.userId, previous.id,
    )
    await execute(`UPDATE preop_result_heads SET result_id=$2 WHERE case_id=$1`, caseId, id)
    await execute(
      `INSERT INTO case_events (case_id,event_type,actor_id,payload)
       VALUES ($1,'RESULT_REVISED',$2,$3::jsonb)`,
      caseId, session.userId, JSON.stringify({ kind: input.kind, version }),
    )
    await audit('RESULT_REVISE', 'CASE', caseId)
  })
  return { id, caseId, version, kind: input.kind, summary: input.summary.trim(), conclusion: input.conclusion.trim(), reason: input.reason.trim(), createdAt: new Date().toISOString() }
}

export async function sendResultToRequester(caseId: string): Promise<{ id: string; status: 'SENT' }> {
  const session = requireSession('RECEPCAO')
  const current = await queryOne<CaseRow>('SELECT * FROM preop_cases WHERE id=$1', caseId)
  const result = await queryOne<{ result_id: string }>('SELECT result_id FROM preop_result_heads WHERE case_id=$1', caseId)
  if (!current || current.status !== 'READY_FOR_HANDOFF' || !result) throw new Error('RESULT_NOT_READY')
  const id = randomUUID()
  await transaction(async () => {
    await execute(
      `INSERT INTO result_deliveries (id,case_id,result_id,requester_service,status,sent_by)
       VALUES ($1,$2,$3,$4,'SENT',$5)`,
      id, caseId, result.result_id, current.requester_service, session.userId,
    )
    await execute(`INSERT INTO case_events (case_id,event_type,actor_id) VALUES ($1,'RESULT_SENT',$2)`, caseId, session.userId)
    await audit('RESULT_SEND', 'CASE', caseId)
  })
  return { id, status: 'SENT' }
}

export async function acknowledgeDelivery(caseId: string): Promise<{ id: string; status: 'ACKNOWLEDGED' }> {
  const session = requireSession('SOLICITANTE')
  const delivery = await queryOne<{ id: string; requester_service: string; status: string }>(
    `SELECT id,requester_service,status FROM result_deliveries WHERE case_id=$1`, caseId,
  )
  if (!delivery || delivery.requester_service !== session.requesterService || delivery.status !== 'SENT') throw new Error('NOT_FOUND')
  await transaction(async () => {
    await execute(
      `UPDATE result_deliveries SET status='ACKNOWLEDGED',acknowledged_by=$2,acknowledged_at=NOW() WHERE id=$1`,
      delivery.id, session.userId,
    )
    await moveCase(caseId, 'DELIVERED_TO_REQUESTER', 'RESULT_ACKNOWLEDGED')
    await audit('RESULT_ACKNOWLEDGE', 'CASE', caseId)
  })
  return { id: delivery.id, status: 'ACKNOWLEDGED' }
}

type ProposedField = Omit<MvpFieldProposal, 'id' | 'caseId' | 'status'>
type ProposalGenerator = (transcript: string) => Promise<ProposedField[]>

async function geminiProposalGenerator(transcript: string): Promise<ProposedField[]> {
  const config = await queryOne<{ provider: string }>('SELECT provider FROM configuracao_ia WHERE id=1')
  if (config?.provider !== 'gemini') throw new Error('Configure o Gemini para usar sugestões assistivas.')
  const prompt = [
    'Extraia apenas fatos explicitamente presentes na transcrição para os campos allergy, cardiovascular, respiratory, medicationsCount e accommodations.',
    'Responda somente JSON: [{"fieldPath":"...","value":true,"evidence":"trecho literal curto","explanation":"por que o trecho sustenta a proposta"}].',
    'Não infira negativas, urgência, gravidade, prioridade, duração, ASA, aptidão ou conduta.',
    `TRANSCRIÇÃO:\n${transcript}`,
  ].join('\n')
  const { resposta } = await iaEnviarMensagem(prompt)
  const raw = resposta.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) throw new Error('Resposta do Gemini fora do contrato.')
  const allowed = new Set(['allergy', 'cardiovascular', 'respiratory', 'medicationsCount', 'accommodations'])
  return parsed.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Proposta inválida.')
    const value = item as Record<string, unknown>
    if (!allowed.has(String(value.fieldPath))) throw new Error('Campo proposto fora da allowlist.')
    if (!['boolean', 'number', 'string'].includes(typeof value.value)) throw new Error('Valor proposto inválido.')
    if (!String(value.evidence ?? '').trim() || !String(value.explanation ?? '').trim()) throw new Error('Proposta sem origem ou explicação.')
    return {
      fieldPath: String(value.fieldPath),
      value: value.value as boolean | number | string,
      evidence: String(value.evidence).trim(),
      explanation: String(value.explanation).trim(),
    }
  })
}

export async function proposeFieldsFromTranscript(
  caseId: string,
  transcript: string,
  generator: ProposalGenerator = geminiProposalGenerator,
): Promise<MvpFieldProposal[]> {
  const session = requireSession('ENFERMAGEM')
  if (!transcript.trim()) throw new Error('Transcrição vazia.')
  const proposals = await generator(transcript.trim())
  const transcriptHash = createHash('sha256').update(transcript).digest('hex')
  const saved: MvpFieldProposal[] = []
  await transaction(async () => {
    for (const proposal of proposals) {
      const id = randomUUID()
      await execute(
        `INSERT INTO ai_field_proposals
         (id,case_id,field_path,proposed_value,evidence_excerpt,explanation,status,transcript_hash,created_by)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,'DRAFT',$7,$8)`,
        id, caseId, proposal.fieldPath, JSON.stringify(proposal.value), proposal.evidence,
        proposal.explanation, transcriptHash, session.userId,
      )
      saved.push({ id, caseId, ...proposal, status: 'DRAFT' })
    }
    await audit('AI_PROPOSALS_CREATE', 'CASE', caseId)
  })
  return saved
}

export async function confirmFieldProposal(
  proposalId: string,
  decision: 'ACCEPT' | 'REJECT',
): Promise<MvpFieldProposal> {
  const session = requireSession('ENFERMAGEM')
  const row = await queryOne<{
    id: string; case_id: string; field_path: string; proposed_value: boolean | number | string
    evidence_excerpt: string; explanation: string; status: MvpFieldProposal['status']
  }>('SELECT * FROM ai_field_proposals WHERE id=$1', proposalId)
  if (!row || row.status !== 'DRAFT') throw new Error('PROPOSAL_NOT_DRAFT')
  const status = decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED'
  await execute(
    `UPDATE ai_field_proposals SET status=$2,reviewed_by=$3,reviewed_at=NOW() WHERE id=$1`,
    proposalId, status, session.userId,
  )
  await audit(`AI_PROPOSAL_${decision}`, 'AI_FIELD_PROPOSAL', proposalId)
  return {
    id: row.id, caseId: row.case_id, fieldPath: row.field_path, value: row.proposed_value,
    evidence: row.evidence_excerpt, explanation: row.explanation, status,
  }
}

export async function suggestKnowledgeRelation(
  input: Omit<MvpKnowledgeRelation, 'id' | 'status' | 'version'>,
): Promise<MvpKnowledgeRelation> {
  const session = requireSession('ANESTESIOLOGISTA')
  if (![input.subject, input.predicate, input.object, input.rationale].every((value) => value.trim())) throw new Error('Relação incompleta.')
  const id = randomUUID()
  await execute(
    `INSERT INTO mvp_knowledge_relations (id,subject,predicate,object,rationale,suggested_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    id, input.subject.trim(), input.predicate.trim(), input.object.trim(), input.rationale.trim(), session.userId,
  )
  await audit('KNOWLEDGE_SUGGEST', 'KNOWLEDGE_RELATION', id)
  return { id, ...input, status: 'SUGGESTED', version: 1 }
}

export async function approveKnowledgeRelation(id: string): Promise<MvpKnowledgeRelation> {
  const session = requireSession('ANESTESIOLOGISTA')
  const row = await queryOne<{
    id: string; subject: string; predicate: string; object: string; rationale: string
    status: MvpKnowledgeRelation['status']; version: number
  }>(
    `UPDATE mvp_knowledge_relations SET status='ACTIVE',approved_by=$2,approved_at=NOW()
     WHERE id=$1 AND status='SUGGESTED' RETURNING *`, id, session.userId,
  )
  if (!row) throw new Error('RELATION_NOT_SUGGESTED')
  await audit('KNOWLEDGE_APPROVE', 'KNOWLEDGE_RELATION', id)
  return row
}

export async function searchApprovedKnowledge(term: string): Promise<MvpKnowledgeRelation[]> {
  requireSession('ENFERMAGEM', 'ANESTESIOLOGISTA')
  const rows = await queryAll<{
    id: string; subject: string; predicate: string; object: string; rationale: string
    status: MvpKnowledgeRelation['status']; version: number
  }>(
    `SELECT id,subject,predicate,object,rationale,status,version FROM mvp_knowledge_relations
     WHERE status='ACTIVE' AND (subject ILIKE $1 OR predicate ILIKE $1 OR object ILIKE $1)
     ORDER BY approved_at DESC`, `%${term.trim()}%`,
  )
  return rows
}

export async function listFixtureUsers(): Promise<Array<Omit<MvpSession, 'userId'> & { userId: string }>> {
  requireSession('ADMIN')
  const rows = await queryAll<UserRow>('SELECT * FROM usuarios ORDER BY papel')
  return rows.map((user) => ({
    userId: user.id,
    email: user.email,
    name: user.nome,
    role: user.papel,
    requesterService: user.servico_solicitante,
  }))
}
