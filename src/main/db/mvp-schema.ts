import { execDDL } from './query'

const DDL_MVP = `
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('ADMIN','RECEPCAO','ENFERMAGEM','ANESTESIOLOGISTA','SOLICITANTE')),
  servico_solicitante TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  origem TEXT NOT NULL DEFAULT 'FIXTURE',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria_eventos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  papel TEXT,
  acao TEXT NOT NULL,
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT,
  resultado TEXT NOT NULL CHECK (resultado IN ('SUCESSO','FALHA','NEGADO')),
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preop_cases (
  id TEXT PRIMARY KEY,
  display_code TEXT NOT NULL UNIQUE,
  person_name TEXT NOT NULL,
  sex TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 130),
  procedure_name TEXT NOT NULL,
  requester_service TEXT NOT NULL,
  external_reference TEXT,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preop_cases_status ON preop_cases(status, created_at);
CREATE INDEX IF NOT EXISTS idx_preop_cases_reference
  ON preop_cases(requester_service, external_reference)
  WHERE external_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS case_events (
  id BIGSERIAL PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinical_anamneses (
  case_id TEXT PRIMARY KEY REFERENCES preop_cases(id) ON DELETE RESTRICT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','FINAL')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  authored_by TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  submitted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS scheduling_requirements (
  case_id TEXT PRIMARY KEY REFERENCES preop_cases(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('CALCULATED','CONFIRMED','OVERRIDDEN')),
  slot_class TEXT NOT NULL CHECK (slot_class IN ('QUICK','STANDARD','EXTENDED','OUT_OF_DEMO_RANGE')),
  minutes INTEGER NOT NULL CHECK (minutes BETWEEN 20 AND 120),
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT NOT NULL,
  decided_by TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  decision_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduling_slots (
  id TEXT PRIMARY KEY,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  slot_class TEXT NOT NULL CHECK (slot_class IN ('QUICK','STANDARD','EXTENDED')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','BOOKED','BLOCKED')),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS scheduling_bookings (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  slot_id TEXT NOT NULL REFERENCES scheduling_slots(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL DEFAULT 'INITIAL' CHECK (kind IN ('INITIAL','RETURN')),
  status TEXT NOT NULL CHECK (status IN ('CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','NO_SHOW')),
  created_by TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_slot
  ON scheduling_bookings(slot_id) WHERE status IN ('CONFIRMED','CHECKED_IN');
CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_case
  ON scheduling_bookings(case_id) WHERE status IN ('CONFIRMED','CHECKED_IN');

CREATE TABLE IF NOT EXISTS anesthesia_encounters (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL DEFAULT 'INITIAL' CHECK (kind IN ('INITIAL','RETURN')),
  status TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  started_by TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS case_pendencies (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('BLOCKS_CURRENT_RESULT','DOES_NOT_BLOCK_CURRENT_RESULT')),
  owner_role TEXT NOT NULL CHECK (owner_role IN ('RECEPCAO','ENFERMAGEM','ANESTESIOLOGISTA','SOLICITANTE')),
  requires_return BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','EVIDENCE_SUBMITTED','RESOLVED','CANCELLED')),
  opened_by TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  evidence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS return_requests (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  slot_class TEXT NOT NULL CHECK (slot_class IN ('QUICK','STANDARD','EXTENDED')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','BOOKED','COMPLETED','CANCELLED')),
  requested_by TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preop_results (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  kind TEXT NOT NULL CHECK (kind IN ('FINAL','CORRECTION','ADDENDUM')),
  summary TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  reason TEXT,
  authored_by TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  supersedes_id TEXT REFERENCES preop_results(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(case_id, version)
);

CREATE TABLE IF NOT EXISTS preop_result_heads (
  case_id TEXT PRIMARY KEY REFERENCES preop_cases(id) ON DELETE RESTRICT,
  result_id TEXT NOT NULL REFERENCES preop_results(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS result_deliveries (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE REFERENCES preop_cases(id) ON DELETE RESTRICT,
  result_id TEXT NOT NULL REFERENCES preop_results(id) ON DELETE RESTRICT,
  requester_service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SENT','ACKNOWLEDGED')),
  sent_by TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_by TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  acknowledged_at TIMESTAMPTZ
);
`

export async function createMvpTables(): Promise<void> {
  await execDDL(DDL_MVP)
}
