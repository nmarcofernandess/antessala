# BUILD — Avaliação, pendências e handoff

## Estado documental

- Papel: `CANONICAL_DOMAIN_BUILD`.
- Indexado por: `hack/BUILD.md`.
- Gate ou assinatura individual: inexistente.
- O estado de maturidade permanece no tracker único; o hub não pode promovê-lo sozinho.
- Este arquivo é a fonte técnica do domínio. `hack/BUILD.md` apenas integra dependências;
  não substitui, resume com perda nem supera este contrato.

## Sources Consumed

- `hack/PRD.md:53-70`, `hack/PRD.md:133-168`, `hack/PRD.md:211-239`.
- `hack/domains/ANALYST-avaliacao-pendencias-e-handoff.md`.
- `hack/domains/ANALYST-caso-e-encaminhamento.md:258-270`.
- `hack/domains/BUILD-acesso-e-auditoria.md:284-312`.
- `hack/domains/BUILD-classificacao-e-agenda.md:291-328`.
- `src/main/db/pglite.ts:12-48`, `src/main/db/query.ts:33-99`.
- `src/main/export/pdf.ts:16-91`, `tests/main/export/pdf.spec.ts:53-150`.

## Product Blueprint

### Superfícies

1. **Check-in** — recepção registra chegada de booking `INITIAL` ou `RETURN`.
2. **Avaliações** — anestesiologista abre casos em `WAITING_ANESTHESIA`.
3. **Encontro** — mostra snapshots e anamnese em leitura, com avaliação editável.
4. **Pendências** — abre pedido tipado, acompanha owner/prazo e registra cumprimento.
5. **Retornos** — recepção agenda `ReturnRequest READY_FOR_BOOKING`.
6. **Conclusão** — anestesiologista revisa o conteúdo e cria o único resultado `FINAL`.
7. **Handoff** — anestesiologista ou solicitante autorizado exporta; recepção registra o
   envio operacional sem receber conteúdo; solicitante do serviço correto confirma.

### Estados de interface

| Superfície | Empty | Loading | Error | Blocked | Success |
|---|---|---|---|---|---|
| Check-in | nenhum agendamento | skeleton | consulta falhou | fora da janela/sem permissão | chegada registrada |
| Encontro | conteúdo vazio | snapshots + skeleton | leitura/save falhou | sem check-in, terminal ou conflito | rascunho salvo |
| Pendências | nenhuma | skeleton | mutação falhou | terminal/owner indevido | evidência submetida ou revisada |
| Retornos | nenhum liberado | slots skeleton | agenda falhou | bloqueio aberto/slot ocupado | retorno marcado |
| Conclusão | encontro incompleto | revisão skeleton | finalização falhou | pendência aberta/versão mudou | `FINAL` criado |
| Handoff | nenhuma entrega | preparação | PDF/envio falhou | sem `FINAL`/escopo incorreto | recebido |

Nenhuma copy usa “enviado ao HC”. O PDF mantém “Antessala — demonstração local” e
“Documento sintético para demonstração; não integra o prontuário do HCFMRP-USP.”

## Files And Ownership

| Arquivo/área | Ação futura | Dono |
|---|---|---|
| `src/shared/clinical/assessment.ts` | enums, inputs, outputs e Zod strict | Shared |
| `src/shared/scheduling/types.ts` | `BookingKind` e referência discriminada de retorno | Shared/Agenda |
| `src/main/db/migrations/00y_assessment.sql` | tabelas e índices deste domínio, após agenda base | DB |
| migration posterior de integração da agenda | `kind`, `return_request_id`, `completed_by_encounter_id` e FKs cruzadas | DB/Agenda |
| `src/main/clinical/assessment-service.ts` | encontro, pendência, revisão de evidência e decisão explícita de retorno | Main |
| `src/main/clinical/result-service.ts` | versões imutáveis, head corrente e projeções | Main |
| `src/main/clinical/delivery-service.ts` | envio/recebimento e scope | Main |
| `src/main/clinical/result-document.ts` | HTML determinístico | Main |
| `src/main/clinical/assessment-router.ts` | TIPC e guards | Main |
| `src/renderer/src/paginas/avaliacao/*` | encontro, pendências e conclusão | Renderer |
| `src/renderer/src/paginas/retornos/*` | fila de `ReturnRequest` | Renderer |
| `src/renderer/src/paginas/resultados/*` | handoff por papel | Renderer |
| `tests/main/clinical/*`, `tests/e2e/*` | contratos e fluxo | Tests |

O esquema provisório não é ampliado. A ordem de migrations é fechada: (1) a migration base
da agenda cria `scheduling_bookings` somente para `INITIAL`, sem FK para assessment; (2)
esta migration cria `anesthesia_encounters`, `case_pendencies` e `return_requests`; (3) uma
migration posterior, owned pela agenda, adiciona `kind`, `return_request_id`,
`return_request_version` e `completed_by_encounter_id` com suas FKs cruzadas. Essa ordem
quebra o ciclo no DDL e não é uma decisão deixada para o Plan.

## Backend Blueprint

### `anesthesia_encounters`

```sql
CREATE TABLE anesthesia_encounters (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  booking_id TEXT NOT NULL UNIQUE,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  encounter_type TEXT NOT NULL CHECK (encounter_type IN ('INITIAL','RETURN')),
  status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS','WAITING_PENDING','COMPLETED')),
  review_cycle INTEGER NOT NULL DEFAULT 1 CHECK (review_cycle >= 1),
  completion_reason TEXT CHECK (
    completion_reason IS NULL OR completion_reason IN ('RETURN_STARTED','RESULT_FINALIZED')
  ),
  responsible_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  responsible_actor_snapshot JSONB NOT NULL,
  assessment_content JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id, case_id),
  UNIQUE(case_id, sequence),
  FOREIGN KEY (booking_id, case_id)
    REFERENCES scheduling_bookings(id, case_id) ON DELETE RESTRICT,
  CHECK (jsonb_typeof(responsible_actor_snapshot) = 'object'),
  CHECK (jsonb_typeof(assessment_content) = 'object'),
  CHECK (
    (status = 'COMPLETED' AND completed_at IS NOT NULL AND completion_reason IS NOT NULL)
    OR (status <> 'COMPLETED' AND completed_at IS NULL AND completion_reason IS NULL)
  )
);

CREATE UNIQUE INDEX one_active_encounter_per_case
  ON anesthesia_encounters(case_id)
  WHERE status IN ('IN_PROGRESS','WAITING_PENDING');
```

`encounter_type` deriva do booking. `RETURN` exige vínculo válido entre booking,
`ReturnRequest` e caso. O service valida o papel do responsável.

### `case_pendencies`

```sql
CREATE TABLE case_pendencies (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  encounter_id TEXT NOT NULL,
  review_cycle INTEGER NOT NULL CHECK (review_cycle >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('EXAM','INFORMATION','DOCUMENT','OTHER')),
  owner_role TEXT NOT NULL CHECK (
    owner_role IN ('RECEPCAO','ENFERMAGEM','ANESTESIOLOGISTA','SOLICITANTE')
  ),
  target_service_id TEXT REFERENCES catalogo_servicos_solicitantes(id) ON DELETE RESTRICT,
  impact TEXT NOT NULL CHECK (impact IN (
    'BLOCKS_CURRENT_RESULT','FOLLOW_UP_WITHOUT_BLOCKING','MAY_PREVENT_PROCEDURE',
    'OPERATIONAL_ONLY','INDETERMINATE_PENDING_REVIEW'
  )),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 500),
  requested_payload JSONB NOT NULL,
  due_at TIMESTAMPTZ,
  due_at_basis TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'REQUESTED','EVIDENCE_SUBMITTED',
    'RESOLVED_ACCEPTED','INSUFFICIENT_REOPENED','CANCELLED','SUPERSEDED'
  )),
  opened_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  opened_by_snapshot JSONB NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  evidence_payload JSONB,
  evidence_submitted_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  evidence_submitted_by_snapshot JSONB,
  evidence_submitted_at TIMESTAMPTZ,
  reviewed_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  reviewed_by_snapshot JSONB,
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  cancelled_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  cancelled_by_snapshot JSONB,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  UNIQUE (id, case_id),
  FOREIGN KEY (encounter_id, case_id)
    REFERENCES anesthesia_encounters(id, case_id) ON DELETE RESTRICT,
  CHECK (due_at IS NULL OR due_at > opened_at),
  CHECK ((due_at IS NULL AND due_at_basis IS NULL) OR
         (due_at IS NOT NULL AND due_at_basis IS NOT NULL
          AND char_length(trim(due_at_basis)) BETWEEN 5 AND 500)),
  CHECK (cancellation_reason IS NULL OR char_length(trim(cancellation_reason)) BETWEEN 10 AND 500),
  CHECK (jsonb_typeof(opened_by_snapshot) = 'object'),
  CHECK (evidence_submitted_by_snapshot IS NULL OR jsonb_typeof(evidence_submitted_by_snapshot) = 'object'),
  CHECK (reviewed_by_snapshot IS NULL OR jsonb_typeof(reviewed_by_snapshot) = 'object'),
  CHECK (cancelled_by_snapshot IS NULL OR jsonb_typeof(cancelled_by_snapshot) = 'object'),
  CHECK (
    (owner_role = 'SOLICITANTE' AND target_service_id IS NOT NULL)
    OR (owner_role <> 'SOLICITANTE' AND target_service_id IS NULL)
  ),
  CHECK (
    (status = 'REQUESTED' AND evidence_payload IS NULL
      AND evidence_submitted_by_actor_id IS NULL AND evidence_submitted_at IS NULL
      AND reviewed_by_actor_id IS NULL AND reviewed_at IS NULL)
    OR (status = 'EVIDENCE_SUBMITTED' AND evidence_payload IS NOT NULL
      AND evidence_submitted_by_actor_id IS NOT NULL AND evidence_submitted_at IS NOT NULL)
    OR (status = 'RESOLVED_ACCEPTED' AND reviewed_by_actor_id IS NOT NULL
      AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL)
    OR (status = 'INSUFFICIENT_REOPENED' AND evidence_payload IS NOT NULL
      AND evidence_submitted_by_actor_id IS NOT NULL AND evidence_submitted_at IS NOT NULL
      AND reviewed_by_actor_id IS NOT NULL AND reviewed_at IS NOT NULL
      AND review_reason IS NOT NULL)
    OR (status IN ('CANCELLED','SUPERSEDED') AND cancelled_by_actor_id IS NOT NULL
      AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)
  ),
  CHECK (jsonb_typeof(requested_payload) = 'object'),
  CHECK (evidence_payload IS NULL OR jsonb_typeof(evidence_payload) = 'object')
);

CREATE INDEX pendencies_current_cycle
  ON case_pendencies(encounter_id, review_cycle, status);
```

`impact` é decisão explícita do anestesiologista. Somente uma pendência
`BLOCKS_CURRENT_RESULT` ainda não `RESOLVED_ACCEPTED`, `CANCELLED` ou `SUPERSEDED` impede
emitir a versão atual. Submeter evidência nunca resolve a pendência nem cria retorno.

### `return_requests`

```sql
CREATE TABLE return_requests (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  source_encounter_id TEXT NOT NULL,
  review_cycle INTEGER NOT NULL CHECK (review_cycle >= 1),
  scheduling_requirement_snapshot JSONB NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('READY_FOR_BOOKING','BOOKED','CHECKED_IN','CONSUMED')
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL,
  booked_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  UNIQUE (id, case_id),
  UNIQUE (id, version, case_id),
  FOREIGN KEY (source_encounter_id, case_id)
    REFERENCES anesthesia_encounters(id, case_id) ON DELETE RESTRICT,
  CHECK (jsonb_typeof(scheduling_requirement_snapshot) = 'object'),
  CHECK (
    (status = 'READY_FOR_BOOKING'
      AND checked_in_at IS NULL AND consumed_at IS NULL)
    OR (status = 'BOOKED'
      AND booked_at IS NOT NULL AND checked_in_at IS NULL AND consumed_at IS NULL)
    OR (status = 'CHECKED_IN'
      AND booked_at IS NOT NULL AND checked_in_at IS NOT NULL AND consumed_at IS NULL)
    OR (status = 'CONSUMED'
      AND booked_at IS NOT NULL AND checked_in_at IS NOT NULL AND consumed_at IS NOT NULL)
  )
);

CREATE TABLE return_request_pendencies (
  return_request_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  pendency_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal > 0),
  PRIMARY KEY (return_request_id, pendency_id),
  UNIQUE (return_request_id, ordinal),
  FOREIGN KEY (return_request_id, case_id)
    REFERENCES return_requests(id, case_id) ON DELETE RESTRICT,
  FOREIGN KEY (pendency_id, case_id)
    REFERENCES case_pendencies(id, case_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX one_active_return_request_per_case
  ON return_requests(case_id)
  WHERE status IN ('READY_FOR_BOOKING','BOOKED','CHECKED_IN');
```

`return_request_pendencies` contém, em ordem lexical materializada por `ordinal`, somente
os IDs que o anestesiologista selecionou em `returnRequests.decide` depois de revisar a
evidência; o service exige mesmo encontro/ciclo/caso e estado revisado. A relação possui FKs
compostas para impedir IDs de outro caso. O snapshot contém o `requirementId` e o
`RequirementEffectiveDTO` completo:
classe, duração, buffer, ocupação, prazo, kinds e capabilities. `return_requests` não possui `booking_id`: o
booking atual ou histórico é sempre derivado pela FK
`scheduling_bookings.return_request_id`.

### Integração posterior do booking

O DDL exato da terceira migration vive em
`BUILD-classificacao-e-agenda.md#topologia-de-migrations-do-booking`. Este domínio não
repete nem antecipa aquele `ALTER TABLE`: ele apenas exige que a integração acrescente
`kind`, `return_request_id`, `return_request_version` e
`completed_by_encounter_id`, além do índice de um booking ativo por ReturnRequest.

Invariantes:

- `INITIAL ⇔ return_request_id IS NULL`;
- `RETURN ⇔ return_request_id IS NOT NULL`;
- um `ReturnRequest` possui no máximo um booking ativo;
- `RETURN` usa o snapshot da solicitação, não um requirement escolhido pelo renderer;
- `checkIn` aceita `CONFIRMED`, produz `CHECKED_IN` e muda
  `SCHEDULED | WAITING_RETURN → WAITING_ANESTHESIA`;
- `encounters.start` exige `CHECKED_IN`, produz booking `COMPLETED` e caso
  `IN_ASSESSMENT`;
- os índices de booking ativo por caso e slot também incluem `CHECKED_IN`;
- cancelar/no-show de `RETURN` encerra o booking, reabre o request como
  `READY_FOR_BOOKING` e mantém `WAITING_RETURN`; nenhuma coluna é limpa em
  `return_requests`;
- `encounters.start` preenche `completed_by_encounter_id`, mas não remove
  `scheduling_resource_occupancies`; a ocupação física permanece até `slot.ends_at`.

### `preop_results`

```sql
CREATE TABLE preop_results (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  encounter_id TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  emission_type TEXT NOT NULL CHECK (
    emission_type IN ('FINAL','CORRECTION','ADDENDUM')
  ),
  predecessor_result_id TEXT,
  reason TEXT,
  content JSONB NOT NULL,
  finalized_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
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
    OR (version_number > 1 AND emission_type IN ('CORRECTION','ADDENDUM')
      AND predecessor_result_id IS NOT NULL
      AND char_length(trim(reason)) BETWEEN 10 AND 1000)
  )
);

CREATE TABLE preop_result_heads (
  case_id TEXT PRIMARY KEY REFERENCES preop_cases(id) ON DELETE RESTRICT,
  current_result_id TEXT NOT NULL,
  current_version_number INTEGER NOT NULL CHECK (current_version_number > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (current_result_id, current_version_number, case_id)
    REFERENCES preop_results(id, version_number, case_id) ON DELETE RESTRICT,
  UNIQUE (case_id, current_version_number)
);

CREATE FUNCTION reject_preop_result_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'preop result version is immutable';
END;
$$;

CREATE TRIGGER preop_result_is_immutable
BEFORE UPDATE OR DELETE ON preop_results
FOR EACH ROW EXECUTE FUNCTION reject_preop_result_mutation();
```

Trigger rejeita `UPDATE` e `DELETE` das versões. O rascunho continua em
`assessment_content`; `preop_result_heads` é o único ponteiro mutável e avança por CAS na
mesma transação que insere a próxima versão. `CURRENT` é o ID apontado pelo head;
`SUPERSEDED` é qualquer versão anterior; conteúdo e recibos históricos nunca são apagados.

### `case_documents`

```sql
CREATE TABLE case_documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  pendency_id TEXT,
  result_id TEXT,
  kind TEXT NOT NULL CHECK (
    kind IN ('REFERRAL','EXAM','INFORMATION','RESULT_PDF_RECEIPT','OTHER')
  ),
  title TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  metadata JSONB NOT NULL,
  created_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, case_id),
  FOREIGN KEY (pendency_id, case_id)
    REFERENCES case_pendencies(id, case_id) ON DELETE RESTRICT,
  FOREIGN KEY (result_id, case_id)
    REFERENCES preop_results(id, case_id) ON DELETE RESTRICT,
  CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  CHECK (char_length(trim(mime_type)) BETWEEN 1 AND 120),
  CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (NOT (pendency_id IS NOT NULL AND result_id IS NOT NULL)),
  CHECK (
    (kind = 'RESULT_PDF_RECEIPT' AND result_id IS NOT NULL AND pendency_id IS NULL)
    OR (kind <> 'RESULT_PDF_RECEIPT' AND result_id IS NULL)
  )
);

CREATE FUNCTION reject_case_document_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'case document metadata receipt is immutable';
END;
$$;

CREATE TRIGGER case_document_is_immutable
BEFORE UPDATE OR DELETE ON case_documents
FOR EACH ROW EXECUTE FUNCTION reject_case_document_mutation();
```

O MVP guarda metadados, tamanho e hash; não guarda bytes, blob, base64 ou path local.
Trigger rejeita `UPDATE` e `DELETE` em `case_documents`. Registro público de evidência exige
`pendency_id`; `RESULT_PDF_RECEIPT` só nasce internamente no export e exige `result_id` do
mesmo caso.

### `result_deliveries`

```sql
CREATE TABLE result_deliveries (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  result_id TEXT NOT NULL UNIQUE,
  target_service_id TEXT NOT NULL
    REFERENCES catalogo_servicos_solicitantes(id) ON DELETE RESTRICT,
  recipient_snapshot JSONB NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('LOCAL_DEMO','PDF')),
  status TEXT NOT NULL CHECK (status IN ('SENT','RECEIVED')),
  result_hash TEXT NOT NULL,
  sent_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  sent_by_snapshot JSONB NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  received_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  received_by_snapshot JSONB,
  received_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, case_id),
  FOREIGN KEY (result_id, case_id)
    REFERENCES preop_results(id, case_id) ON DELETE RESTRICT,
  CHECK (char_length(result_hash) = 64),
  CHECK (jsonb_typeof(recipient_snapshot) = 'object'),
  CHECK (jsonb_typeof(sent_by_snapshot) = 'object'),
  CHECK (received_by_snapshot IS NULL OR jsonb_typeof(received_by_snapshot) = 'object'),
  CHECK (
    (status = 'SENT' AND received_by_actor_id IS NULL
      AND received_by_snapshot IS NULL AND received_at IS NULL)
    OR (status = 'RECEIVED' AND received_by_actor_id IS NOT NULL
      AND received_by_snapshot IS NOT NULL AND received_at IS NOT NULL)
  )
);
```

O destinatário é copiado do caso. O renderer não envia serviço ou pessoa destinatária.

### `assessment_command_receipts`

```sql
CREATE TABLE assessment_command_receipts (
  request_id TEXT PRIMARY KEY,
  command TEXT NOT NULL CHECK (command IN (
    'START_ENCOUNTER', 'SAVE_ASSESSMENT', 'OPEN_PENDENCY', 'CANCEL_PENDENCY',
    'REGISTER_DOCUMENT_METADATA', 'SUBMIT_PENDENCY_EVIDENCE',
    'REVIEW_PENDENCY_EVIDENCE', 'DECIDE_RETURN', 'RESUME_REVIEW',
    'FINALIZE_RESULT', 'REVISE_RESULT', 'SEND_DELIVERY', 'ACKNOWLEDGE_DELIVERY'
  )),
  actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  input_fingerprint TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Fingerprint é SHA-256 de JSON canônico
`{command, actorId, payloadWithoutRequestId}`. Mesmo request/fingerprint devolve `result`;
mesmo request com fingerprint diferente retorna `IDEMPOTENCY_KEY_REUSED`. Receipt e
mutação entram na mesma transação. Commands da agenda usam
`scheduling_command_receipts` com a mesma semântica.

## Exact Data Contracts

### Conteúdo clínico

```ts
import type { Papel } from '@/shared/auth'
import type { RequirementEffectiveDTO } from '@/shared/scheduling/types'

type ActorSnapshotDTO = {
  actorId: string
  displayName: string
  role: Papel
}

type AssessmentNarrative =
  | { state: 'ANSWERED'; text: string }
  | { state: 'UNKNOWN' | 'NOT_APPLICABLE' | 'NOT_PERFORMED'; text: null }

type AssessmentDraftNarrative =
  | { state: 'NOT_RECORDED'; text: null }
  | AssessmentNarrative

type AssessmentDraftContentV1 = {
  _v: 1
  state: 'DRAFT'
  confirmation: {
    personConfirmed: boolean | null
    procedureConfirmed: boolean | null
    note: string | null
  }
  interview: {
    intervalHistory: AssessmentDraftNarrative
    currentSymptoms: AssessmentDraftNarrative
  }
  examination: {
    generalExam: AssessmentDraftNarrative
    airwayExam: AssessmentDraftNarrative
    vitalSignsReview: AssessmentDraftNarrative
    additionalFindings: AssessmentDraftNarrative
  }
  reviewedDocuments: AssessmentReviewedDocumentV1[]
  synthesis: {
    summary: string | null
    limitations: string[]
    nextAction: 'FINALIZE_RESULT' | 'OPEN_PENDING_ITEM' | null
  }
}

type AssessmentReviewedDocumentV1 = {
  id: string
  kind: 'EXAM' | 'REPORT' | 'OTHER'
  title: string
  observedAt: string | null
  summary: string
  sourceDocumentId: string | null
}

type AssessmentContentV1 = {
  _v: 1
  state: 'COMPLETE'
  confirmation: {
    personConfirmed: boolean
    procedureConfirmed: boolean
    note: string | null
  }
  interview: {
    intervalHistory: AssessmentNarrative
    currentSymptoms: AssessmentNarrative
  }
  examination: {
    generalExam: AssessmentNarrative
    airwayExam: AssessmentNarrative
    vitalSignsReview: AssessmentNarrative
    additionalFindings: AssessmentNarrative
  }
  reviewedDocuments: AssessmentReviewedDocumentV1[]
  synthesis: {
    summary: string
    limitations: string[]
    nextAction: 'FINALIZE_RESULT' | 'OPEN_PENDING_ITEM'
  }
}

type PreopResultContentV1 = {
  _v: 1
  assessmentSummary: string
  conclusion: string
  recommendations: string[]
  limitations: string[]
  returnInstructions: string | null
}
```

`Papel` é o único enum de papel e pertence ao domínio de acesso. `ActorContext` permanece
main-only em `src/main/auth/*`: este domínio o consome nos services, não o redeclara e nunca
o exporta ao renderer.

`encounters.start` persiste um `AssessmentDraftContentV1` vazio determinístico: confirmações
`null`, todas as narrativas `NOT_RECORDED`, listas vazias e síntese nula. Save valida apenas
o schema parcial de draft. `results.finalize` precisa converter e persistir o conteúdo como
`AssessmentContentV1 state='COMPLETE'`; somente esse schema exige confirmações booleanas,
proíbe `NOT_RECORDED`, exige síntese/nextAction e valida todas as seções completas.

Limites: narrativa e síntese 1–4.000; notas 1–500; documentos até 50; listas até
20 itens de 1–500; `returnInstructions` nulo ou 1–1.000. Ambos os schemas Zod usam
`.strict()` e não compartilham refinements de completude por acidente.

### Pedido e cumprimento discriminados

```ts
type ExpectedInformationSource = 'PATIENT' | 'REQUESTER_SERVICE' | 'OTHER'
type DocumentCategory = 'REPORT' | 'REFERRAL' | 'CONSENT' | 'OTHER'

type ExamRequestV1 = {
  _v: 1
  examName: string
  clinicalQuestion: string | null
  instructions: string | null
}
type ExamEvidenceV1 =
  | {
      _v: 1
      outcome: 'RECEIVED'
      performedAt: string | null
      documentIds: [string, ...string[]]
      note: string | null
    }
  | {
      _v: 1
      outcome: 'UNAVAILABLE'
      performedAt: null
      documentIds: []
      note: string
    }

type InformationRequestV1 = {
  _v: 1
  question: string
  expectedSource: ExpectedInformationSource
  instructions: string | null
}
type InformationEvidenceV1 = {
  _v: 1
  answer: string
  actualSource: ExpectedInformationSource
  documentIds: string[]
  note: string | null
}

type DocumentRequestV1 = {
  _v: 1
  title: string
  category: DocumentCategory
  instructions: string | null
}
type DocumentEvidenceV1 = {
  _v: 1
  documentIds: [string, ...string[]]
  note: string | null
}

type OtherRequestV1 = {
  _v: 1
  requestText: string
  instructions: string | null
}
type OtherEvidenceV1 = {
  _v: 1
  responseText: string
  documentIds: string[]
  note: string | null
}

type PendencyContent =
  | { kind: 'EXAM'; requestedPayload: ExamRequestV1; evidencePayload: ExamEvidenceV1 | null }
  | { kind: 'INFORMATION'; requestedPayload: InformationRequestV1; evidencePayload: InformationEvidenceV1 | null }
  | { kind: 'DOCUMENT'; requestedPayload: DocumentRequestV1; evidencePayload: DocumentEvidenceV1 | null }
  | { kind: 'OTHER'; requestedPayload: OtherRequestV1; evidencePayload: OtherEvidenceV1 | null }
```

Validação:

- nome/título: 2–200; pergunta, pedido, resposta e instrução: 1–2.000;
- nota: nulo ou 1–1.000; máximo 20 documentos, sem duplicata;
- `RECEIVED` exige documento; `UNAVAILABLE` proíbe documento e exige nota;
- `documentId` precisa existir no mesmo caso;
- `dueAt` precisa ser posterior a `openedAt`;
- HTML e campos extras falham.

### Inputs

```ts
type CommandBase = { requestId: string }

type CheckInBookingDTO = CommandBase & {
  bookingId: string
  expectedBookingVersion: number
  expectedCaseVersion: number
}

type StartEncounterDTO = CommandBase & {
  caseId: string
  bookingId: string
  expectedCaseVersion: number
}

type SaveAssessmentDTO = CommandBase & {
  encounterId: string
  expectedEncounterVersion: number
  assessmentContent: AssessmentDraftContentV1
}

type PendencyOpenBase = CommandBase & {
  encounterId: string
  expectedEncounterVersion: number
  ownerRole: 'RECEPCAO' | 'ENFERMAGEM' | 'ANESTESIOLOGISTA' | 'SOLICITANTE'
  targetServiceId: string | null
  impact:
    | 'BLOCKS_CURRENT_RESULT'
    | 'FOLLOW_UP_WITHOUT_BLOCKING'
    | 'MAY_PREVENT_PROCEDURE'
    | 'OPERATIONAL_ONLY'
    | 'INDETERMINATE_PENDING_REVIEW'
  description: string
  dueAt: string | null
  dueAtBasis: string | null
}

type OpenPendencyDTO =
  | (PendencyOpenBase & { kind: 'EXAM'; requestedPayload: ExamRequestV1 })
  | (PendencyOpenBase & { kind: 'INFORMATION'; requestedPayload: InformationRequestV1 })
  | (PendencyOpenBase & { kind: 'DOCUMENT'; requestedPayload: DocumentRequestV1 })
  | (PendencyOpenBase & { kind: 'OTHER'; requestedPayload: OtherRequestV1 })

type SubmitPendencyEvidenceDTO =
  | (CommandBase & {
      pendencyId: string
      expectedPendencyVersion: number
      kind: 'EXAM'
      evidencePayload: ExamEvidenceV1
    })
  | (CommandBase & {
      pendencyId: string
      expectedPendencyVersion: number
      kind: 'INFORMATION'
      evidencePayload: InformationEvidenceV1
    })
  | (CommandBase & {
      pendencyId: string
      expectedPendencyVersion: number
      kind: 'DOCUMENT'
      evidencePayload: DocumentEvidenceV1
    })
  | (CommandBase & {
      pendencyId: string
      expectedPendencyVersion: number
      kind: 'OTHER'
      evidencePayload: OtherEvidenceV1
    })

type CancelPendencyDTO = CommandBase & {
  pendencyId: string
  expectedPendencyVersion: number
  reason: string
}

type ReviewPendencyEvidenceDTO = CommandBase & {
  pendencyId: string
  expectedPendencyVersion: number
  decision: 'ACCEPT' | 'REOPEN_AS_INSUFFICIENT'
  reason: string
}

type DecideReturnDTO = CommandBase & {
  encounterId: string
  expectedEncounterVersion: number
  expectedCaseVersion: number
  triggerPendencyIds: string[]
  objective: string
  schedulingRequirement: RequirementEffectiveDTO
}

type RegisterDocumentMetadataDTO = CommandBase & {
  caseId: string
  pendencyId: string
  expectedCaseVersion: number
  expectedPendencyVersion: number
  kind: 'EXAM' | 'INFORMATION' | 'OTHER'
  title: string
  mimeType: string
  sizeBytes: number
  contentHash: `sha256:${string}`
  metadata: {
    observedAt: string | null
    issuer: string | null
    note: string | null
  }
}

type ResumeReviewDTO = CommandBase & {
  encounterId: string
  expectedEncounterVersion: number
  expectedCaseVersion: number
}

type GetResultByCaseDTO = { caseId: string }

type FinalizeResultDTO = CommandBase & {
  encounterId: string
  expectedEncounterVersion: number
  expectedCaseVersion: number
  content: PreopResultContentV1
}

type ReviseResultDTO = CommandBase & {
  caseId: string
  expectedHeadVersion: number
  predecessorResultId: string
  emissionType: 'CORRECTION' | 'ADDENDUM'
  reason: string
  content: PreopResultContentV1
}

type ExportResultPdfDTO = { resultId: string }

type SendDeliveryDTO = CommandBase & {
  resultId: string
  channel: 'LOCAL_DEMO' | 'PDF'
  expectedCaseVersion: number
}

type AcknowledgeDeliveryDTO = CommandBase & {
  deliveryId: string
  expectedDeliveryVersion: number
  expectedCaseVersion: number
}

type CaseDocumentDTO = {
  id: string
  caseId: string
  pendencyId: string | null
  resultId: string | null
  kind: 'REFERRAL' | 'EXAM' | 'INFORMATION' | 'RESULT_PDF_RECEIPT' | 'OTHER'
  title: string
  mimeType: string
  sizeBytes: number
  contentHash: `sha256:${string}`
  metadata: {
    observedAt: string | null
    issuer: string | null
    note: string | null
  }
  createdBy: ActorSnapshotDTO
  createdAt: string
}
```

`role`, ator, horário, hash, estado, `targetServiceId` de entrega e `encounterType` nunca
vêm do renderer. `blocking` e objetos genéricos são campos desconhecidos. A confirmação
do retorno reutiliza o `ConfirmBookingInput` discriminado e owned pela agenda; este domínio
não define um segundo command concorrente.

`documents.registerMetadata` aceita somente `RegisterDocumentMetadataDTO`, exige
`pendency:evidence:register`, pendência `REQUESTED` ou `INSUFFICIENT_REOPENED`, owner derivado da sessão e escopo do mesmo
caso. `contentHash` precisa corresponder exatamente a `sha256:` + 64 hex minúsculos;
`sizeBytes` é inteiro seguro não negativo. O schema estrito não possui bytes, base64,
`file://`, path ou URL. Mesmo `requestId`/fingerprint devolve o mesmo `CaseDocumentDTO`; o
mesmo ID com payload diferente falha `IDEMPOTENCY_KEY_REUSED`. `pendencies.submitEvidence`
aceita somente documentos já vinculados àquela pendência e ao mesmo caso;
`pendencies.reviewEvidence` é exclusivo do anestesiologista e decide suficiência.
`returnRequests.decide` é outro comando explícito e nunca efeito colateral da evidência.

### Outputs exatos

```ts
type EncounterCommonDTO = {
  id: string
  caseId: string
  bookingId: string
  sequence: number
  encounterType: 'INITIAL' | 'RETURN'
  reviewCycle: number
  responsibleActor: ActorSnapshotDTO
  startedAt: string
}

type EncounterStateDTO =
  | { status: 'IN_PROGRESS' | 'WAITING_PENDING'; completionReason: null; completedAt: null }
  | {
      status: 'COMPLETED'
      completionReason: 'RETURN_STARTED' | 'RESULT_FINALIZED'
      completedAt: string
    }

type AnesthesiaEncounterDTO =
  | (EncounterCommonDTO & Extract<EncounterStateDTO, { status: 'IN_PROGRESS' | 'WAITING_PENDING' }> & {
      view: 'CLINICAL'
      assessmentContent: AssessmentDraftContentV1
      version: number
      canResumeReview: boolean
    })
  | (EncounterCommonDTO & Extract<EncounterStateDTO, { status: 'COMPLETED' }> & {
      view: 'CLINICAL'
      assessmentContent: AssessmentContentV1
      version: number
      canResumeReview: false
    })
  | (EncounterCommonDTO & EncounterStateDTO & {
      view: 'OPERATIONAL'
      assessmentContent: null
      version: null
      canResumeReview: boolean
    })

type PendencyBaseDTO = {
  id: string
  caseId: string
  encounterId: string
  reviewCycle: number
  kind: 'EXAM' | 'INFORMATION' | 'DOCUMENT' | 'OTHER'
  ownerRole: 'RECEPCAO' | 'ENFERMAGEM' | 'ANESTESIOLOGISTA' | 'SOLICITANTE'
  targetServiceId: string | null
  impact:
    | 'BLOCKS_CURRENT_RESULT'
    | 'FOLLOW_UP_WITHOUT_BLOCKING'
    | 'MAY_PREVENT_PROCEDURE'
    | 'OPERATIONAL_ONLY'
    | 'INDETERMINATE_PENDING_REVIEW'
  dueAt: string | null
  dueAtBasis: string | null
  overdue: boolean
  openedBy: ActorSnapshotDTO
  openedAt: string
}

type PendencyStateDTO =
  | {
      status: 'REQUESTED'
      evidenceSubmittedBy: null
      evidenceSubmittedAt: null
      reviewedBy: null
      reviewedAt: null
      reviewReason: null
      cancelledBy: null
      cancelledAt: null
      cancellationReason: null
    }
  | {
      status: 'EVIDENCE_SUBMITTED'
      evidenceSubmittedBy: ActorSnapshotDTO
      evidenceSubmittedAt: string
      reviewedBy: null
      reviewedAt: null
      reviewReason: null
      cancelledBy: null
      cancelledAt: null
      cancellationReason: null
    }
  | {
      status: 'RESOLVED_ACCEPTED' | 'INSUFFICIENT_REOPENED'
      evidenceSubmittedBy: ActorSnapshotDTO
      evidenceSubmittedAt: string
      reviewedBy: ActorSnapshotDTO
      reviewedAt: string
      reviewReason: string
      cancelledBy: null
      cancelledAt: null
      cancellationReason: null
    }
  | {
      status: 'CANCELLED' | 'SUPERSEDED'
      evidenceSubmittedBy: ActorSnapshotDTO | null
      evidenceSubmittedAt: string | null
      reviewedBy: ActorSnapshotDTO | null
      reviewedAt: string | null
      reviewReason: string | null
      cancelledBy: ActorSnapshotDTO
      cancelledAt: string
      cancellationReason: string
    }

type AssignedPendencyDTO = PendencyBaseDTO & PendencyStateDTO & {
  view: 'ASSIGNEE'
  caseContext: {
    displayCode: string
    personName: string
    procedureDescription: string
  }
  description: string
  content: PendencyContent
  version: number
}

type CasePendencyDTO =
  | AssignedPendencyDTO
  | (PendencyBaseDTO & PendencyStateDTO & {
      view: 'CLINICAL'
      description: string
      content: PendencyContent
      version: number
    })
  | (PendencyBaseDTO & PendencyStateDTO & {
      view: 'OPERATIONAL'
      description: null
      content: null
      version: null
    })

type ReturnRequestDTO = {
  id: string
  caseId: string
  sourceEncounterId: string
  reviewCycle: number
  triggerPendencyIds: string[]
  schedulingRequirement: {
    requirementId: string
    effective: RequirementEffectiveDTO
  }
  status: 'READY_FOR_BOOKING' | 'BOOKED' | 'CHECKED_IN' | 'CONSUMED'
  latestBooking: {
    id: string
    slotId: string
    status:
      | 'CONFIRMED'
      | 'CHECKED_IN'
      | 'CANCELLED'
      | 'COMPLETED'
      | 'NO_SHOW'
    version: number
  } | null
  version: number
  createdAt: string
}

type PreopResultDTO = {
  id: string
  caseId: string
  encounterId: string
  versionNumber: number
  emissionType: 'FINAL' | 'CORRECTION' | 'ADDENDUM'
  predecessorResultId: string | null
  reason: string | null
  isCurrent: boolean
  content: PreopResultContentV1
  contentHash: string
  finalizedBy: ActorSnapshotDTO
  finalizedAt: string
}

type ResultStatusDTO =
  | {
      state: 'NOT_FINALIZED'
      caseId: string
      result: null
      delivery: null
    }
  | {
      state: 'FINAL'
      caseId: string
      result: {
        id: string
        versionNumber: number
        emissionType: 'FINAL' | 'CORRECTION' | 'ADDENDUM'
        contentHash: string
        finalizedAt: string
      }
      delivery: {
        id: string
        sentAt: string
      } & (
        | { status: 'SENT'; receivedAt: null }
        | { status: 'RECEIVED'; receivedAt: string }
      ) | null
    }

type DeliveryCommonDTO = {
  id: string
  caseId: string
  resultId: string
  targetServiceId: string
  channel: 'LOCAL_DEMO' | 'PDF'
  resultHash: string
  sentAt: string
}

type DeliveryStateDTO =
  | { status: 'SENT'; receivedBy: null; receivedAt: null }
  | { status: 'RECEIVED'; receivedBy: ActorSnapshotDTO; receivedAt: string }

type ManagerDeliveryDTO = DeliveryCommonDTO & DeliveryStateDTO & {
  view: 'MANAGER'
  recipient: {
    serviceId: string
    serviceName: string
    physicianName: string
  }
  sentBy: ActorSnapshotDTO
  version: number
}

type RecipientDeliveryDTO = DeliveryCommonDTO & DeliveryStateDTO & {
  view: 'RECIPIENT'
  recipient: { serviceId: string; serviceName: string }
  sentBy: null
  version: number
}

type ClinicalReceiptDeliveryDTO = DeliveryCommonDTO & DeliveryStateDTO & {
  view: 'CLINICAL_RECEIPT'
  recipient: { serviceId: string; serviceName: string }
  sentBy: ActorSnapshotDTO
  version: null
}

type ResultDeliveryDTO =
  | ManagerDeliveryDTO
  | RecipientDeliveryDTO
  | ClinicalReceiptDeliveryDTO

type AuthorizedResultDTO =
  | {
      view: 'CLINICAL'
      result: PreopResultDTO
      delivery: ClinicalReceiptDeliveryDTO | null
    }
  | {
      view: 'REQUESTER'
      result: PreopResultDTO
      delivery: RecipientDeliveryDTO
    }

type RequesterActionDTO = {
  action: 'ACKNOWLEDGE_RESULT'
  deliveryId: string
  caseId: string
  caseDisplayCode: string
  person: {
    fullName: string
    birthDate: string | null
    ageYearsAtOpening: number
    sexReported: 'FEMALE' | 'MALE' | 'INTERSEX' | 'NOT_INFORMED'
  }
  procedure: {
    description: string
    catalogId: string | null
    catalogVersion: string | null
    lateralityOrSite: string | null
  }
  result: {
    resultId: string
    versionNumber: number
    contentHash: string
    finalizedAt: string
  }
  targetServiceId: string
  sentAt: string
}

type CursorPage<T> = { items: T[]; nextCursor: string | null }

type AssessmentWorklistItemDTO = {
  caseId: string
  caseDisplayCode: string
  person: {
    fullName: string
    ageYearsAtOpening: number
    sexReported: 'FEMALE' | 'MALE' | 'INTERSEX' | 'NOT_INFORMED'
  }
  procedure: { description: string; lateralityOrSite: string | null }
  booking: {
    id: string
    kind: 'INITIAL' | 'RETURN'
    status: 'CHECKED_IN' | 'COMPLETED'
    startsAt: string
  }
  encounter: {
    id: string
    status: 'IN_PROGRESS' | 'WAITING_PENDING'
    reviewCycle: number
  } | null
  nextAction: 'START_ENCOUNTER' | 'OPEN_ENCOUNTER'
}

type ResultListItemDTO = {
  caseId: string
  caseDisplayCode: string
  person: { fullName: string; ageYearsAtOpening: number }
  procedureDescription: string
  result: { id: string; contentHash: string; finalizedAt: string }
  delivery:
    | null
    | ({ id: string; sentAt: string } & (
        | { status: 'SENT'; receivedAt: null }
        | { status: 'RECEIVED'; receivedAt: string }
      ))
  availableAction: 'OPEN_RESULT' | 'ACKNOWLEDGE_RESULT' | null
}
```

`ReturnRequestDTO.latestBooking` é projeção de join ordenada por
`scheduling_bookings.created_at DESC`; não é coluna nem vínculo persistido em
`return_requests`.

`ResultStatusDTO` é o único output de `results.getStatus` e deliberadamente não possui
propriedade `content`, nem mesmo com valor nulo. `AuthorizedResultDTO` é exclusivo de
`results.getCurrent`. `results.getHistory` retorna somente metadados/versionamento
autorizados; conteúdo de versão histórica exige a mesma capability e escopo de
`results.getCurrent`.

`encounters.list`, `pendencies.listAssigned` e `results.listForActor` são as queries
canônicas das três worklists. Todas usam cursor opaco, limite 1–100 e ordenação estável
`(operationalTimestamp DESC, id DESC)`:

- `encounters.list({ states?, cursor?, limit? })` retorna
  `CursorPage<AssessmentWorklistItemDTO>` somente para `ANESTESIOLOGISTA`; inclui bookings
  `CHECKED_IN` ainda sem encontro e encontros ativos do ator, nunca `assessmentContent`;
- `pendencies.listAssigned({ status?, overdue?, cursor?, limit? })` retorna
  `CursorPage<AssignedPendencyDTO>` filtrado por `owner_role = ActorContext.role`; para
  `SOLICITANTE`, acrescenta `target_service_id = ActorContext.requestingServiceId` e responde
  `NOT_FOUND` fora do escopo;
- `results.listForActor({ deliveryStatus?, cursor?, limit? })` retorna
  `CursorPage<ResultListItemDTO>` sem `content`; para `SOLICITANTE`, filtra obrigatoriamente
  `preop_cases.requesting_service_id` pela sessão e exige delivery `SENT | RECEIVED` para o
  próprio serviço. Recepção vê status operacional; anestesiologista vê seus resultados
  finalizados. Cada `availableAction` é derivada no main.

Projeções:

- `ANESTESIOLOGISTA`: status por `ResultStatusDTO` e conteúdo `CLINICAL`;
- `RECEPCAO`: encontro `OPERATIONAL`, resultado somente por `ResultStatusDTO`, pendência
  `ASSIGNEE` somente se owner, entrega `MANAGER`;
- `ENFERMAGEM`: encontro `OPERATIONAL`, pendência `ASSIGNEE` somente se owner;
- `SOLICITANTE`: pendência `ASSIGNEE`, status por `ResultStatusDTO`, conteúdo
  `REQUESTER`, entrega `RECIPIENT` e `RequesterActionDTO`, sempre após
  `requireServiceScope`;
- `ADMIN`: nenhuma projeção clínica.

## Commands, Capabilities And Errors

| Command/query | Capability consumida | Guarda |
|---|---|---|
| `scheduling.bookings.checkIn` | `scheduling:booking:check-in` | recepção; janela e booking |
| `encounters.list` | `assessment:read` | worklist do anestesiologista; sem conteúdo de avaliação |
| `encounters.getClinical` | `assessment:read` | anestesiologista |
| `encounters.getOperational` | `case:read:assigned` | recepção/enfermagem |
| `encounters.start/saveAssessment/resumeReview` | `assessment:write` | anestesiologista |
| `pendencies.open/cancel/reviewEvidence` | `pendency:manage` | anestesiologista |
| `pendencies.listAssigned/get` | `case:read:assigned` | owner autorizado; scope de serviço e `AssignedPendencyDTO` |
| `documents.registerMetadata` | `pendency:evidence:register` | owner da pendência; mesmo caso; metadados/hash sem bytes |
| `pendencies.submitEvidence` | `pendency:evidence:register` | owner autorizado; scope de serviço; não decide suficiência |
| `returnRequests.decide` | `assessment:write` | anestesiologista; requisito de retorno explícito e completo |
| `returnRequests.listReady` | `scheduling:booking:manage` | recepção |
| `results.finalize/revise` | `assessment:write` | anestesiologista; `revise` exige head atual, predecessor e motivo |
| `results.listForActor` | `result:status:read` | lista sem conteúdo; scope de serviço obrigatório ao solicitante |
| `results.getStatus` | `result:status:read` | `RECEPCAO`, `ANESTESIOLOGISTA`, `SOLICITANTE`; solicitante passa por `requireServiceScope`; retorna `ResultStatusDTO` |
| `results.getCurrent/getHistory` | `result:content:read` | somente `ANESTESIOLOGISTA` ou `SOLICITANTE`; solicitante passa por `requireServiceScope` |
| `results.exportPdf` | `result:export` | somente `ANESTESIOLOGISTA` ou `SOLICITANTE`; solicitante passa por `requireServiceScope` |
| `deliveries.send` | `delivery:manage` | recepção; `FINAL` carregado internamente sem chamar `results.getCurrent` |
| `deliveries.acknowledge` | `delivery:acknowledge` | serviço solicitante |

`results.getStatus` e `results.getCurrent` recebem somente `GetResultByCaseDTO`; papel,
capability, `view` e escopo são derivados da sessão no main. A primeira retorna
`ResultStatusDTO`; a segunda retorna `AuthorizedResultDTO`.

```ts
type AssessmentErrorCode =
  | 'BOOKING_NOT_CHECKED_IN'
  | 'BOOKING_KIND_MISMATCH'
  | 'RETURN_REQUEST_NOT_READY'
  | 'ACTIVE_ENCOUNTER_EXISTS'
  | 'INVALID_ASSESSMENT_STATE'
  | 'PENDENCY_KIND_MISMATCH'
  | 'PENDENCY_NOT_OWNER'
  | 'SERVICE_SCOPE_MISMATCH'
  | 'OPEN_BLOCKERS'
  | 'RETURN_REQUIRED'
  | 'RESULT_VERSION_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
```

Erros não carregam conteúdo clínico. `NOT_FOUND` também cobre recurso fora do escopo.
Não existe capability `result:read`.

## Critical Transactions

### 1. Check-in

1. Receber command pela agenda e consultar receipt.
2. Exigir booking `CONFIRMED`, janela válida e caso `SCHEDULED` para `INITIAL` ou
   `WAITING_RETURN` para `RETURN`.
3. Em `RETURN`, exigir request `BOOKED` e mesmo caso.
4. Marcar booking `CHECKED_IN`; request `CHECKED_IN` quando aplicável.
5. Mover caso para `WAITING_ANESTHESIA`; gravar eventos, auditoria e receipt.

### 2. Iniciar encontro

1. Consultar assessment receipt e carregar sessão.
2. Exigir anestesiologista, booking `CHECKED_IN` e caso `WAITING_ANESTHESIA`.
3. Derivar `encounterType` do booking.
4. Se `RETURN`, exigir request `CHECKED_IN`, fechar o encontro fonte como
   `COMPLETED/RETURN_STARTED` e consumir a solicitação.
5. Criar encontro `IN_PROGRESS`, marcar booking `COMPLETED` com
   `completed_by_encounter_id`, semear o `AssessmentDraftContentV1` vazio determinístico e
   mover caso para `IN_ASSESSMENT`.
6. Preservar todas as `scheduling_resource_occupancies` do slot até `slot.ends_at`; a
   transição para `COMPLETED` não libera capacidade.
7. Gravar receipt/eventos no mesmo commit.

### 3. Abrir pendência

1. Exigir encontro `IN_PROGRESS` ou `WAITING_PENDING` e mesmo ciclo.
2. Validar union, owner, service, prazo e documentos.
3. Inserir `REQUESTED`; no primeiro item, mover encontro para `WAITING_PENDING` e caso para
   `PENDING`.
4. Gravar receipt/eventos. Itens adicionais do mesmo ciclo não repetem transição.

### 4. Submeter e revisar evidência

1. Lock por versão e receipt.
2. `documents.registerMetadata`, quando usado, trava caso e pendência, exige ambos na versão
   esperada e no mesmo caso, insere documento imutável + receipt no mesmo commit e não muda
   estado da pendência.
3. `submitEvidence`: exigir `REQUESTED` ou `INSUFFICIENT_REOPENED`, owner e payload do mesmo
   kind; cada `documentId` precisa apontar à própria pendência/caso. Persistir
   `EVIDENCE_SUBMITTED`; não resolver, retomar encontro ou criar retorno.
4. `reviewEvidence`: exigir anestesiologista e evidência `EVIDENCE_SUBMITTED`; `ACCEPT`
   produz `RESOLVED_ACCEPTED`, enquanto `REOPEN_AS_INSUFFICIENT` produz
   `INSUFFICIENT_REOPENED`, sempre com motivo/autoria no mesmo commit.
5. `cancel` ou `supersede`: exigir estado ainda não terminal, anestesiologista e motivo.
6. Recalcular blockers pelo predicado literal: impacto `BLOCKS_CURRENT_RESULT` e estado não
   terminal/resolvido. Pendências não bloqueadoras permanecem visíveis sem impedir versão.
7. Nenhuma dessas ações cria `ReturnRequest`.
8. Gravar receipt/eventos.

### 5. Retomar sem retorno

1. Exigir anestesiologista, encontro `WAITING_PENDING`, caso `PENDING`, zero blocker atual
   não resolvido e nenhuma solicitação de retorno ativa; essa é a mesma expressão SQL que
   deriva `canResumeReview=true`.
2. Incrementar `reviewCycle`, mudar encontro para `IN_PROGRESS` e caso para
   `IN_ASSESSMENT`.
3. Gravar receipt/eventos.

### 6. Decidir e reservar retorno

`returnRequests.decide` exige anestesiologista, evidências já revisadas, objetivo, IDs do
mesmo encontro/ciclo e `RequirementEffectiveDTO` completo definido ou confirmado por ele.
Cria exatamente um request ativo e muda o caso para `WAITING_RETURN`. Não é chamado por
`submitEvidence`, `reviewEvidence` ou pelo último blocker.

Depois dessa decisão, `scheduling.bookings.confirm` recebe o `ConfirmBookingInput` canônico com
`need.kind='RETURN'`, `returnRequestId` e versão. Valida o snapshot, confirma slot
compatível pela FK `scheduling_bookings.return_request_id` e muda request para `BOOKED`.
O caso permanece `WAITING_RETURN`. Cancelamento/no-show encerra o booking e reabre o mesmo
request; não existe `return_requests.booking_id` para limpar.

### 7. Finalizar

1. Exigir anestesiologista, encontro `IN_PROGRESS`, caso `IN_ASSESSMENT`, versões atuais;
   montar o candidato trocando somente `state: 'DRAFT'` por `state: 'COMPLETE'` e validá-lo
   pelo schema `AssessmentContentV1`; `NOT_RECORDED`, confirmação nula ou síntese incompleta
   bloqueiam.
2. Exigir zero pendência `BLOCKS_CURRENT_RESULT` ainda não resolvida e nenhuma versão
   corrente já finalizada para o mesmo encontro.
3. Persistir o assessment convertido para `state='COMPLETE'`, inserir versão 1 `FINAL`,
   hash e autoria e criar `preop_result_heads`; concluir encontro com `RESULT_FINALIZED`.
4. Mover caso para `READY_FOR_HANDOFF`; gravar receipt/eventos.
5. Trigger impede alteração da versão; somente o head pode avançar por comando próprio.

### 7a. Corrigir ou aditar resultado

1. Exigir anestesiologista, `predecessorResultId` igual ao head e
   `expectedHeadVersion` atual; validar motivo e novo conteúdo.
2. Inserir versão imutável `n+1` com `CORRECTION` ou `ADDENDUM`, apontando para a
   predecessora; avançar o head por CAS.
3. Se a versão predecessora já possuía delivery, preservá-lo, mover o caso de volta a
   `READY_FOR_HANDOFF` e criar novo ciclo de handoff para a versão corrente. Nunca atualizar
   ou apagar receipt anterior.
4. Gravar evento, auditoria e receipt na mesma transação.

### 8. Enviar e receber

1. `send`: exigir recepção + `delivery:manage`; o delivery service carrega a versão
   corrente apontada pelo head
   diretamente do repositório dentro da transação, sem chamar `results.getCurrent` e sem
   conceder `result:content:read`; copia `serviceId`/recipient do caso, insere `SENT` e
   grava receipt/eventos; não mover o caso.
2. `acknowledge`: exigir solicitante do mesmo serviço, `SENT`, resultId ainda corrente e
   versões atuais; produzir `RECEIVED` e `DELIVERED_TO_REQUESTER`. Se nova versão surgir
   antes do recebimento, a entrega antiga continua histórica e não encerra o caso.

Falha em qualquer passo reverte domínio, evento, auditoria e receipt.

`canResumeReview` nunca é coluna, metadata, evento nem valor de receipt. Cada query o deriva
no ciclo atual como: encontro `WAITING_PENDING` + caso `PENDING` + zero blocker atual não
resolvido + zero `ReturnRequest` ativo. Um contract
test executa a mesma predicate usada por `encounters.resumeReview`, impedindo drift entre
CTA e command.

## Frontend Blueprint

| Componente | Contrato |
|---|---|
| `CheckInAction` | visível só à recepção; mostra kind e bloqueio |
| `AssessmentCasePage` | snapshots + encontro autorizado |
| `AssessmentEditor` | rascunho explícito, conflito sem last-write-wins |
| `PendenciesPanel` | union por kind, owner, prazo e status |
| `PendencyEvidenceForm` | renderiza somente schema do kind; submissão não equivale a aceite clínico |
| `ReturnRequestsPage` | slots compatíveis e booking `RETURN` |
| `ResultReview` | motivo de bloqueio e confirmação final |
| `DeliveryPanel` | metadata/hash, PDF, envio e recebimento |

Regras de UI:

- leitura anterior é imutável; somente encontro `IN_PROGRESS` edita;
- conflito preserva rascunho local e oferece recarregar/comparar;
- pendência mostra próxima ação, owner e atraso; payload só aparece na projeção autorizada;
- “Retomar avaliação” aparece ao anestesiologista quando `canResumeReview`;
- `ReturnRequest READY_FOR_BOOKING` aparece à recepção, nunca como conclusão;
- recepção chama `results.getStatus` e vê somente `ResultStatusDTO`; não recebe conteúdo
  JSON nem exporta PDF;
- solicitante vê apenas `RequesterActionDTO` do próprio serviço;
- salvar PDF não marca envio nem recebimento.

## Validation Strategy

### Schemas

- rejeitar `blocking`, `Record<string, unknown>`, campos extras e HTML;
- rejeitar kind/payload divergente;
- validar `RECEIVED`/`UNAVAILABLE`, documentos, owner/service e prazo;
- `AssessmentDraftContentV1` vazio e parcial salva; o mesmo conteúdo falha no schema
  `AssessmentContentV1` até confirmações, narrativas e síntese estarem completos;
- validar limites de `AssessmentDraftContentV1`, `AssessmentContentV1` e `PreopResultContentV1`;
- provar que não existe input de `role`, actor, hash, estado ou destinatário.
- provar que `ResultStatusDTO` não aceita ou serializa propriedade `content`.
- provar shapes exatos de `AssignedPendencyDTO`, `CaseDocumentDTO`,
  `AssessmentWorklistItemDTO` e `ResultListItemDTO`, sem propriedade clínica extra.

### Banco e services

- índices impedem encontro, request, booking e resultado duplicados;
- toda FK composta recusa booking, encounter, pendência, request, resultado, documento ou
  entrega cujo parent pertença a outro caso;
- check-in `INITIAL` e `RETURN` aplicam estados corretos;
- start sem check-in e retorno sem request falham sem efeito;
- booking inicia um único encontro, vira `COMPLETED` no start e referencia esse encontro;
- start não remove ocupações; o bundle segue ocupado até `slot.ends_at`;
- evidência submetida mantém `PENDING` até revisão clínica e eventual `resumeReview`;
- `canResumeReview` não existe no DDL e a query usa exatamente a mesma predicate do command;
- somente `returnRequests.decide` cria request, com requisito completo e concorrência tratada;
- mistura de pendências usa somente o ciclo atual;
- cancelamento clínico só pelo anestesiologista;
- no-show/cancelamento reabre o mesmo return request;
- finalização falha com blocker atual não resolvido e segunda versão corrente do mesmo
  contexto falha;
- `UPDATE`/`DELETE` de qualquer versão falham; correção/adendo insere versão e avança head;
- todos os commands produzem events/receipt na mesma transação.
- `documents.registerMetadata` aceita metadata/hash válidos, recusa bytes/path/hash inválido
  e `pendencies.submitEvidence` recusa documento de outra pendência ou caso;
- CHECKs de encounter, pendência, ReturnRequest e delivery recusam timestamps/atores
  incompatíveis com o status.

### Idempotência e concorrência

- replay igual devolve o mesmo DTO sem nova linha/evento;
- fingerprint divergente retorna `IDEMPOTENCY_KEY_REUSED`;
- duas submissões/revisões concorrentes da mesma versão deixam um vencedor;
- duas criações de return request deixam uma;
- duas finalizações deixam um `FINAL`;
- conflito não gera receipt de sucesso.

### Autorização e redaction

- recepção não inicia/salva/retoma/finaliza;
- anestesiologista não faz check-in nem booking;
- owner incorreto não cumpre;
- solicitante de outro serviço recebe `NOT_FOUND`;
- `pendencies.listAssigned` filtra owner e serviço; `encounters.list` e
  `results.listForActor` não carregam assessment/result content;
- admin não recebe DTO clínico;
- projections anulam conteúdo conforme os tipos exatos;
- `result:read` não existe; `results.getHistory` exige `result:content:read` e escopo;
- recepção, anestesiologista e solicitante autorizado recebem `ResultStatusDTO` sem
  conteúdo por `result:status:read`;
- recepção recebe `FORBIDDEN` em `results.getCurrent`;
- `results.getCurrent` exige `result:content:read`; solicitante de outro serviço recebe
  `NOT_FOUND`;
- `results.exportPdf` aceita somente anestesiologista/solicitante autorizado com
  `result:export`; recepção nunca recebe conteúdo ou bytes do PDF;
- `deliveries.send` funciona sob `delivery:manage` sem conceder à recepção
  `result:content:read`;
- logs/auditoria não contêm pedido integral, cumprimento, avaliação ou resultado.

### PDF

- somente a versão corrente (`FINAL`, `CORRECTION` ou `ADDENDUM`) exporta;
- exportação carrega a versão corrente internamente e não devolve `PreopResultDTO` à
  recepção;
- HTML nasce no main e escapa conteúdo;
- rede e JavaScript continuam bloqueados;
- falha não altera entrega.

### E2E

1. check-in inicial → encontro → `FINAL` → PDF → envio → recebimento;
2. pendência sem retorno → cumprimento → `resumeReview` → conclusão;
3. pendência com retorno → request → booking → check-in → novo encontro → conclusão;
4. cancel/no-show do retorno → mesma solicitação volta à recepção;
5. solicitante de outro serviço não vê ação ou resultado;
6. replay idempotente e conflito de versão não duplicam dados.

## Rollout And Rollback

Ordem futura:

1. migration base da agenda cria booking `INITIAL`, sem FKs para assessment;
2. migration expand-only de assessment cria encounters, pendências e `return_requests`;
3. migration de integração da agenda adiciona `kind`, `return_request_id`,
   `return_request_version`, `completed_by_encounter_id`, FKs e índices cruzados;
4. schemas/receipts e services sem rota;
5. routers guardados e testes;
6. superfícies de encontro/pendência;
7. retorno integrado à agenda;
8. resultado, PDF e handoff;
9. E2E ponta a ponta.

Desativar rotas preserva dados. Nenhuma etapa apaga o esquema provisório. Resultado `FINAL`
nunca é removido por rollback. O rollback de aplicação ignora as novas tabelas; migration
destrutiva não pertence ao MVP.

## Build Risks And Decisions

- **Autoria local não é assinatura institucional.**
- **Cumprimento não é decisão clínica.**
- **Retorno recebe requisito operacional explícito do anestesiologista; não herda o inicial nem calcula risco.**
- **Resultado corrigido/aditado nasce como nova versão imutável e novo handoff.**
- **Redaction pertence ao main; UI escondida não é autorização.**
- **PDF exportado sai do controle do app; o MVP registra hash e não promete revogação.**
- **Dados reais exigem threat model e aprovação fora do hackathon.**

## Resultado da investigação

Este arquivo permanece owner técnico do domínio. Provas de runtime pertencem aos Writing
Plans e ao QA das fatias; não existe gate individual neste arquivo.

## Estado de consolidação

- Estado: `CANONICAL_DOMAIN_BUILD`.
- Autoridade canônica: este arquivo no domínio de avaliação, pendências e handoff.
- Gate individual: inexistente.
- Uso futuro: fonte obrigatória do Warlog e dos Writing Plans que tocarem avaliação,
  pendências, retorno, resultado ou handoff.
