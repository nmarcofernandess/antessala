import { execDDL } from './query'

/**
 * Tabelas de avaliação, pendências, resultado e entrega.
 *
 * Três invariantes moram aqui, no banco, e não em checagem de serviço:
 *
 * 1. **Um encontro ativo por caso** — índice parcial. Duas telas abertas não
 *    produzem duas avaliações do mesmo atendimento.
 * 2. **Versão de resultado é imutável** — trigger recusa `UPDATE` e `DELETE`.
 *    Corrigir é emitir a próxima versão apontando para a anterior; o passado
 *    fica, porque foi ele que explicou o que já foi entregue.
 * 3. **Só o ponteiro anda** — `preop_result_heads` é a única linha mutável, e a
 *    FK composta impede que ele aponte para versão de outro caso.
 *
 * O que estas tabelas não guardam: bytes de documento. A demonstração registra
 * o que foi respondido, não faz guarda documental — e por isso o produto nunca
 * chama nada aqui de "documento verificado".
 */

const DDL_ENCONTRO = `
CREATE TABLE IF NOT EXISTS anesthesia_encounters (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  booking_id TEXT NOT NULL UNIQUE REFERENCES scheduling_bookings(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  encounter_type TEXT NOT NULL CHECK (encounter_type IN ('INITIAL', 'RETURN')),
  status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'WAITING_PENDING', 'COMPLETED')),
  review_cycle INTEGER NOT NULL DEFAULT 1 CHECK (review_cycle >= 1),
  completion_reason TEXT CHECK (
    completion_reason IS NULL OR completion_reason IN ('RESULT_FINALIZED', 'INTERRUPTED')
  ),
  responsible_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  responsible_actor_snapshot JSONB NOT NULL,
  assessment_content JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, case_id),
  UNIQUE (case_id, sequence),
  CHECK (jsonb_typeof(responsible_actor_snapshot) = 'object'),
  CHECK (jsonb_typeof(assessment_content) = 'object'),
  CHECK (
    (status = 'COMPLETED' AND completed_at IS NOT NULL AND completion_reason IS NOT NULL)
    OR (status <> 'COMPLETED' AND completed_at IS NULL AND completion_reason IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_encontro_ativo_por_caso
  ON anesthesia_encounters(case_id)
  WHERE status IN ('IN_PROGRESS', 'WAITING_PENDING');
`

const DDL_PENDENCIAS = `
CREATE TABLE IF NOT EXISTS case_pendencies (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  encounter_id TEXT NOT NULL,
  review_cycle INTEGER NOT NULL CHECK (review_cycle >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('EXAM', 'INFORMATION', 'DOCUMENT', 'OTHER')),
  owner_role TEXT NOT NULL CHECK (
    owner_role IN ('RECEPCAO', 'ENFERMAGEM', 'ANESTESIOLOGISTA', 'SOLICITANTE')
  ),
  target_service_id TEXT REFERENCES catalogo_servicos_solicitantes(id) ON DELETE RESTRICT,
  impact TEXT NOT NULL CHECK (impact IN (
    'BLOCKS_CURRENT_RESULT', 'FOLLOW_UP_WITHOUT_BLOCKING', 'MAY_PREVENT_PROCEDURE',
    'OPERATIONAL_ONLY', 'INDETERMINATE_PENDING_REVIEW'
  )),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 500),
  requested_payload JSONB NOT NULL,
  due_at TIMESTAMPTZ,
  due_at_basis TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'REQUESTED', 'EVIDENCE_SUBMITTED', 'RESOLVED_ACCEPTED',
    'INSUFFICIENT_REOPENED', 'CANCELLED', 'SUPERSEDED'
  )),
  opened_by_snapshot JSONB NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  evidence_payload JSONB,
  evidence_submitted_by_snapshot JSONB,
  evidence_submitted_at TIMESTAMPTZ,
  reviewed_by_snapshot JSONB,
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  cancelled_by_snapshot JSONB,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  UNIQUE (id, case_id),
  FOREIGN KEY (encounter_id, case_id)
    REFERENCES anesthesia_encounters(id, case_id) ON DELETE RESTRICT,
  CHECK (due_at IS NULL OR due_at > opened_at),
  CHECK (
    (due_at IS NULL AND due_at_basis IS NULL)
    OR (due_at IS NOT NULL AND char_length(trim(due_at_basis)) BETWEEN 5 AND 500)
  ),
  CHECK (
    (owner_role = 'SOLICITANTE' AND target_service_id IS NOT NULL)
    OR (owner_role <> 'SOLICITANTE' AND target_service_id IS NULL)
  ),
  CHECK (jsonb_typeof(requested_payload) = 'object'),
  CHECK (evidence_payload IS NULL OR jsonb_typeof(evidence_payload) = 'object'),
  -- O estado e as marcas de autoria andam juntos: não existe "aceita" sem quem
  -- aceitou, nem "entregue" sem quem entregou.
  CHECK (
    (status = 'REQUESTED' AND evidence_payload IS NULL AND reviewed_at IS NULL)
    OR (status = 'EVIDENCE_SUBMITTED' AND evidence_payload IS NOT NULL
        AND evidence_submitted_at IS NOT NULL AND reviewed_at IS NULL)
    OR (status IN ('RESOLVED_ACCEPTED', 'INSUFFICIENT_REOPENED')
        AND evidence_payload IS NOT NULL AND evidence_submitted_at IS NOT NULL
        AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL)
    OR (status IN ('CANCELLED', 'SUPERSEDED')
        AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pendencias_ciclo
  ON case_pendencies(encounter_id, review_cycle, status);
`

const DDL_RESULTADO = `
CREATE TABLE IF NOT EXISTS preop_results (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  encounter_id TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  emission_type TEXT NOT NULL CHECK (emission_type IN ('FINAL', 'CORRECTION', 'ADDENDUM')),
  predecessor_result_id TEXT,
  reason TEXT,
  content JSONB NOT NULL,
  finalized_by_snapshot JSONB NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL CHECK (char_length(content_hash) = 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, case_id),
  UNIQUE (id, version_number, case_id),
  UNIQUE (case_id, version_number),
  FOREIGN KEY (encounter_id, case_id)
    REFERENCES anesthesia_encounters(id, case_id) ON DELETE RESTRICT,
  FOREIGN KEY (predecessor_result_id, case_id)
    REFERENCES preop_results(id, case_id) ON DELETE RESTRICT,
  CHECK (jsonb_typeof(content) = 'object'),
  CHECK (jsonb_typeof(finalized_by_snapshot) = 'object'),
  CHECK (
    (version_number = 1 AND emission_type = 'FINAL'
      AND predecessor_result_id IS NULL AND reason IS NULL)
    OR (version_number > 1 AND emission_type IN ('CORRECTION', 'ADDENDUM')
      AND predecessor_result_id IS NOT NULL
      AND char_length(trim(reason)) BETWEEN 10 AND 1000)
  )
);

CREATE TABLE IF NOT EXISTS preop_result_heads (
  case_id TEXT PRIMARY KEY REFERENCES preop_cases(id) ON DELETE RESTRICT,
  current_result_id TEXT NOT NULL,
  current_version_number INTEGER NOT NULL CHECK (current_version_number > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (current_result_id, current_version_number, case_id)
    REFERENCES preop_results(id, version_number, case_id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION recusar_mutacao_de_resultado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'versão de resultado pré-anestésico é imutável';
END;
$$;

DROP TRIGGER IF EXISTS resultado_imutavel ON preop_results;
CREATE TRIGGER resultado_imutavel
BEFORE UPDATE OR DELETE ON preop_results
FOR EACH ROW EXECUTE FUNCTION recusar_mutacao_de_resultado();
`

const DDL_ENTREGA = `
CREATE TABLE IF NOT EXISTS result_deliveries (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  result_id TEXT NOT NULL UNIQUE,
  target_service_id TEXT NOT NULL
    REFERENCES catalogo_servicos_solicitantes(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL CHECK (channel IN ('LOCAL_DEMO')),
  status TEXT NOT NULL CHECK (status IN ('SENT', 'RECEIVED')),
  result_hash TEXT NOT NULL CHECK (char_length(result_hash) = 64),
  sent_by_snapshot JSONB NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  received_by_snapshot JSONB,
  received_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, case_id),
  FOREIGN KEY (result_id, case_id) REFERENCES preop_results(id, case_id) ON DELETE RESTRICT,
  CHECK (jsonb_typeof(sent_by_snapshot) = 'object'),
  CHECK (
    (status = 'SENT' AND received_by_snapshot IS NULL AND received_at IS NULL)
    OR (status = 'RECEIVED' AND received_by_snapshot IS NOT NULL AND received_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS assessment_command_receipts (
  idempotency_key TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  input_fingerprint TEXT NOT NULL,
  result_json JSONB NOT NULL CHECK (jsonb_typeof(result_json) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export async function createAssessmentTables(): Promise<void> {
  await execDDL(DDL_ENCONTRO)
  await execDDL(DDL_PENDENCIAS)
  await execDDL(DDL_RESULTADO)
  await execDDL(DDL_ENTREGA)
}
