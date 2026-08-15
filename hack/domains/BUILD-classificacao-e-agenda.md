# Build — Classificação operacional e agenda

## Estado documental

- Papel: `CANONICAL_DOMAIN_BUILD`.
- Indexado por: `hack/BUILD.md`.
- Gate ou assinatura individual: inexistente.
- O estado de maturidade permanece no tracker único; o hub não pode promovê-lo sozinho.
- Este arquivo é a fonte técnica do domínio. `hack/BUILD.md` apenas integra dependências;
  não substitui, resume com perda nem supera este contrato.

## Goal

Implementar um motor puro `demo-workload-v1` que transforma uma revisão finalizada da
anamnese em requisito operacional explicável e uma agenda local de slots QUICK, STANDARD e
EXTENDED. Submit `FINAL` e cálculo formam um único commit; confirmação/override publicam o
requisito. A reserva deve ser filtrada por duração/capabilities, transacional, idempotente e
segura contra dupla confirmação e sobreposição de recurso. O renderer porta o shell
FullCalendar do DietFlow, mas o PGlite permanece a fonte de verdade.

## Current Terrain

- O motor de fila está intencionalmente vazio em `src/shared/extensions/motor-fila.ts:1-14`.
- Estados e prioridade existentes são legados em `src/shared/clinical/registro.ts:11-23` e
  `src/main/db/clinical-schema.ts:22-39`.
- `src/shared/clinical/risco.ts:1-7` proíbe usar o classificador histórico como protocolo ou
  agenda.
- Não há tabelas de recursos/slots/bookings em `src/main/db/schema.ts:8-205`.
- Não há handlers de agenda em `src/main/tipc.ts:265-400`.
- Não há rota de agenda em `src/renderer/src/App.tsx:13-56`.
- `package.json:35-89` não inclui FullCalendar; tabela, cards, popover, dialog e sheet já
  existem em `src/renderer/src/components/ui/`.

## Recommended Path

Criar namespace `scheduling` independente do legado clínico. O motor puro consome um DTO
sanitizado da revisão candidata a `FINAL` e emite um requisito completo; o submit persiste
revisão + cálculo atomicamente e uma decisão posterior publica confirmação/override. A
agenda materializa até 30 dias a partir de janelas datadas administráveis, sem recorrência.
Booking usa índices parciais, ocupação exclusiva de recursos, command receipt e transação
curta. FullCalendar consulta uma projeção operacional por intervalo; nenhuma regra vive no
componente. DnD e resize apenas propõem mudanças, sempre revalidadas no main.

## Files / Areas

| Path/Area | Action | Reason | Risk |
|---|---|---|---|
| `src/shared/scheduling/types.ts` | new | DTOs de regra, requisito, slot e booking | high |
| `src/shared/scheduling/rule-v1.ts` | new | Motor determinístico puro | high |
| `src/shared/scheduling/explanation.ts` | new | Redação segura por papel | medium |
| `src/shared/extensions/motor-fila.ts` | deprecate/export boundary | Nome de fila não pode contaminar agenda | low |
| `src/main/db/migrations/00x_scheduling_base.sql` | new | Agenda e booking INITIAL sem FKs para assessment | high |
| `src/main/db/migrations/00z_scheduling_assessment_integration.sql` | new | Extensão RETURN/encounter após migration de assessment | high |
| `src/main/db/seed.ts` | expand | Fixtures de regra/template/recurso/capacidade | medium |
| `src/main/scheduling/requirement-service.ts` | new | Pausa/resume, cálculo interno ao submit, confirmação e override | high |
| `src/main/scheduling/capacity-service.ts` | new | CRUD admin de recursos, janelas datadas e bloqueios | critical |
| `src/main/scheduling/slot-service.ts` | new | Materialização, ocupações e consulta | critical |
| `src/main/scheduling/booking-service.ts` | new | Reserva/reagendamento/idempotência | critical |
| `src/main/scheduling/router.ts` | new | TIPC fino e guards | high |
| `src/main/tipc.ts` | spread router | Wiring | low |
| `package.json` | add | FullCalendar v6 React, daygrid, timegrid, interaction, list e rrule | medium |
| `src/renderer/src/paginas/AgendaPagina.tsx` | new | Shell operacional completa | high |
| `src/renderer/src/componentes/agenda/` | new | Calendar, toolbar, filters, renderers e drawer | high |
| `src/renderer/src/App.tsx` | add routes | Navegação | low |
| `tests/shared/scheduling/` | new | Oráculos do motor | medium |
| `tests/main/db/scheduling*.spec.ts` | new | Constraints/corridas | high |
| `tests/renderer/agenda*.spec.tsx` | new | Fluxo/estados/a11y | medium |

## Contracts

### Product

- QUICK = 20 minutos + 5 de buffer.
- STANDARD = 35 minutos + 5 de buffer.
- EXTENDED = 50 minutos + 10 de buffer.
- As classes representam carga de revisão, nunca urgência ou gravidade.
- Enfermagem confirma ou faz override justificado.
- Recepção vê requisito operacional e slots; não vê evidência clínica.
- A reserva termina com comprovante, ou com conflito/sem capacidade acionável.
- Cancelamento, reagendamento e no-show preservam trilha; reclassificação pós-publicação
  não pertence ao MVP.

### Backend

#### Tipos compartilhados

```ts
type SlotClass = 'QUICK' | 'STANDARD' | 'EXTENDED'
type BookingKind = 'INITIAL' | 'RETURN'

type CaseStatus =
  | 'RECEIVED_AT_RECEPTION'
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

type RequirementStatus =
  | 'CALCULATED'
  | 'CONFIRMED'
  | 'OVERRIDDEN'

type ResourceKind = 'ANESTHESIA_PROFESSIONAL' | 'ROOM' | 'SUPPORT'

type ResourceCapability =
  | 'STANDARD_ROOM'
  | 'ACCESSIBLE_ROOM'
  | 'INTERPRETER'
  | 'COMPANION_SPACE'

type SignalCode =
  | 'REQUIRED_FIELD_NOT_ASKED'
  | 'ALLERGY_REVIEW'
  | 'ANESTHESIA_HISTORY_REVIEW'
  | 'CARDIOVASCULAR_REVIEW'
  | 'RESPIRATORY_REVIEW'
  | 'BLEEDING_THROMBOSIS_REVIEW'
  | 'HABITS_SUBSTANCES_REVIEW'
  | 'SPECIAL_CONDITION_REVIEW'
  | 'MEDICATION_VOLUME'
  | 'DIAGNOSIS_VOLUME'
  | 'DOCUMENT_PENDING'
  | 'ACCOMMODATION_COMMUNICATION'
  | 'ACCOMMODATION_MOBILITY'
  | 'ACCOMMODATION_COMPANION'
  | 'DESIRED_BY_PLANNED_DATE'
  | 'DESIRED_BY_DEFAULT'

type RuleInput = {
  caseId: string
  anamnesisId: string
  revision: number
  completedAt: string
  plannedProcedureDate: string | null
  widgets: PreAnesthesiaContent['blocks']
}

type RuleSignalDTO = {
  code: SignalCode
  sourcePaths: string[]
  matched: boolean
  proposedMinutes: number
  appliedMinutes: number
  capReason: 'DOMAIN_REVIEW_CAP' | 'ACCOMMODATION_GROUP_CAP' | null
  addedCapabilities: ResourceCapability[]
}

type RuleOutput =
  | {
      kind: 'INCOMPLETE'
      pendingFieldPaths: string[]
      ruleSet: { id: 'demo-workload'; version: 1 }
    }
  | {
      kind: 'HUMAN_DEFINITION_REQUIRED'
      unresolvedFieldPaths: string[]
      ruleSet: { id: 'demo-workload'; version: 1 }
    }
  | {
      kind: 'OUT_OF_DEMO_RANGE'
      estimatedMinutes: number
      signals: RuleSignalDTO[]
      ruleSet: { id: 'demo-workload'; version: 1 }
    }
  | {
      kind: 'CALCULATED'
      estimatedMinutes: number
      effective: RequirementEffectiveDTO
      signals: RuleSignalDTO[]
      ruleSet: { id: 'demo-workload'; version: 1 }
    }
```

O motor exporta somente:

```ts
function calculateSchedulingRequirement(
  input: RuleInput,
  now: string,
): RuleOutput
```

`now` é injetado. A função não acessa PGlite, React, relógio global, catálogo ou rede.
`SignalCode`, paths, predicados, incrementos, grupos e capabilities são a matriz literal
`demo-workload-v1` do Analyst; `rule-v1.ts` os declara como constante
`satisfies readonly SignalDefinition[]`.
Teste de contrato compara a lista e os paths literalmente para impedir consumo implícito de
campo novo. O algoritmo começa em 20, limita `DOMAIN_REVIEW` a três incrementos de cinco,
aplica `MEDICATION_VOLUME` e `DIAGNOSIS_VOLUME` uma vez, aplica `ACCOMMODATION` uma vez e
não pontua `DOCUMENT_PENDING`. Total acima de 50 retorna `OUT_OF_DEMO_RANGE`; não existe
cap global.

#### Tabelas da regra e requisito

```sql
CREATE TABLE scheduling_rule_sets (
  id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  label TEXT NOT NULL,
  config JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL CHECK (source = 'DEMO'),
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, version)
);

CREATE UNIQUE INDEX one_active_scheduling_rule
  ON scheduling_rule_sets (active) WHERE active = TRUE;

CREATE TABLE scheduling_requirements (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  anamnesis_id TEXT NOT NULL,
  anamnesis_revision INTEGER NOT NULL,
  rule_set_id TEXT NOT NULL,
  rule_set_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'CALCULATED','CONFIRMED','OVERRIDDEN'
  )),
  slot_class TEXT NOT NULL CHECK (slot_class IN ('QUICK','STANDARD','EXTENDED')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (20,35,50)),
  buffer_minutes INTEGER NOT NULL CHECK (buffer_minutes IN (5,10)),
  desired_by TIMESTAMPTZ NOT NULL,
  required_resource_kinds JSONB NOT NULL,
  required_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  clinical_explanation JSONB NOT NULL,
  operational_explanation JSONB NOT NULL,
  pending_field_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  input_fingerprint TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  published_at TIMESTAMPTZ,
  UNIQUE (id, case_id),
  UNIQUE (anamnesis_id, anamnesis_revision, rule_set_id, rule_set_version),
  FOREIGN KEY (anamnesis_id, case_id)
    REFERENCES clinical_anamneses(id, case_id) ON DELETE RESTRICT,
  FOREIGN KEY (anamnesis_id, anamnesis_revision, case_id)
    REFERENCES clinical_anamnesis_revisions(anamnesis_id, revision, case_id) ON DELETE RESTRICT,
  FOREIGN KEY (rule_set_id, rule_set_version)
    REFERENCES scheduling_rule_sets(id, version) ON DELETE RESTRICT,
  CHECK (
    (slot_class = 'QUICK' AND duration_minutes = 20 AND buffer_minutes = 5)
    OR (slot_class = 'STANDARD' AND duration_minutes = 35 AND buffer_minutes = 5)
    OR (slot_class = 'EXTENDED' AND duration_minutes = 50 AND buffer_minutes = 10)
  ),
  CHECK (
    (status = 'CALCULATED'
      AND confirmed_at IS NULL AND confirmed_by_actor_id IS NULL AND published_at IS NULL)
    OR (status IN ('CONFIRMED','OVERRIDDEN')
      AND confirmed_at IS NOT NULL AND confirmed_by_actor_id IS NOT NULL
      AND published_at IS NOT NULL)
  )
);

CREATE TABLE scheduling_overrides (
  id BIGSERIAL PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES scheduling_requirements(id) ON DELETE RESTRICT,
  from_class TEXT NOT NULL CHECK (from_class IN ('QUICK','STANDARD','EXTENDED')),
  to_class TEXT NOT NULL CHECK (to_class IN ('QUICK','STANDARD','EXTENDED')),
  to_duration_minutes INTEGER NOT NULL CHECK (to_duration_minutes IN (20,35,50)),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  actor_role TEXT NOT NULL CHECK (actor_role = 'ENFERMAGEM'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (to_class = 'QUICK' AND to_duration_minutes = 20)
    OR (to_class = 'STANDARD' AND to_duration_minutes = 35)
    OR (to_class = 'EXTENDED' AND to_duration_minutes = 50)
  )
);
```

`clinical_explanation` contém paths; `operational_explanation` contém somente frases como
“revisão ampliada”, “múltiplos itens para conciliação” e “acomodação de comunicação”. A query
da recepção seleciona apenas a segunda.

O service permite uma única transição
`CALCULATED → CONFIRMED | OVERRIDDEN`. Trigger de banco rejeita `DELETE`, qualquer update
de linha já publicada e qualquer retorno de status; a única exceção é preencher, no mesmo
commit da transição, autoria, valores efetivos e `published_at`. Assim, revisão `FINAL` e
requirement publicado não podem ser reclassificados silenciosamente.

#### Tabelas de capacidade

```sql
CREATE TABLE scheduling_slot_templates (
  id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  slot_class TEXT NOT NULL CHECK (slot_class IN ('QUICK','STANDARD','EXTENDED')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (20,35,50)),
  buffer_minutes INTEGER NOT NULL CHECK (buffer_minutes IN (5,10)),
  required_resource_kinds JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL CHECK (source = 'DEMO'),
  PRIMARY KEY (id, version),
  CHECK (
    (slot_class = 'QUICK' AND duration_minutes = 20 AND buffer_minutes = 5)
    OR (slot_class = 'STANDARD' AND duration_minutes = 35 AND buffer_minutes = 5)
    OR (slot_class = 'EXTENDED' AND duration_minutes = 50 AND buffer_minutes = 10)
  )
);

CREATE TABLE scheduling_resources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('ANESTHESIA_PROFESSIONAL','ROOM','SUPPORT')),
  name TEXT NOT NULL,
  capabilities JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL CHECK (source IN ('DEMO_FIXTURE','ADMIN')),
  created_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (
    (source = 'DEMO_FIXTURE' AND created_by_actor_id IS NULL)
    OR (source = 'ADMIN' AND created_by_actor_id IS NOT NULL)
  )
);

CREATE TABLE scheduling_availability_windows (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL CHECK (timezone = 'America/Sao_Paulo'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL CHECK (source IN ('DEMO_FIXTURE','ADMIN')),
  replaces_window_id TEXT REFERENCES scheduling_availability_windows(id) ON DELETE RESTRICT,
  created_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (ends_at > starts_at),
  CHECK (
    (starts_at AT TIME ZONE timezone)::date = (ends_at AT TIME ZONE timezone)::date
  ),
  CHECK (EXTRACT(ISODOW FROM starts_at AT TIME ZONE timezone) BETWEEN 1 AND 5),
  CHECK (
    (source = 'DEMO_FIXTURE' AND created_by_actor_id IS NULL)
    OR (source = 'ADMIN' AND created_by_actor_id IS NOT NULL)
  ),
  FOREIGN KEY (template_id, template_version)
    REFERENCES scheduling_slot_templates(id, version) ON DELETE RESTRICT
);

CREATE TABLE scheduling_window_resources (
  window_id TEXT NOT NULL REFERENCES scheduling_availability_windows(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES scheduling_resources(id) ON DELETE RESTRICT,
  PRIMARY KEY (window_id, resource_id)
);

CREATE TABLE scheduling_blocks (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES scheduling_resources(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  CHECK (ends_at > starts_at),
  CHECK (length(trim(reason)) BETWEEN 10 AND 500),
  CHECK (cancellation_reason IS NULL OR length(trim(cancellation_reason)) BETWEEN 10 AND 500),
  CHECK (
    (active = TRUE AND cancelled_by_actor_id IS NULL
      AND cancelled_at IS NULL AND cancellation_reason IS NULL)
    OR (active = FALSE AND cancelled_by_actor_id IS NOT NULL
      AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)
  )
);

CREATE TABLE scheduling_slots (
  id TEXT PRIMARY KEY,
  window_id TEXT NOT NULL REFERENCES scheduling_availability_windows(id) ON DELETE RESTRICT,
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  consultation_ends_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  base_status TEXT NOT NULL CHECK (base_status IN ('AVAILABLE','BLOCKED','EXPIRED')),
  capabilities JSONB NOT NULL,
  generation_key TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (consultation_ends_at > starts_at),
  CHECK (ends_at > consultation_ends_at),
  FOREIGN KEY (template_id, template_version)
    REFERENCES scheduling_slot_templates(id, version) ON DELETE RESTRICT
);

CREATE TABLE scheduling_slot_resources (
  slot_id TEXT NOT NULL REFERENCES scheduling_slots(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES scheduling_resources(id) ON DELETE RESTRICT,
  PRIMARY KEY (slot_id, resource_id)
);

CREATE TABLE scheduling_resource_occupancies (
  slot_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (slot_id, resource_id),
  FOREIGN KEY (slot_id, resource_id)
    REFERENCES scheduling_slot_resources(slot_id, resource_id) ON DELETE CASCADE,
  CHECK (ends_at > starts_at)
);

CREATE INDEX scheduling_resource_occupancies_overlap_idx
  ON scheduling_resource_occupancies(resource_id, starts_at, ends_at);
```

`base_status` não duplica booking. A projeção calcula `BOOKED` pela reserva confirmada.
Não há coluna de recorrência nem editor recorrente. Cada janela é datada, pertence a um
único dia local de segunda a sexta e possui bundle exato
de recursos. Materialização recebe `now`, limita-se a `[startOfDay(now), +30 dias)`, ordena
resource IDs e usa
`generation_key = windowId|windowVersion|template@version|startsAt|sortedResourceIds`.
Para cada slot:

- `consultation_ends_at = starts_at + duration_minutes`;
- `ends_at = consultation_ends_at + buffer_minutes`;
- o slot seguinte começa em `ends_at`;
- o bundle contém exatamente um `ANESTHESIA_PROFESSIONAL`, um `ROOM` e zero ou mais
  `SUPPORT` ativos;
- uma linha de `scheduling_resource_occupancies` nasce para cada recurso no intervalo total.

Todo caminho que insere, remove ou recria occupancy usa uma única transação e adquire
`pg_advisory_xact_lock` para cada resource ID em ordem lexical antes de ler capacidade. A
chave é o inteiro assinado de 64 bits formado pelos primeiros oito bytes do SHA-256 de
`antessala:scheduling-resource:<resourceId>` e é enviado ao PGlite como decimal, sem perda
por `number` JavaScript. Colisão de hash apenas serializa recursos independentes; nunca
libera sobreposição.

Ainda sob todos os locks, o writer executa, para cada recurso:

```sql
SELECT 1
FROM scheduling_resource_occupancies
WHERE resource_id = $1
  AND starts_at < $3
  AND ends_at > $2
LIMIT 1;
```

`$2 = newStart` e `$3 = newEnd`. Resultado existente reverte o lote inteiro como
`RESOURCE_TIME_CONFLICT`; só a ausência permite inserir. Esse protocolo é obrigatório no
materializador e nos commands de resource, window e block. Ele substitui
`btree_gist`/`EXCLUDE`, indisponíveis no PGlite embarcado. Segunda materialização com a mesma
generation key retorna as mesmas contagens, sem inserir.

O MVP não possui calendário de feriados. “Dia útil” significa apenas ISO weekday 1–5 em
`America/Sao_Paulo`; exceções são expressas pela ausência de janela ou por
`scheduling_blocks`, nunca por uma lista de feriados implícita.

Criar block rejeita qualquer booking ativo no intervalo. Na mesma transação, slots livres
afetados viram `BLOCKED`, suas occupancies são removidas e o block é gravado. Cancelar block
o marca inativo e rematerializa o intervalo; o materializador sempre consulta blocks ativos.
Para esse conflito, `COMPLETED` continua consumindo capacidade enquanto
`slot.ends_at > now`; start de encounter nunca remove occupancy.
Os estados de requirement, slot e booking são namespaces internos da agenda. Apenas
`CaseStatus` escreve o lifecycle ponta a ponta; `CANCELLED` interno de um booking não cancela
o caso, e `COMPLETED` interno não encerra atendimento clínico.

#### DTOs e commands administrativos de capacidade

```ts
type CreateResourceInput = {
  requestId: string
  name: string
  kind: ResourceKind
  capabilities: ResourceCapability[]
}
type UpdateResourceInput = {
  requestId: string
  resourceId: string
  expectedVersion: number
  name: string
  capabilities: ResourceCapability[]
  active: boolean
}
type CreateDatedWindowInput = {
  requestId: string
  templateId: string
  templateVersion: number
  startsAt: string
  endsAt: string
  timezone: 'America/Sao_Paulo'
  resourceIds: string[]
}
type ReplaceDatedWindowInput = CreateDatedWindowInput & {
  replacedWindowId: string
  expectedWindowVersion: number
}
type RetireDatedWindowInput = {
  requestId: string
  windowId: string
  expectedVersion: number
}
type CreateResourceBlockInput = {
  requestId: string
  resourceId: string
  startsAt: string
  endsAt: string
  reason: string
}
type CancelResourceBlockInput = {
  requestId: string
  blockId: string
  expectedVersion: number
  reason: string
}
type MaterializeSlotsInput = {
  requestId: string
  from: string
  throughExclusive: string
}
type MaterializationReportDTO = {
  from: string
  throughExclusive: string
  created: number
  retained: number
  blocked: number
  expired: number
}
type ResourceAdminDTO = {
  id: string
  name: string
  kind: ResourceKind
  capabilities: ResourceCapability[]
  active: boolean
  version: number
}
type DatedWindowAdminDTO = {
  id: string
  template: { id: string; version: number; slotClass: SlotClass }
  startsAt: string
  endsAt: string
  timezone: 'America/Sao_Paulo'
  resources: ResourceAdminDTO[]
  active: boolean
  version: number
  materialization: MaterializationReportDTO
}
type ResourceBlockDTO = {
  id: string
  resourceId: string
  startsAt: string
  endsAt: string
  reason: string
  active: boolean
  version: number
}
type CapacityConfigurationDTO = {
  timezone: 'America/Sao_Paulo'
  horizonDays: 30
  holidayCalendar: null
  resources: ResourceAdminDTO[]
  windows: DatedWindowAdminDTO[]
  blocks: ResourceBlockDTO[]
  materializedThroughExclusive: string
}
```

Todos os commands são `ADMIN`, passam pelo receipt comum e recusam campos extras.
Validação fechada:

- `name`: trim de 2–120; `kind` é imutável após criação;
- `ANESTHESIA_PROFESSIONAL` exige `capabilities=[]`; `ROOM` exige `STANDARD_ROOM` e aceita
  somente `ACCESSIBLE_ROOM`/`COMPANION_SPACE` adicionais; `SUPPORT` exige exatamente
  `INTERPRETER` no MVP;
- janela: ISO 8601 com offset, timezone exata, offset coerente com
  `America/Sao_Paulo` naquele instante, `endsAt > startsAt`, início e fim no mesmo dia local
  de segunda a sexta, template/recurso ativos, IDs únicos e bundle de um profissional + uma
  sala + apoios; sábado/domingo falham e feriado não é modelado;
- qualquer update de recurso falha `RESOURCE_HAS_ACTIVE_BOOKING` se o recurso participa de
  slot com booking `CONFIRMED | CHECKED_IN | COMPLETED` cujo `slot.ends_at > now`; nessa
  condição nome, capabilities, `active` e `kind` ficam todos imutáveis;
- replace/retire falham se algum slot afetado possuir booking ativo; replace aposenta a
  janela anterior, remove somente slots futuros livres/occupancies e materializa a nova
  versão no mesmo commit;
- block: motivo 10–500, intervalo válido de até 30 dias e nenhum booking ativo sobreposto;
- materialização aceita intervalo positivo de no máximo 30 dias e nunca ultrapassa a janela;
- reexecução com mesmo `requestId`/fingerprint devolve o mesmo relatório; fingerprint
  divergente retorna `IDEMPOTENCY_KEY_REUSED`.

| Channel `scheduling.capacity.*` | Input | Efeito atômico |
|---|---|---|
| `getConfiguration` | filtros datados opcionais, sem actor no payload | `CapacityConfigurationDTO`; leitura ADMIN derivada da sessão |
| `resources.create` | `CreateResourceInput` | `ResourceAdminDTO` + receipt |
| `resources.update` | `UpdateResourceInput` | `ResourceAdminDTO`; reconcilia slots futuros |
| `windows.create` | `CreateDatedWindowInput` | `DatedWindowAdminDTO`; materializa horizonte afetado |
| `windows.replace` | `ReplaceDatedWindowInput` | `DatedWindowAdminDTO`; aposenta anterior + rematerializa |
| `windows.retire` | `RetireDatedWindowInput` | `DatedWindowAdminDTO`; retira slots futuros livres + occupancies |
| `blocks.create` | `CreateResourceBlockInput` | `ResourceBlockDTO`; bloqueia slots livres |
| `blocks.cancel` | `CancelResourceBlockInput` | `ResourceBlockDTO`; retira block + rematerializa intervalo |
| `materialize` | `MaterializeSlotsInput` | retorna `MaterializationReportDTO` idempotente |

`scheduling.capacity.getConfiguration` exige `scheduling:capacity:manage`, recusa campos
extras e limita janelas/bloqueios ao horizonte solicitado de no máximo 30 dias. É a query
canônica da tela administrativa; não existe query paralela por tabela.

O command público `materialize` é uma invocação **USER**: exige sessão `ADMIN`, persiste
`scheduling_command_receipts.actor_id` e usa `requestId`. Boot e seed chamam somente a
primitiva interna `materializeSlots({ kind: 'SYSTEM', cause: 'BOOT' | 'SEED', runId })`.
Essa variante não fabrica usuário, não passa pelo channel público e não grava receipt USER;
sua idempotência vem de `generation_key` e o resultado entra no relatório local de boot.

#### Topologia de migrations do booking

A migration base da agenda vem antes de assessment e cria somente booking `INITIAL`.
Portanto, ela não referencia `return_requests` nem `anesthesia_encounters`:

```sql
CREATE TABLE scheduling_bookings (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  requirement_id TEXT NOT NULL,
  need_snapshot JSONB NOT NULL,
  slot_id TEXT NOT NULL REFERENCES scheduling_slots(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN (
    'CONFIRMED','CHECKED_IN','CANCELLED','COMPLETED','NO_SHOW'
  )),
  version INTEGER NOT NULL DEFAULT 1,
  confirmed_at TIMESTAMPTZ,
  confirmed_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  checked_in_at TIMESTAMPTZ,
  checked_in_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  cancellation_reason TEXT,
  completed_at TIMESTAMPTZ,
  no_show_at TIMESTAMPTZ,
  no_show_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  no_show_reason TEXT,
  created_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, case_id),
  FOREIGN KEY (requirement_id, case_id)
    REFERENCES scheduling_requirements(id, case_id) ON DELETE RESTRICT,
  CHECK (jsonb_typeof(need_snapshot) = 'object'),
  CHECK (cancellation_reason IS NULL OR length(trim(cancellation_reason)) BETWEEN 10 AND 500),
  CHECK (no_show_reason IS NULL OR length(trim(no_show_reason)) BETWEEN 10 AND 500),
  CHECK (
    (status = 'CONFIRMED'
      AND confirmed_at IS NOT NULL AND confirmed_by_actor_id IS NOT NULL
      AND checked_in_at IS NULL AND checked_in_by_actor_id IS NULL
      AND cancelled_at IS NULL AND cancelled_by_actor_id IS NULL AND cancellation_reason IS NULL
      AND completed_at IS NULL
      AND no_show_at IS NULL AND no_show_by_actor_id IS NULL AND no_show_reason IS NULL)
    OR (status = 'CHECKED_IN'
      AND confirmed_at IS NOT NULL AND confirmed_by_actor_id IS NOT NULL
      AND checked_in_at IS NOT NULL AND checked_in_by_actor_id IS NOT NULL
      AND cancelled_at IS NULL AND cancelled_by_actor_id IS NULL AND cancellation_reason IS NULL
      AND completed_at IS NULL
      AND no_show_at IS NULL AND no_show_by_actor_id IS NULL AND no_show_reason IS NULL)
    OR (status = 'CANCELLED'
      AND confirmed_at IS NOT NULL AND confirmed_by_actor_id IS NOT NULL
      AND checked_in_at IS NULL AND checked_in_by_actor_id IS NULL
      AND cancelled_at IS NOT NULL AND cancelled_by_actor_id IS NOT NULL AND cancellation_reason IS NOT NULL
      AND completed_at IS NULL
      AND no_show_at IS NULL AND no_show_by_actor_id IS NULL AND no_show_reason IS NULL)
    OR (status = 'COMPLETED'
      AND confirmed_at IS NOT NULL AND confirmed_by_actor_id IS NOT NULL
      AND checked_in_at IS NOT NULL AND checked_in_by_actor_id IS NOT NULL
      AND cancelled_at IS NULL AND cancelled_by_actor_id IS NULL AND cancellation_reason IS NULL
      AND completed_at IS NOT NULL
      AND no_show_at IS NULL AND no_show_by_actor_id IS NULL AND no_show_reason IS NULL)
    OR (status = 'NO_SHOW'
      AND confirmed_at IS NOT NULL AND confirmed_by_actor_id IS NOT NULL
      AND checked_in_at IS NULL AND checked_in_by_actor_id IS NULL
      AND cancelled_at IS NULL AND cancelled_by_actor_id IS NULL AND cancellation_reason IS NULL
      AND completed_at IS NULL
      AND no_show_at IS NOT NULL AND no_show_by_actor_id IS NOT NULL AND no_show_reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX one_active_booking_per_slot
  ON scheduling_bookings(slot_id)
  WHERE status IN ('CONFIRMED','CHECKED_IN','COMPLETED');

CREATE UNIQUE INDEX one_active_booking_per_case
  ON scheduling_bookings(case_id)
  WHERE status IN ('CONFIRMED','CHECKED_IN');

CREATE TABLE scheduling_command_receipts (
  request_id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  input_fingerprint TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(result) = 'object')
);
```

Depois que a migration de assessment criar `return_requests` e
`anesthesia_encounters`, a migration de integração da agenda executa:

```sql
ALTER TABLE scheduling_bookings
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'INITIAL'
    CHECK (kind IN ('INITIAL','RETURN')),
  ALTER COLUMN requirement_id DROP NOT NULL,
  ADD COLUMN return_request_id TEXT,
  ADD COLUMN return_request_version INTEGER,
  ADD COLUMN completed_by_encounter_id TEXT;

ALTER TABLE scheduling_bookings
  ALTER COLUMN kind DROP DEFAULT,
  ADD CONSTRAINT scheduling_booking_return_request_fk
    FOREIGN KEY (return_request_id, case_id)
    REFERENCES return_requests(id, case_id) ON DELETE RESTRICT,
  ADD CONSTRAINT scheduling_booking_completed_encounter_fk
    FOREIGN KEY (completed_by_encounter_id, case_id)
    REFERENCES anesthesia_encounters(id, case_id) ON DELETE RESTRICT,
  ADD CONSTRAINT scheduling_booking_need_exactly_one CHECK (
    (kind = 'INITIAL' AND requirement_id IS NOT NULL
      AND return_request_id IS NULL AND return_request_version IS NULL)
    OR
    (kind = 'RETURN' AND requirement_id IS NULL
      AND return_request_id IS NOT NULL AND return_request_version IS NOT NULL)
  ),
  ADD CONSTRAINT scheduling_booking_completion_pair CHECK (
    (status = 'COMPLETED' AND completed_at IS NOT NULL
      AND completed_by_encounter_id IS NOT NULL)
    OR
    (status <> 'COMPLETED' AND completed_at IS NULL
      AND completed_by_encounter_id IS NULL)
  );

CREATE UNIQUE INDEX one_current_booking_per_return_request
  ON scheduling_bookings(return_request_id)
  WHERE return_request_id IS NOT NULL
    AND status IN ('CONFIRMED','CHECKED_IN','COMPLETED');
```

`return_request_version` é o snapshot de CAS consumido na confirmação; ele não participa da
FK porque `return_requests.version` avança em `BOOKED → CHECKED_IN → CONSUMED`. O
pertencimento é garantido pelo par imutável `(return_request_id, case_id)`; o service compara
a versão esperada antes de cada transição.

Request repetido com mesmo fingerprint devolve `result`. Mesmo `request_id` com fingerprint
diferente retorna `IDEMPOTENCY_KEY_REUSED`.

`return_requests` e `anesthesia_encounters` pertencem ao Build
`avaliacao-pendencias-e-handoff`; sua migration fica entre as duas migrations da agenda.
Agenda consome `returnRequestId`, versão e requisito operacional, salva snapshot imutável
no booking e nunca cria/conclui ReturnRequest ou encounter. `return_requests` não possui
`booking_id`; a navegação inversa sempre consulta `scheduling_bookings.return_request_id`.

#### DTOs discriminados de requirement e booking

```ts
type RequirementEffectiveDTO = {
  slotClass: SlotClass
  durationMinutes: 20 | 35 | 50
  bufferMinutes: 5 | 10
  occupiedMinutes: 25 | 40 | 60
  desiredBy: string
  requiredResourceKinds:
    | ['ANESTHESIA_PROFESSIONAL', 'ROOM']
    | ['ANESTHESIA_PROFESSIONAL', 'ROOM', 'SUPPORT']
  requiredCapabilities: ResourceCapability[]
}

type SchedulingRequirementDTO = {
  id: string
  caseId: string
  caseDisplayId: string
  sourceAnamnesisId: string
  sourceAnamnesisRevision: number
  ruleSet: { id: 'demo-workload'; version: 1 }
  createdAt: string
  version: number
} & (
  | { status: 'CALCULATED'; proposed: RequirementEffectiveDTO; clinicalSignals: RuleSignalDTO[]; publishedAt: null }
  | { status: 'CONFIRMED'; proposed: RequirementEffectiveDTO; effective: RequirementEffectiveDTO; operationalReasons: string[]; publishedAt: string }
  | { status: 'OVERRIDDEN'; proposed: RequirementEffectiveDTO; effective: RequirementEffectiveDTO; operationalReasons: string[]; publishedAt: string; override: { reason: string; actorId: string; at: string } }
)

type SchedulableNeedRef =
  | { kind: 'INITIAL'; requirementId: string; requirementVersion: number }
  | { kind: 'RETURN'; returnRequestId: string; returnRequestVersion: number }

type SchedulingCompatibilityIdentityDTO = {
  caseId: string
  schedulingRequirementId: string
  schedulingRequirementVersion: number
  slotClassId: SlotClass
  durationMinutes: 20 | 35 | 50
  bufferMinutes: 5 | 10
  requiredResourceKinds: ResourceKind[]
  requiredCapabilities: ResourceCapability[]
}

type MarkTriagePendingInput = {
  requestId: string
  caseId: string
  anamnesisId: string
  expectedDraftVersion: number
  expectedCaseVersion: number
  missingFieldPaths: [string, ...string[]]
  reason: string
}

type ResumeTriageInput = {
  requestId: string
  caseId: string
  anamnesisId: string
  expectedDraftVersion: number
  expectedCaseVersion: number
}

type SubmitFinalAnamnesisInput = {
  requestId: string
  caseId: string
  anamnesisId: string
  expectedDraftVersion: number
  expectedCaseVersion: number
}

type ConfirmRequirementInput = {
  requestId: string
  requirementId: string
  expectedRequirementVersion: number
  expectedCaseVersion: number
}
type OverrideRequirementInput = ConfirmRequirementInput & {
  slotClass: SlotClass
  reason: string
}

type ConfirmBookingInput = {
  requestId: string
  caseId: string
  expectedCaseVersion: number
  slotId: string
  expectedSlotVersion: number
  need: SchedulableNeedRef
}

type BookingSlotDTO = {
  slotId: string
  startsAt: string
  consultationEndsAt: string
  endsAt: string
  timezone: 'America/Sao_Paulo'
  slotClass: SlotClass
  durationMinutes: 20 | 35 | 50
  bufferMinutes: 5 | 10
  occupiedMinutes: 25 | 40 | 60
  resources: Array<{ id: string; kind: ResourceKind; label: string }>
}

type BookingDTO = {
  id: string
  caseId: string
  caseDisplayId: string
  source:
    | { kind: 'INITIAL'; requirementId: string }
    | { kind: 'RETURN'; returnRequestId: string; returnRequestVersion: number }
  slot: BookingSlotDTO
  createdAt: string
  version: number
} & (
  | { status: 'CONFIRMED'; confirmedAt: string; confirmedByActorId: string }
  | { status: 'CHECKED_IN'; confirmedAt: string; confirmedByActorId: string; checkedInAt: string; checkedInByActorId: string }
  | { status: 'CANCELLED'; cancelledAt: string; cancelledByActorId: string; cancellationReason: string }
  | { status: 'COMPLETED'; completedAt: string; encounterId: string }
  | { status: 'NO_SHOW'; noShowAt: string; noShowByActorId: string; noShowReason: string }
)
```

`requiredResourceKinds` sempre começa por profissional + sala e acrescenta `SUPPORT` quando
`requiredCapabilities` contém `INTERPRETER`; não há inferência no renderer. O snapshot de
retorno copia o `RequirementEffectiveDTO` inteiro sem recalcular essa relação.

Recepção recebe `SchedulingCompatibilityIdentityDTO`, requirement publicado/need
operacional e `BookingDTO`; nunca recebe
`clinicalSignals`. `occupiedMinutes` e `slot.endsAt` sempre incluem consulta + buffer.
`MarkTriagePendingInput.reason` aceita 10–500 caracteres e
`missingFieldPaths` somente paths conhecidos pelo contrato da anamnese; estado, ator,
papel e timestamps são derivados no main.

#### Views/queries operacionais

`scheduling_available_slots_v1` projeta slot, template, recursos e booking ativo. A query
recebe `SchedulableNeedRef`, intervalo de datas e `includeIncompatible=false`.
Compatibilidade:

1. `INITIAL` aponta requirement `CONFIRMED/OVERRIDDEN`, ou `RETURN` aponta
   `return_requests.status='READY_FOR_BOOKING'` com versão idêntica;
2. slot `base_status=AVAILABLE`;
3. sem booking `CONFIRMED`, `CHECKED_IN` ou `COMPLETED` para o slot e fora de
   block;
4. `slot_class` idêntica;
5. duração do slot >= requerida;
6. todas as capabilities requeridas estão presentes;
7. bundle contém exatamente um `ANESTHESIA_PROFESSIONAL`, um `ROOM` e apoios requeridos;
8. não existe block ativo nem occupancy concorrente;
9. começa no futuro.

Para `INITIAL`, `schedulingRequirementId` é a identidade autoritativa que decide quais
slots podem ser ocupados. `slotClassId` é uma dimensão dessa identidade, não “tipo de
paciente”. Para `RETURN`, a mesma projeção usa o `returnRequestId` equivalente. O renderer
envia somente IDs e versões; o service recarrega todos os atributos.

O resultado da query é discriminado: `{ kind: 'SLOTS'; slots }` ou
`{ kind: 'CAPACITY_SHORTAGE'; requirement, searchedFrom, searchedThrough, nextSearchFrom }`.
`CAPACITY_SHORTAGE` é projeção derivada e não possui tabela, insert, lifecycle ou command de
criação.

#### Commands e resultados

Todos os handlers recebem o `ActorContext` main-only do domínio de acesso, derivado pelo
processo main a partir da sessão; o tipo não é redeclarado neste domínio e papel, ator e
correlation ID nunca vêm do payload do renderer. `Papel` é importado de `src/shared/auth.ts`.
Guards por command são
mais estreitos: submit final, confirmação e override pertencem a `ENFERMAGEM`; o cálculo é
interno ao submit e não possui channel próprio. Leitura da agenda pertence a `RECEPCAO` e
`ANESTESIOLOGISTA`; confirmar, check-in, cancelar, reagendar e no-show pertencem a
`RECEPCAO`; consumo do booking acontece somente dentro de `encounters.start`; recursos,
janelas e bloqueios pertencem a `ADMIN`. `SOLICITANTE` não opera agenda no MVP.

| Channel | Input principal | Resultado |
|---|---|---|
| `clinicalAnamnesis.markPending` | `MarkTriagePendingInput` | `NURSING_IN_PROGRESS → TRIAGE_PENDING`; evento com paths/motivo |
| `clinicalAnamnesis.resume` | `ResumeTriageInput` | `TRIAGE_PENDING → NURSING_IN_PROGRESS` |
| `clinicalAnamnesis.submitFinal` | `SubmitFinalAnamnesisInput` | revisão `FINAL` + requirement `CALCULATED`; mantém `NURSING_IN_PROGRESS` |
| `scheduling.requirements.confirm` | `ConfirmRequirementInput` | requirement publicado + caso `READY_FOR_SCHEDULING` |
| `scheduling.requirements.override` | `OverrideRequirementInput` | override publicado + caso `READY_FOR_SCHEDULING` |
| `scheduling.slots.listCompatible` | `SchedulableNeedRef`, weekStart | `SLOTS | CAPACITY_SHORTAGE` derivado |
| `scheduling.bookings.confirm` | `ConfirmBookingInput` | `BookingDTO`/comprovante |
| `scheduling.bookings.checkIn` | requestId, bookingId, expectedBookingVersion, expectedCaseVersion | booking `CHECKED_IN` |
| `scheduling.bookings.cancel` | requestId, bookingId, reason, expectedBookingVersion, expectedCaseVersion | cancelado |
| `scheduling.bookings.reschedule` | requestId, bookingId, newSlotId, expectedBookingVersion, expectedCaseVersion | troca atômica |
| `scheduling.bookings.markNoShow` | requestId, bookingId, reason, expectedBookingVersion, expectedCaseVersion | no-show |
| `scheduling.consumeCheckedInOnEncounterStart` | internal tx, bookingId, encounterId | booking `COMPLETED`; chamado por `encounters.start`, sem channel renderer |

Erros tipados:

```ts
type SchedulingErrorCode =
  | 'TRIAGE_MISSING_FIELDS_REQUIRED'
  | 'TRIAGE_NOT_PENDING'
  | 'REQUIREMENT_NOT_CONFIRMED'
  | 'SLOT_NOT_FOUND'
  | 'SLOT_INCOMPATIBLE'
  | 'SLOT_TAKEN'
  | 'RESOURCE_TIME_CONFLICT'
  | 'RESOURCE_HAS_ACTIVE_BOOKING'
  | 'BLOCK_CONFLICTS_WITH_BOOKING'
  | 'RETURN_REQUEST_NOT_OPEN'
  | 'CHECK_IN_WINDOW_INVALID'
  | 'NO_SHOW_TOO_EARLY'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'FORBIDDEN'
```

`SLOT_TAKEN` retorna até cinco slots alternativos compatíveis; nunca confirma alternativa.

#### Transações

Pausa e retomada por dado incompleto:

1. `markPending` exige `ENFERMAGEM`, caso `NURSING_IN_PROGRESS`, draft/versões atuais,
   paths não vazios e motivo válido;
2. grava evento sanitizado e move somente o caso para `TRIAGE_PENDING`;
3. `resume` exige o mesmo draft e caso `TRIAGE_PENDING`, grava evento e volta a
   `NURSING_IN_PROGRESS`;
4. nenhum dos dois cria revisão, execução de regra ou requirement.

Submit final + calculate, sem passo duplicado:

1. procurar receipt e carregar draft/caso pela expected version;
2. validar completude e executar motor sobre o candidato imutável;
3. se `INCOMPLETE`, `HUMAN_DEFINITION_REQUIRED` ou `OUT_OF_DEMO_RANGE`, abortar sem
   revision `FINAL`, requirement ou evento e manter `NURSING_IN_PROGRESS`;
4. se `CALCULATED`, inserir revision `FINAL`, rule execution e requirement `CALCULATED`;
5. manter `NURSING_IN_PROGRESS` e gravar eventos/auditoria/receipt;
6. commit único.

`confirm` ou `override` depois valida requirement `CALCULATED`, publica a projeção e move
`NURSING_IN_PROGRESS → READY_FOR_SCHEDULING` em um commit. Não existe handler
`scheduling.requirements.calculate`, “persistir cálculo” posterior nem confirmação extra do
override. Requirement publicado e revisão `FINAL` são imutáveis; não há reclassificação
pós-publicação no MVP.

Confirm booking:

1. procurar receipt;
2. resolver `SchedulableNeedRef`: requirement publicado para `INITIAL` ou ReturnRequest
   `READY_FOR_BOOKING`/versionado para `RETURN`, e carregar o slot;
3. revalidar classe, duração, capabilities, block e tempo;
4. inserir booking `CONFIRMED`;
5. para `INITIAL`, exigir `READY_FOR_SCHEDULING` e atualizar para `SCHEDULED`; para
   `RETURN`, exigir/manter `WAITING_RETURN` e mudar o request para `BOOKED`;
6. gravar `case_events`, `auditoria_eventos` sanitizado e receipt;
7. commit.

O índice parcial decide a corrida. Violação única vira `SLOT_TAKEN`, não erro genérico.

Reagendamento:

1. validar booking atual e novo slot;
2. marcar antigo `CANCELLED`;
3. inserir novo `CONFIRMED` ligado por metadata de auditoria;
4. gravar receipt;
5. commit.

Qualquer falha reverte tudo.

Check-in exige `RECEPCAO`, booking `CONFIRMED` e relógio do main dentro de
`[startsAt - 30 min, consultationEndsAt]`. Ele grava `CHECKED_IN`; em `INITIAL`, move
`SCHEDULED → WAITING_ANESTHESIA`, e em `RETURN` move
`WAITING_RETURN → WAITING_ANESTHESIA` e o request para `CHECKED_IN`.

`encounters.start` exige booking `CHECKED_IN`, cria o encontro e, na mesma transação,
executa `scheduling.consumeCheckedInOnEncounterStart`: grava `COMPLETED`,
`completed_at=now`, `completed_by_encounter_id=encounterId` e move o caso para
`IN_ASSESSMENT`; em `RETURN`, assessment também muda o request para `CONSUMED`. A operação
não remove `scheduling_resource_occupancies`; o bundle
continua fisicamente ocupado até `slot.ends_at`, mesmo que o booking já esteja
`COMPLETED`. Não há command de UI para completar booking.

`markNoShow` exige `RECEPCAO`, booking `CONFIRMED`, `now >= consultationEndsAt` e motivo de
10–500. `INITIAL` volta a `READY_FOR_SCHEDULING`; `RETURN` permanece `WAITING_RETURN`.
`CHECKED_IN` nunca vira `NO_SHOW`.

Cancelamento de booking `INITIAL` preserva o caso e muda
`SCHEDULED → READY_FOR_SCHEDULING`; cancelamento `RETURN` mantém `WAITING_RETURN` e a mesma
ReturnRequest em `READY_FOR_BOOKING`. `CHECKED_IN` não pode ser cancelado pela agenda.
No-show `RETURN` aplica a mesma reabertura. Reagendamento mantém
o estado do caso e incrementa sua versão. Cancelar o caso inteiro é outro command: o domínio
do caso chama `scheduling.cancelForCase(tx, caseId, reason)` e grava `CANCELLED` no mesmo
commit. Cancelar vaga nunca cancela caso implicitamente.

#### Imutabilidade depois da publicação

Depois de `confirm` ou `override`, o requirement e sua revisão `FINAL` não aceitam update,
supersede nem nova submissão no MVP. Agenda pode cancelar ou reagendar booking pelos
commands próprios, mas não reclassifica o caso nem o devolve à enfermagem.

### Frontend

> **DEMO_DECISION — 14/08/2026: a superfície de agenda deixou de usar FullCalendar.**
>
> O que esta seção descreve (FullCalendar month/week/day, toolbar portada, DnD/resize)
> foi construído e recusado pelo dono do produto: com três consultórios oferecendo vaga
> no mesmo horário, o swimlane empilha títulos ilegíveis e a informação que a recepção
> precisa — *quantas vagas de cada tamanho sobraram* — não aparece em lugar nenhum.
>
> No lugar entraram três peças:
>
> 1. **Grade semanal de densidade** (`paginas/agenda/GradeSemanal.tsx`): dias em coluna,
>    faixas de hora em linha, barras proporcionais por classe e a contagem de livres. A
>    grade cresce com o expediente.
> 2. **Dia empilhado** (`DiaEmpilhado.tsx`): as salas do mesmo horário viram linhas
>    seguidas numa coluna só, com chegada, ausência e link para o caso.
> 3. **Modal de horários** (`ModalAgendar.tsx`): marcar é escolher entre as próximas
>    vagas compatíveis, não navegar um calendário. O caminho inverso — quem cabe nesta
>    vaga — usa a mesma peça.
>
> A capacidade também mudou de modelo: `scheduling_availability` guarda a regra semanal
> por consultório (dias, expediente, pausas) e as vagas eram **materializadas** dela até
> um horizonte de 8 semanas. Esse segundo passo caiu no mesmo dia — ver a decisão
> abaixo. O DnD de reserva saiu junto com o calendário; remarcar é comando explícito.
>
> O que esta seção mantém válido: a projeção por intervalo, o DTO de agenda sem campo
> clínico, os estados UX e a regra de que nenhuma validação vive no renderer.

> **DEMO_DECISION — 14/08/2026: a vaga pré-criada deixou de existir.**
>
> `scheduling_slots` foi removida, junto com `materializar`/`gerarVagas`. O que sobrou é
> mais simples e mais honesto: `scheduling_availability` (expediente semanal),
> `scheduling_blocks` (recusa pontual com motivo e autoria) e `scheduling_bookings`
> (o compromisso, com `buffer_minutes` próprio). **Livre é conta, não linha**:
> expediente − pausas − bloqueios − consultas-com-buffer, calculado em
> `availability-service.diaDaSala()`.
>
> Por que: horário fixo desperdiça o dia. A vaga de 50 min que ninguém usou não virava
> duas de 20, e a sala ficava vazia com gente esperando. Pior, a materialização era uma
> segunda fonte de verdade que precisava ser reconciliada a cada mudança de regra — e
> qualquer bug ali deixava a agenda mentindo.
>
> O contrapeso é a **cota**: `scheduling_resources.cotas` guarda a porcentagem do
> expediente reservada a cada classe (soma exatamente 100). Sem ela, uma fila de casos
> curtos comeria o dia e o caso longo nunca acharia lugar. Zero por cento significa "esta
> sala não atende esta classe" — e a recusa aparece como ausência de encaixe, não como
> erro depois do clique. `encaixesNoDia()` só oferece horário que cabe **e** tem cota.
>
> Concorrência: sem `btree_gist` no PGlite não existe `EXCLUDE (resource WITH =, faixa
> WITH &&)`. A barreira é `pg_advisory_xact_lock(hashtext('sala:AAAA-MM-DD'))` mais a
> verificação dentro da mesma transação, em `agenda-service.reservar/moverReserva`. Duas
> marcações simultâneas na mesma sala se enfileiram; a segunda lê o que a primeira
> gravou e é recusada com `SLOT_TAKEN`.
>
> Superfície: a barra de cotas do modal de Disponibilidade responde "40% grave / 60%
> rápido" arrastando a divisória — três campos separados deixariam somar 90 ou 130. As
> pausas passaram a nascer de um popover no próprio bloco de expediente (padrão DietFlow),
> não de um botão `+` fora da barra.

#### Rotas e superfícies

- `/agenda` — FullCalendar com Agenda, Programação e Para agendar.
- `/casos/:caseId/agendamento` — abre a mesma seleção/drawer focada no requisito.
- `/configuracoes/agenda` — recursos, janelas datadas e bloqueios.

#### Dependências FullCalendar

Todas permanecem no mesmo major v6:

```text
@fullcalendar/core
@fullcalendar/react
@fullcalendar/daygrid
@fullcalendar/timegrid
@fullcalendar/interaction
@fullcalendar/list
@fullcalendar/rrule
rrule
```

#### `AgendaPagina`

```text
AgendaHeaderBar
  mode: Agenda | Programação | Para agendar
  view: Mês | Semana | Dia
  previous | Hoje | next
  busca
  filtros: tipo | status | classe | recurso
  Novo: Reserva | Bloqueio | Janela extra
  Mais: Configurações | Imprimir/Exportar | Fins de semana | Horário expandido
RequirementContextBar
  caso | requirementId | classe | duração | desiredBy | capabilities
AgendaCalendar
  FullCalendar dayGridMonth | timeGridWeek | timeGridDay
AgendaProgramacao
  lista/tabela acessível sobre a mesma projeção
AgendaParaAgendar
  worklist de SchedulingCompatibilityIdentityDTO sem booking ativo
UnifiedAgendaDrawer
  Reserva | Bloqueio | Janela extra
```

Configuração base:

```ts
const calendarContract = {
  headerToolbar: false,
  slotDuration: '00:15:00',
  snapDuration: '00:15:00',
  eventMinHeight: 15,
  slotEventOverlap: false,
  dayMaxEvents: 3,
  eventDisplay: 'block',
  navLinks: true,
  editable: true,
} as const
```

`eventDrop` e `eventResize` chamam `scheduling.bookings.rebook`. O service valida requisito,
slot, versão, recursos, classe, ocupação e conflito. Se falhar, o callback executa
`revert()` e abre feedback acionável. Resize que tentaria mudar a duração publicada é
rejeitado; a duração pertence ao requirement, não ao pixel.

Cor é secundária. Cada evento escreve Rápida/Normal/Estendida, duração e estado. A altura é
proporcional; CSS não força mínimo visual acima de 20 px. Eventos de janela/bloqueio usam
background rendering e não se confundem com booking.

#### Portabilidade DietFlow: portar, adaptar e excluir

| Contrato do DietFlow | Antessala |
|---|---|
| FullCalendar month/week/day + range windowed | `PORT` |
| toolbar customizada, dropdowns, busca e filtros | `PORT` com labels do Antessala |
| business hours, background events e bloqueios | `PORT` |
| DnD/resize com confirmação e revert | `PORT` com validação de requirement |
| UnifiedAgendaDrawer e dirty guard | `PORT` para reserva, bloqueio e janela extra |
| preferências de visão persistidas | `PORT` para a conta integrada; não usar localStorage como fonte |
| renderização compacta por duração e tokens de tema | `PORT` |
| Atendimento | `ADAPT` para `SchedulingBooking` |
| Patient/planoAtendimentoId | `ADAPT` para caso autônomo + `schedulingRequirementId` |
| profissional/local | `ADAPT` para bundle de recursos/capabilities |
| EXPANDE/BLOQUEIA agenda | `ADAPT` para janela extra/bloqueio de capacidade |
| Planejamento longitudinal e cadência | `EXCLUDE` |
| tarefas, WhatsApp, financeiro e histórico clínico | `EXCLUDE` |
| qualquer `patientId` ou evolução | `EXCLUDE` |

“Trazer toda a regra do DietFlow” significa executar esta matriz, não copiar entidades
nutricionais que violam o Antessala.

#### Estados UX

| Estado | Tratamento |
|---|---|
| requirement pending | CTA volta à enfermagem; agenda bloqueada |
| loading | skeleton de toolbar/grid/lista |
| available | cards e lista sincronizados |
| range-loading | estrutura visível; mutação bloqueada até a projeção completa |
| no compatible slot | filtros aplicados, período consultado, próxima semana e shortage |
| selected | drawer resume requisito e slot |
| confirming | botão desabilitado e requestId estável |
| confirmed | comprovante com data, hora, duração e recurso |
| checked-in | chegada registrada; cancelamento/no-show indisponíveis |
| completed | encontro vinculado concluído; somente leitura |
| slot taken | banner, slot removido e alternativas destacadas |
| version conflict | recarrega requisito antes de nova seleção |
| rebook required | alerta persistente e antigo compromisso visível |
| cancelled | motivo e ação de escolher nova vaga |
| no-show | estado terminal daquele booking; nova reserva explícita |
| error | retry seguro com mesmo requestId quando apropriado |
| drag/resize pending | evento provisório; nova interação bloqueada até resposta |
| drag/resize rejected | `revert()` obrigatório, reserva original preservada |
| drawer dirty | fechar/trocar item pede confirmação; nada é descartado em silêncio |

#### DTO do renderer

```ts
type SlotCardDTO = {
  id: string
  startsAt: string
  consultationEndsAt: string
  endsAt: string
  timezone: 'America/Sao_Paulo'
  slotClass: SlotClass
  durationMinutes: 20 | 35 | 50
  bufferMinutes: 5 | 10
  occupiedMinutes: 25 | 40 | 60
  resourceLabels: string[]
  resourceKinds: ResourceKind[]
  capabilities: ResourceCapability[]
  compatible: boolean
  incompatibilityReasons: string[]
  version: number
}
```

Nenhum campo clínico participa do DTO.

`AgendaCalendar`, `AgendaProgramacao` e `AgendaParaAgendar` consomem o mesmo
`SchedulingEventDTO[]`. O fallback acessível não mantém fetch, filtros ou regra paralelos.

### Validation

#### Motor puro

- 20 minutos sem sinais → QUICK.
- um domínio positivo explícito → STANDARD de 25 ajustado ao template de 35.
- soma 40–50 → EXTENDED; soma acima de 50 → OUT_OF_DEMO_RANGE sem truncar.
- cinco medicações e três diagnósticos aplicam incrementos uma vez.
- accommodations adicionam 10 minutos e capability.
- documento pendente é explicado, mas soma zero.
- `ANSWERED(false)`, `UNKNOWN`, `REFUSED` e `NOT_PERFORMED` não pontuam.
- NOT_ASKED obrigatório → INCOMPLETE.
- snapshot da tabela de `signalCode + fieldPaths + predicate + incremento/capability` é
  literal; campo novo não entra por varredura.
- mesma entrada/now → mesmo fingerprint/output.
- paths clínicos aparecem apenas na explicação clínica.

#### Banco/concorrência

- submit final e calculate gravam tudo ou nada; não existe requirement órfão nem cálculo duplicado.
- janelas datadas materializam somente a interseção dos próximos 30 dias, sem recorrência.
- `consultationEndsAt` exclui buffer e `endsAt` inclui consulta + buffer.
- segunda materialização devolve as mesmas contagens sem duplicar.
- dois lotes concorrentes tentando sobrepor o mesmo recurso: um vence e outro recebe
  `RESOURCE_TIME_CONFLICT`; nenhum slot parcial sobra.
- block impede slot livre e não altera booking confirmado.
- duas promises/clients confirmando mesmo slot: uma `CONFIRMED`, outra `SLOT_TAKEN`.
- dois slots para o mesmo caso: uma confirmação ativa.
- requestId repetido devolve mesmo booking.
- requestId reutilizado com input diferente falha.
- reagendamento falho preserva booking antigo.
- reagendamento verde troca slots em uma transação.
- `markPending` só aceita missing paths conhecidos e `resume` restaura
  `NURSING_IN_PROGRESS`.
- submit verde mantém `NURSING_IN_PROGRESS`; confirm/override é a única transição para
  `READY_FOR_SCHEDULING`.
- `RETURN` confirmado mantém `WAITING_RETURN`; check-in muda para
  `WAITING_ANESTHESIA`.
- `encounters.start` cria encontro, marca booking `COMPLETED`, move caso a
  `IN_ASSESSMENT` e preserva occupancy até `slot.ends_at`.
- requirement publicado rejeita nova submissão/reclassificação.
- admin create/replace/retire resource/window/block valida DTO, idempotência e
  rematerialização afetada.

#### RBAC/privacidade

- recepção não acessa `clinical_explanation`.
- recepção não calcula, confirma regra ou faz override.
- enfermagem não materializa slots nem altera capacidade.
- somente recepção confirma/cancela/reagenda.
- somente recepção faz check-in/no-show; no-show antes de `consultationEndsAt` falha.
- somente `encounters.start`, com capability clínica válida, transforma
  `CHECKED_IN → COMPLETED`.
- booking `RETURN` exige ReturnRequest aberto do domínio de avaliação.
- logs e receipts não contêm anamnese.

#### Renderer/E2E

- mês, semana, dia, Programação e Para agendar usam a mesma projeção e filtros.
- navegação de intervalo respeita timezone e não faz fetch sem limite.
- dropdowns de modo, visão, Novo e Mais preservam teclado, foco e estado.
- business hours, janela extra e bloqueio aparecem como background events.
- drop compatível confirma nova reserva; drop incompatível chama `revert()`.
- resize nunca altera a duração do requirement por pixel.
- evento de 20 minutos permanece visualmente menor que um de 50 minutos.
- preferências persistem para a conta integrada; mudança forçada não sobrescreve escolha.
- seleção incompatível não tem ação de reserva.
- conflito simultâneo remove slot e preserva dados do caso.
- fluxo incompleto: `markPending` → `TRIAGE_PENDING` → `resume` →
  `NURSING_IN_PROGRESS`, sem revision/requirement intermediário.
- fluxo completo: finalizar anamnese → confirmar requirement → reservar → comprovante.
- fluxo sem vaga: shortage sem encaixe inválido.
- shortage é projeção derivada; consulta posterior pode voltar a `SLOTS` sem atualizar entidade.
- fluxo RETURN: confirmar mantém `WAITING_RETURN`; check-in produz
  `WAITING_ANESTHESIA`; start produz `COMPLETED + IN_ASSESSMENT` sem liberar occupancy.
- fluxos INITIAL e RETURN cobrem no-show e nova reserva.

### Operations

- `America/Sao_Paulo` é a timezone fixa da demo; DB armazena timestamptz.
- Materialização idempotente roda no boot e após command admin, sempre limitada aos próximos
  30 dias de janelas datadas existentes; não inventa recorrência quando elas terminam.
- Nenhum cron de rede ou integração externa.
- Regra/template/resource seed usam checksum e revisão.
- Métricas permitidas: quantidade por classe, tempo até slot, shortages, conflitos e
  rebookings; nunca “risco evitado” ou “aptidão”.
- Reset da demo remove somente dados de caso/agenda e rematerializa fixtures.

## Sequence

1. Fixar DTOs e motor puro com oráculos.
2. Migration base da agenda cria regra, requisito, recurso, capacidade, slot, booking
   somente `INITIAL` e receipt.
3. Migration de assessment cria `return_requests` e `anesthesia_encounters`.
4. Migration de integração da agenda adiciona `kind`, `return_request_id`,
   `return_request_version`, `completed_by_encounter_id`, FKs e índices cruzados.
5. Seedar rule set, templates, recursos e janelas datadas; implementar commands admin e
   materializar slots/occupancies.
6. Implementar pausa/resume, requirement service e projeção segura por papel.
7. Implementar booking service atômico/idempotente.
8. Expor router TIPC validado.
9. Portar FullCalendar, toolbar/dropdowns, renderers, preferências e drawer unificado.
10. Integrar retorno, check-in, start, reagendamento, cancelamento e no-show.
11. Executar provas de regra, concorrência, RBAC e ponta a ponta.

A sequência é topológica, não um Plan executável.

## Rollback / Containment

- Todas as tabelas são expansão e usam prefixo `scheduling_`.
- O motor legado permanece importável apenas por testes históricos; nenhuma nova rota o usa.
- Feature flag local esconde `/agenda` e handlers de UI até a minispec ser aprovada.
- Remover o spread de `schedulingRouter` desativa agenda sem afetar caso/anamnese.
- Slots e fixtures sintéticas podem ser descartados e rematerializados; revisions e audit não.
- Falha de seed/migration reverte antes da abertura da janela.
- Se booking novo apresentar falha, esconder ação de mutação e manter consulta read-only; não
  apagar comprovantes existentes.

## Risks

| Risk | Containment |
|---|---|
| Tempo/capacidade parecem política real | `source=DEMO`, copy visível e versão nomeada |
| Constraint parcial não cobrir transição | testes de todos os status e transações curtas |
| Booking e slot duplicarem estado | `base_status` + projeção derivada de booking |
| Recepção inferir clínica por explicação | operational explanation curada sem paths/fatos |
| Ocupação ser liberada no start | booking completa, mas occupancy persiste até `slot.ends_at` |
| Edição pós-publicação regressar estado | requirement/revisão imutáveis na PoC; resultado clínico versiona correção separadamente |
| FullCalendar virar segunda fonte de verdade | range query única, actions no main e revert obrigatório |
| Copiar domínio nutricional do DietFlow | matriz PORT/ADAPT/EXCLUDE e teste sem patientId |

## Definition of Complete for Build

- [x] Produto, backend, frontend, validação e operações estão descritos como proposta.
- [x] Regra v1 fechada e rotulada como `DEMO_DECISION`, sem confundir demo com evidência.
- [ ] DTOs, tabelas, constraints, concorrência e rollback provados no PGlite.
- [ ] Janelas, capacidade, recursos e bookings validados como `DEMO_DECISION`.
- [ ] Topologia agenda base → assessment → integração provada no PGlite.
- [ ] FullCalendar mês/semana/dia, Programação e Para agendar confirmados por prova visual.
- [x] Matriz DietFlow PORT/ADAPT/EXCLUDE fechada.
- [ ] Review final de congruência verificar este Build canônico e suas dependências.
- [ ] Review final do pacote completo antes do Warlog.

---

## Estado de consolidação

- Estado: `CANONICAL_DOMAIN_BUILD`.
- Autoridade canônica: este arquivo.
- Gate individual: inexistente.
- Uso futuro: fonte obrigatória do Warlog e dos Writing Plans de requisito e agenda.
