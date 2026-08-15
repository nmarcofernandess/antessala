import { execDDL } from './query'

/**
 * Schema canônico do caso pré-anestésico.
 *
 * Três leis moldam cada tabela daqui:
 *
 * 1. **Não existe paciente longitudinal.** Não há `patientId`, cadastro mestre,
 *    deduplicação nem FK entre casos. A pessoa vive como *snapshot* dentro do
 *    caso — dois encaminhamentos da mesma pessoa produzem dois casos autônomos,
 *    e isso é o comportamento correto, não um defeito a corrigir.
 * 2. **A agenda é da consulta pré-anestésica.** Nada aqui agenda cirurgia; o
 *    centro cirúrgico continua externo ao produto.
 * 3. **Autoria por ação.** A conta é uma só e sintética, mas todo comando grava
 *    quem executou, sob qual responsabilidade e quando. `case_events` é
 *    append-only por trigger, não por convenção.
 *
 * O schema legado (`registros`, `registro_jornada`) permanece isolado em
 * `clinical-schema.ts` e não ganha dependências novas.
 */

/**
 * Conta sintética e catálogo de serviços solicitantes.
 *
 * `usuarios` existe para que a autoria tenha chave estrangeira de verdade em vez
 * de texto solto. Uma linha só: a demonstração não tem cinco logins, tem uma
 * conta que enxerga todas as ferramentas e registra responsabilidade por ação.
 */
const DDL_ATORES = `
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  conta TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalogo_servicos_solicitantes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  revisao TEXT NOT NULL DEFAULT 'demo-1',
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);
`

const DDL_CASOS = `
CREATE SEQUENCE IF NOT EXISTS preop_case_display_code_seq;

CREATE TABLE IF NOT EXISTS preop_cases (
  id TEXT PRIMARY KEY,
  display_code TEXT NOT NULL UNIQUE,
  requesting_service_id TEXT NOT NULL
    REFERENCES catalogo_servicos_solicitantes(id) ON DELETE RESTRICT,
  referral_source_reference_normalized TEXT,
  person_snapshot JSONB NOT NULL,
  referral_snapshot JSONB NOT NULL,
  procedure_snapshot JSONB NOT NULL,
  requester_snapshot JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'RECEIVED_AT_RECEPTION', 'WAITING_NURSING', 'NURSING_IN_PROGRESS',
    'TRIAGE_PENDING', 'READY_FOR_SCHEDULING', 'SCHEDULED',
    'WAITING_ANESTHESIA', 'IN_ASSESSMENT', 'PENDING', 'WAITING_RETURN',
    'READY_FOR_HANDOFF', 'DELIVERED_TO_REQUESTER', 'CANCELLED'
  )),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  opened_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  CHECK (jsonb_typeof(person_snapshot) = 'object'),
  CHECK (jsonb_typeof(referral_snapshot) = 'object'),
  CHECK (jsonb_typeof(procedure_snapshot) = 'object'),
  CHECK (jsonb_typeof(requester_snapshot) = 'object'),
  CHECK (person_snapshot ->> '_v' = '1'),
  CHECK (referral_snapshot ->> '_v' = '1'),
  CHECK (procedure_snapshot ->> '_v' = '1'),
  CHECK (requester_snapshot ->> '_v' = '1'),
  CHECK (requester_snapshot ->> 'serviceId' = requesting_service_id),
  CHECK (
    (status IN ('DELIVERED_TO_REQUESTER', 'CANCELLED') AND closed_at IS NOT NULL)
    OR (status NOT IN ('DELIVERED_TO_REQUESTER', 'CANCELLED') AND closed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_preop_cases_service
  ON preop_cases(requesting_service_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_preop_cases_status
  ON preop_cases(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS case_command_receipts (
  idempotency_key TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  input_fingerprint TEXT NOT NULL,
  result_json JSONB NOT NULL CHECK (jsonb_typeof(result_json) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_events (
  id BIGSERIAL PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_snapshot JSONB NOT NULL CHECK (jsonb_typeof(actor_snapshot) = 'object'),
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  receipt_domain TEXT NOT NULL CHECK (receipt_domain IN ('CASE', 'ANAMNESIS', 'SCHEDULING', 'ASSESSMENT')),
  receipt_id TEXT NOT NULL,
  command_event_index INTEGER NOT NULL CHECK (command_event_index > 0),
  event_sequence INTEGER NOT NULL CHECK (event_sequence > 0),
  UNIQUE (case_id, event_sequence),
  UNIQUE (receipt_domain, receipt_id, command_event_index)
);

CREATE INDEX IF NOT EXISTS idx_case_events_caso
  ON case_events(case_id, event_sequence);

CREATE OR REPLACE FUNCTION bloquear_mutacao_case_events()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'case_events é append-only; grave um novo evento';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS case_events_append_only ON case_events;
CREATE TRIGGER case_events_append_only
BEFORE UPDATE OR DELETE ON case_events
FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_case_events();

CREATE TABLE IF NOT EXISTS case_handoffs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  from_role TEXT NOT NULL CHECK (from_role IN ('RECEPCAO', 'ENFERMAGEM', 'ANESTESIOLOGISTA', 'SOLICITANTE', 'ADMIN')),
  to_role TEXT NOT NULL CHECK (to_role IN ('RECEPCAO', 'ENFERMAGEM', 'ANESTESIOLOGISTA', 'SOLICITANTE', 'ADMIN')),
  handoff_type TEXT NOT NULL,
  payload_snapshot JSONB NOT NULL CHECK (payload_snapshot ->> '_v' = '1'),
  status TEXT NOT NULL CHECK (status IN ('SENT', 'RECEIVED', 'CANCELLED')),
  sent_by JSONB NOT NULL CHECK (jsonb_typeof(sent_by) = 'object'),
  sent_at TIMESTAMPTZ NOT NULL,
  received_by JSONB,
  received_at TIMESTAMPTZ,
  cancelled_by JSONB,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (from_role <> to_role),
  CHECK (
    (status = 'SENT' AND received_at IS NULL AND cancelled_at IS NULL)
    OR (status = 'RECEIVED' AND received_by IS NOT NULL AND received_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'CANCELLED' AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL
        AND length(trim(cancellation_reason)) BETWEEN 10 AND 500)
  )
);

CREATE INDEX IF NOT EXISTS idx_case_handoffs_caso
  ON case_handoffs(case_id, sent_at DESC);
`

/**
 * Anamnese do caso.
 *
 * Uma anamnese por caso. `clinical_anamneses` guarda o rascunho vivo — blocos,
 * ordem e proveniência — e `clinical_anamnesis_revisions` congela cada
 * publicação. Rascunho é mutável; revisão publicada não. É isso que faz a
 * retomada depois de reiniciar o app ser recuperação de trabalho e não sorte.
 */
const DDL_ANAMNESE = `
CREATE TABLE IF NOT EXISTS clinical_anamneses (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE REFERENCES preop_cases(id) ON DELETE RESTRICT,
  protocol_id TEXT NOT NULL,
  protocol_version INTEGER NOT NULL CHECK (protocol_version > 0),
  protocol_blocks JSONB NOT NULL CHECK (jsonb_typeof(protocol_blocks) = 'array'),
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'FINAL')),
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocks) = 'array'),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(provenance) = 'object'),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  finalized_by JSONB,
  UNIQUE (id, case_id),
  CHECK (
    (status = 'DRAFT' AND finalized_at IS NULL)
    OR (status = 'FINAL' AND finalized_at IS NOT NULL AND finalized_by IS NOT NULL AND revision > 0)
  )
);

CREATE TABLE IF NOT EXISTS clinical_anamnesis_revisions (
  anamnesis_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  blocks JSONB NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
  protocol_blocks JSONB NOT NULL CHECK (jsonb_typeof(protocol_blocks) = 'array'),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  finalized_by JSONB NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (anamnesis_id, revision),
  UNIQUE (anamnesis_id, revision, case_id),
  FOREIGN KEY (anamnesis_id, case_id) REFERENCES clinical_anamneses(id, case_id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION bloquear_mutacao_revisao_anamnese()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'revisão publicada de anamnese é imutável';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS anamnesis_revisions_imutaveis ON clinical_anamnesis_revisions;
CREATE TRIGGER anamnesis_revisions_imutaveis
BEFORE UPDATE OR DELETE ON clinical_anamnesis_revisions
FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_revisao_anamnese();
`

/**
 * Requisito operacional e agenda pré-anestésica.
 *
 * O requisito é a tradução versionada da entrevista em necessidade de vaga:
 * classe, duração, buffer e recursos. Ele nunca vira identidade de pessoa — a
 * compatibilidade que a recepção enxerga é
 * `caseId + requirementId + versão + classe + duração + recursos`.
 *
 * `scheduling_bookings` reserva **consulta pré-anestésica**. O índice parcial de
 * unicidade por slot é o que impede duas reservas ativas na mesma vaga; a
 * concorrência morre no banco, não numa checagem otimista do renderer.
 */
const DDL_AGENDA = `
CREATE TABLE IF NOT EXISTS scheduling_requirements (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  anamnesis_id TEXT NOT NULL,
  anamnesis_revision INTEGER NOT NULL CHECK (anamnesis_revision > 0),
  rule_set_id TEXT NOT NULL DEFAULT 'demo-workload-v1',
  rule_set_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('CALCULATED', 'CONFIRMED', 'OVERRIDDEN')),
  slot_class TEXT NOT NULL CHECK (slot_class IN ('QUICK', 'STANDARD', 'EXTENDED')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (20, 35, 50)),
  buffer_minutes INTEGER NOT NULL CHECK (buffer_minutes IN (5, 10)),
  calculated_minutes INTEGER NOT NULL CHECK (calculated_minutes > 0),
  required_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  operational_explanation JSONB NOT NULL DEFAULT '[]'::jsonb,
  pending_field_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  input_fingerprint TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by JSONB,
  published_at TIMESTAMPTZ,
  UNIQUE (id, case_id),
  FOREIGN KEY (anamnesis_id, case_id) REFERENCES clinical_anamneses(id, case_id) ON DELETE RESTRICT,
  CHECK (
    (slot_class = 'QUICK' AND duration_minutes = 20 AND buffer_minutes = 5)
    OR (slot_class = 'STANDARD' AND duration_minutes = 35 AND buffer_minutes = 5)
    OR (slot_class = 'EXTENDED' AND duration_minutes = 50 AND buffer_minutes = 10)
  ),
  CHECK (
    (status = 'CALCULATED' AND confirmed_at IS NULL AND published_at IS NULL)
    OR (status IN ('CONFIRMED', 'OVERRIDDEN')
        AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_requirements_caso
  ON scheduling_requirements(case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scheduling_overrides (
  id BIGSERIAL PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES scheduling_requirements(id) ON DELETE RESTRICT,
  from_class TEXT NOT NULL CHECK (from_class IN ('QUICK', 'STANDARD', 'EXTENDED')),
  to_class TEXT NOT NULL CHECK (to_class IN ('QUICK', 'STANDARD', 'EXTENDED')),
  to_duration_minutes INTEGER NOT NULL CHECK (to_duration_minutes IN (20, 35, 50)),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  actor_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduling_resources (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('CONSULTORIO')),
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS scheduling_slots (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES scheduling_resources(id) ON DELETE RESTRICT,
  slot_class TEXT NOT NULL CHECK (slot_class IN ('QUICK', 'STANDARD', 'EXTENDED')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'BLOCKED')),
  block_reason TEXT,
  CHECK (ends_at > starts_at),
  CHECK ((status = 'OPEN' AND block_reason IS NULL) OR (status = 'BLOCKED' AND block_reason IS NOT NULL)),
  UNIQUE (resource_id, starts_at)
);

CREATE INDEX IF NOT EXISTS idx_slots_intervalo
  ON scheduling_slots(starts_at, ends_at);

CREATE TABLE IF NOT EXISTS scheduling_bookings (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  requirement_id TEXT NOT NULL REFERENCES scheduling_requirements(id) ON DELETE RESTRICT,
  requirement_version INTEGER NOT NULL CHECK (requirement_version > 0),
  slot_id TEXT NOT NULL REFERENCES scheduling_slots(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES scheduling_resources(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL DEFAULT 'INITIAL' CHECK (kind IN ('INITIAL', 'RETURN')),
  slot_class TEXT NOT NULL CHECK (slot_class IN ('QUICK', 'STANDARD', 'EXTENDED')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'
  )),
  previous_booking_id TEXT REFERENCES scheduling_bookings(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_in_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,
  CHECK (ends_at > starts_at),
  UNIQUE (id, case_id)
);

-- Uma vaga aceita uma reserva ativa. A corrida morre aqui, no banco.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_booking_ativo_por_slot
  ON scheduling_bookings(slot_id)
  WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED');

-- E um caso não segura duas consultas ativas ao mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_booking_ativo_por_caso
  ON scheduling_bookings(case_id)
  WHERE status IN ('CONFIRMED', 'CHECKED_IN');

CREATE INDEX IF NOT EXISTS idx_bookings_intervalo
  ON scheduling_bookings(starts_at, ends_at);

-- A disponibilidade é a regra; as vagas são a materialização dela. Mudar o
-- horário de uma quarta muda todas as quartas adiante, não uma semana só.
CREATE TABLE IF NOT EXISTS scheduling_availability (
  resource_id TEXT NOT NULL REFERENCES scheduling_resources(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  ativo BOOLEAN NOT NULL DEFAULT FALSE,
  inicio_min INTEGER NOT NULL CHECK (inicio_min >= 0 AND inicio_min < 1440),
  fim_min INTEGER NOT NULL CHECK (fim_min > 0 AND fim_min <= 1440),
  pausas JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (resource_id, weekday),
  CHECK (fim_min > inicio_min),
  CHECK (jsonb_typeof(pausas) = 'array')
);

ALTER TABLE scheduling_resources
  ADD COLUMN IF NOT EXISTS mistura JSONB NOT NULL DEFAULT '["STANDARD","QUICK","EXTENDED"]'::jsonb;

CREATE TABLE IF NOT EXISTS scheduling_command_receipts (
  idempotency_key TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  input_fingerprint TEXT NOT NULL,
  result_json JSONB NOT NULL CHECK (jsonb_typeof(result_json) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export async function createCaseTables(): Promise<void> {
  await execDDL(DDL_ATORES)
  await execDDL(DDL_CASOS)
  await execDDL(DDL_ANAMNESE)
  await execDDL(DDL_AGENDA)
}
