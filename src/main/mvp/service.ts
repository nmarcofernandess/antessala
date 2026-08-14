import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { execute, queryAll, queryOne, transaction } from '../db/query'
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
    SOLICITANTE: ['READY_FOR_HANDOFF', 'DELIVERED_TO_REQUESTER'],
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
