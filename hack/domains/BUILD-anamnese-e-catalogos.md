# Build — Anamnese pré-anestésica e catálogos

## Estado documental

- Papel: `REFERENCE_APPENDIX`.
- Consumido por: `hack/BUILD.md`.
- Gate ou assinatura individual: inexistente.
- Estados antigos de bloqueio foram absorvidos pela reconciliação integrada.
- Em conflito, `hack/BUILD.md` prevalece e este anexo deve ser corrigido.

## Goal

Substituir o registro clínico legado por um caso autônomo com encaminhamento, anamnese
pré-anestésica versionada e catálogos offline. Entregar à enfermagem um formulário fixo de
14 widgets, ao anestesiologista um snapshot com proveniência e à recepção somente a
consequência operacional. Não criar paciente mestre, histórico longitudinal ou decisão
clínica automática.

## Current Terrain

- O PGlite singleton e o boot local já existem em `src/main/db/pglite.ts:8-48` e
  `src/main/index.ts:154-169`.
- O schema clínico chama `registros` e `registro_jornada` de legado em
  `src/main/db/clinical-schema.ts:3-9`.
- A coluna JSONB aceita `{_v:2, blocos}` em `src/main/db/clinical-schema.ts:11-25`.
- O registry e o parser versionado já existem em `src/shared/anamnese/registry.ts:20-40` e
  `src/shared/anamnese/serialization.ts:78-155`.
- Os catálogos são embarcados e selados por hash em `src/main/db/seed.ts:63-150`.
- Apenas CID e medicamento têm DTO/query pública em `src/main/tipc.ts:338-370`.
- O composer shadcn já aceita registry, catálogo e modo disabled em
  `src/renderer/src/anamnese/Composer.tsx:35-65`.
- O export nativo do Electron existe em `src/main/export/pdf.ts:38-91`.

## Recommended Path

Aplicar uma expansão isolada: novas tabelas canônicas e novos handlers convivem com o
legado, sem reinterpretar seus dados. Reutilizar a infraestrutura de registry/serialization,
mas criar tipos v3 e definitions pré-anestésicas em namespace próprio. Persistir rascunho
mutável com versão otimista; `submitFinal` cria a única revisão imutável, marca o agregado
`COMPLETE` e grava o requisito `CALCULATED` no mesmo commit. Catálogos permanecem seed-first
e read-only no MVP. A UI usa um template fixo; não haverá montador de formulário nem
cadastro de paciente. Procedimento e serviço são compostos a partir do caso em leitura; o
conteúdo clínico guarda apenas indicação, data, lateralidade e notas, ancorado por versão e
fingerprint para detectar correção pré-final do caso.

## Files / Areas

| Path/Area | Action | Reason | Risk |
|---|---|---|---|
| `src/shared/anamnese/types.ts` | expand | Resposta semântica, provenance e envelope v3 | high |
| `src/shared/anamnese/serialization.ts` | expand | Validar invariantes cruzados e completude | high |
| `src/shared/anamnese/pre-anesthesia/` | new | 14 DTOs/definitions sem contaminar legado | medium |
| `src/shared/anamnese/registry.ts` | adapt | Registry canônico exaustivo | medium |
| `src/shared/anamnese/templates.ts` | replace active catalog | Ativar somente template MVP | medium |
| `src/shared/catalogos-clinicos.ts` | expand | DTOs de procedimentos, serviços, MET e comorbidades | medium |
| `src/main/db/migrations/00x_master_data.sql` | new | Serviços/procedimentos antes da migration de acesso | high |
| `src/main/db/migrations/00x_anamnese.sql` | new | Anamnese, único FINAL e receipts depois da migration de caso | high |
| `src/main/db/clinical-schema.ts` | stop expanding | Compatibilidade legada; novo DDL vai à migration | high |
| `src/main/db/seed.ts` | expand | Seeds versionados de procedimento/serviço | medium |
| `src/main/catalogos/dto.ts` | expand | Rows nunca vazam para renderer | medium |
| `src/main/cases/` | consume | Caso/encaminhamento pertencem ao Build próprio | high |
| `src/main/clinical/anamnesis.ts` | new | Save, rebase pré-final e submit transacional | high |
| `src/main/tipc.ts` | wire thin handlers | Separar router de domínio de SQL | medium |
| `src/renderer/src/paginas/TriagemPagina.tsx` | new | Superfície da enfermagem | medium |
| `src/renderer/src/anamnese/widgets/` | add 14 editors | Captura shadcn | medium |
| `src/renderer/src/anamnese/Composer.tsx` | constrain | Template fixo, sem delete/reorder obrigatório | medium |
| `src/main/export/pdf.ts` | preserve engine | Renderizar DTO já sanitizado | low |
| `tests/shared/anamnese/` | expand | Prova de DTO/semântica/migração | low |
| `tests/main/db/` | expand | Constraints, FINAL terminal e boot offline | medium |
| `tests/renderer/anamnese/` | expand | Estados e teclado | low |

## Contracts

### Product

- Um encaminhamento cria um caso; nunca procura pessoa existente.
- Identificação é snapshot local do caso: `fullName`, `birthDate` ou idade na abertura,
  `sexReported` e `originIdentifier` opcional. Este domínio não acrescenta
  `planoOuOrigem` nem outro campo de pessoa.
- Enfermagem edita somente `DRAFT` e cria a única revisão `FINAL` por `submitFinal`.
- Anestesiologista lê o snapshot final; nenhum papel o edita, reabre ou revisa no MVP.
- Recepção nunca recebe conteúdo dos widgets.
- O template do MVP é fixo e contém exatamente os 14 widgets do Analyst.
- Toda tela mostra que os dados são sintéticos e a ferramenta não decide aptidão.

### Backend

#### Infraestrutura de migration

Este Build não cria nem altera ledger, manifesto, runner ou `schema_migrations`. Ele entrega
duas migrations de domínio numeradas para `src/main/db/migrations/`: a primeira cria somente
`catalogo_procedimentos` e `catalogo_servicos_solicitantes` antes de `usuarios`; a segunda,
depois de `preop_cases`, cria anamnese, revisão FINAL e receipts. Ambas são consumidas pelo
manifesto/runner do Build de arquitetura. ID, checksum, ordem, lock, transação e falha de
boot pertencem exclusivamente à arquitetura offline. `CREATE TABLE IF NOT EXISTS` deixa de
ser o mecanismo de evolução clínica.

#### Dependência canônica de caso e tabelas próprias

Este domínio **não cria caso, encaminhamento ou auditoria paralelos**. Ele consome
`preop_cases`, `case_events` e `auditoria_eventos`, definidos respectivamente pelos Builds
de caso/encaminhamento e acesso/auditoria. O vínculo abaixo é com o caso descartável, não
com paciente. `preop_cases` guarda os snapshots de pessoa, encaminhamento, procedimento e
solicitante; portanto não há `clinical_referrals` nem duplicação desses JSONs.

```sql
CREATE TABLE clinical_anamneses (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE REFERENCES preop_cases(id) ON DELETE RESTRICT,
  template_id TEXT NOT NULL CHECK (template_id = 'pre_anesthesia_mvp'),
  template_version INTEGER NOT NULL CHECK (template_version = 1),
  status TEXT NOT NULL CHECK (status IN ('DRAFT','COMPLETE')),
  draft_content JSONB,
  draft_version INTEGER NOT NULL DEFAULT 0 CHECK (draft_version >= 0),
  final_revision INTEGER CHECK (final_revision = 1),
  case_context_version INTEGER NOT NULL CHECK (case_context_version > 0),
  case_context_fingerprint TEXT NOT NULL,
  context_state TEXT NOT NULL DEFAULT 'VALID' CHECK (context_state IN ('VALID','STALE')),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (status = 'DRAFT' AND draft_content IS NOT NULL
      AND final_revision IS NULL AND completed_at IS NULL)
    OR
    (status = 'COMPLETE' AND draft_content IS NULL
      AND final_revision = 1 AND completed_at IS NOT NULL)
  ),
  CHECK (context_state = 'VALID' OR status = 'DRAFT'),
  UNIQUE (id, case_id)
);

CREATE TABLE clinical_anamnesis_revisions (
  id BIGSERIAL PRIMARY KEY,
  anamnesis_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision = 1),
  status TEXT NOT NULL DEFAULT 'FINAL' CHECK (status = 'FINAL'),
  content JSONB NOT NULL,
  case_context_version INTEGER NOT NULL CHECK (case_context_version > 0),
  case_context_fingerprint TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason = 'INITIAL_NURSING_INTERVIEW'),
  created_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_by_role TEXT NOT NULL CHECK (created_by_role = 'ENFERMAGEM'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, case_id),
  UNIQUE (anamnesis_id),
  UNIQUE (anamnesis_id, revision),
  UNIQUE (anamnesis_id, revision, case_id),
  FOREIGN KEY (anamnesis_id, case_id)
    REFERENCES clinical_anamneses(id, case_id) ON DELETE RESTRICT
);

ALTER TABLE clinical_anamneses
  ADD CONSTRAINT clinical_anamneses_final_revision_fk
  FOREIGN KEY (id, final_revision)
  REFERENCES clinical_anamnesis_revisions(anamnesis_id, revision)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE clinical_anamnesis_command_receipts (
  request_id TEXT PRIMARY KEY,
  command TEXT NOT NULL CHECK (command IN ('SUBMIT_FINAL','REBASE_CONTEXT')),
  actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  input_fingerprint TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE FUNCTION reject_final_anamnesis_revision_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'clinical anamnesis FINAL is immutable';
END;
$$;

CREATE TRIGGER clinical_anamnesis_revision_is_immutable
BEFORE UPDATE OR DELETE ON clinical_anamnesis_revisions
FOR EACH ROW EXECUTE FUNCTION reject_final_anamnesis_revision_mutation();

CREATE FUNCTION reject_complete_anamnesis_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'COMPLETE' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'clinical anamnesis COMPLETE is terminal';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clinical_anamnesis_complete_is_terminal
BEFORE UPDATE ON clinical_anamneses
FOR EACH ROW EXECUTE FUNCTION reject_complete_anamnesis_mutation();
```

O par `(anamnesis_id, case_id)` torna impossível anexar uma revisão a anamnese de outro
caso. A migration de classificação referencia `(anamnesis_id, revision, case_id)` para que
o requisito também carregue a mesma prova relacional; validação de service não substitui a
FK composta.

Não existe coluna `patient_id`, tabela `patients` ou índice de deduplicação. Eventos de
transição vão a `case_events`; autoria/auditoria transversal vai a `auditoria_eventos` pelo
helper transacional do domínio de acesso. Nenhuma dessas tabelas recebe o JSON clínico
integral como metadata.

`case_context_fingerprint` é SHA-256 da serialização canônica de
`{procedureSnapshot, requesterSnapshot}`. `case_context_version` registra a versão global do
caso usada como CAS/auditoria, mas mudança de status ou owner sem alteração desses snapshots
não invalida a anamnese. A anamnese não duplica os snapshots
em `draft_content` ou `content`: guarda somente versão/fingerprint. A leitura compõe a
projeção read-only diretamente de `preop_cases`. Eventos append-only de correção do caso
preservam a reconstrução histórica enquanto o agregado estiver `DRAFT`. `draft_version` e
`revision=1` são versionamento técnico de concorrência e proveniência; não representam
evolução clínica. A constraint `UNIQUE (anamnesis_id)` torna fisicamente impossível criar
uma segunda revisão final.

#### Catálogos novos

```sql
CREATE TABLE catalogo_procedimentos (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  question_set_id TEXT NOT NULL DEFAULT 'pre_anesthesia_mvp',
  question_set_version INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL,
  revision TEXT NOT NULL
);

CREATE TABLE catalogo_servicos_solicitantes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  especialidade TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL,
  revision TEXT NOT NULL
);
```

Seed mínimo da demo:

- procedimento `ENDOSCOPIA_DIGESTIVA_ALTA`, nome “Endoscopia digestiva alta”;
- procedimento `OUTRO`, nome preservado pelo operador;
- serviço `GASTROENTEROLOGIA_DEMO`;
- todos marcados `source=DEMO`, nunca apresentados como cadastro do HC.

Os catálogos CID, medicamentos, MET e comorbidades continuam nas tabelas atuais. O Build
adiciona `source_revision` ao DTO e mantém o hash global de seed. Nenhum handler cria, edita
ou remove catálogo no MVP.

#### Envelope e validação

O código usa os tipos definidos no Analyst. Zod aplica as seguintes refinements:

1. `ANSWERED` exige `value`; os demais estados proíbem `value`.
2. `NOT_ASKED` exige `provenance=null`; todo estado tratado exige provenance confiável.
3. `NEGATIVE` só é aceito por campo que declara negação; booleano recusa
   `ANSWERED false`.
4. condição positiva exige item/detalhe condicionado.
5. `COMPLETE` proíbe `NOT_ASKED` obrigatório.
6. os 14 `widgetType` aparecem exatamente uma vez e na ordem do template.
7. toda provenance tratada usa timestamp ISO, actor e papel permitido.
8. `content._v=3`, `template.version=1` e `schemaVersion=1` são literais.
9. limites de texto, listas, datas e números seguem integralmente a matriz do Analyst.
10. procedimento/serviço são proibidos dentro de `procedure_context.data`.
11. todo item ativo possui `itemProvenance`; toda operação de lista possui receipt sequencial
    em `listMutationLog`, inclusive remoção.
12. `NOT_APPLICABLE` e completude seguem a matriz exaustiva por `fieldPath`, não uma lista
    aproximada por widget.

#### Commands e queries

```ts
type ClinicalSource =
  | 'PATIENT_REPORT'
  | 'REFERRAL'
  | 'MEASUREMENT'
  | 'PROFESSIONAL_OBSERVATION'

type AnswerInput<T> =
  | {
      status: 'ANSWERED'
      value: T
      source: ClinicalSource
    }
  | {
      status: 'NEGATIVE' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'REFUSED'
      source: ClinicalSource
    }

type RootAnswerValueByPath = {
  'procedure_context.indication': string
  'procedure_context.plannedDate': string
  'procedure_context.laterality': 'LEFT' | 'RIGHT' | 'BILATERAL'
  'procedure_context.referralNotes': string
  'allergies.hasAllergy': true
  'anesthesia_history.previousAnesthesia': true
  'anesthesia_history.personalComplication': true
  'anesthesia_history.personalComplicationDescription': string
  'anesthesia_history.difficultAirwayHistory': true
  'anesthesia_history.postoperativeNauseaVomiting': true
  'anesthesia_history.familyAnesthesiaComplication': true
  'anesthesia_history.familyComplicationDescription': string
  'cardiovascular.chestPain': true
  'cardiovascular.dyspneaAtRest': true
  'cardiovascular.syncope': true
  'cardiovascular.palpitation': true
  'cardiovascular.edema': true
  'cardiovascular.knownCardiovascularDisease': true
  'cardiovascular.detail': string
  'respiratory.dyspnea': true
  'respiratory.wheezing': true
  'respiratory.recentRespiratoryInfection': true
  'respiratory.chronicCough': true
  'respiratory.sleepApneaDiagnosis': true
  'respiratory.usesRespiratorySupport': true
  'respiratory.supportDescription': string
  'respiratory.detail': string
  'functional_capacity.activity': { catalogId: string | null; label: string }
  'functional_capacity.metMin': number
  'functional_capacity.metMax': number
  'functional_capacity.limitedBySymptoms': true
  'functional_capacity.limitationDescription': string
  'medications.usesMedication': true
  'diagnoses.hasDiagnosis': true
  'bleeding_thrombosis.abnormalBleeding': true
  'bleeding_thrombosis.easyBruising': true
  'bleeding_thrombosis.priorThrombosis': true
  'bleeding_thrombosis.familyBleedingDisorder': true
  'bleeding_thrombosis.receivesAnticoagulantOrAntiplatelet': true
  'bleeding_thrombosis.detail': string
  'vital_signs.measuredAt': string
  'vital_signs.systolicBpMmHg': number
  'vital_signs.diastolicBpMmHg': number
  'vital_signs.heartRateBpm': number
  'vital_signs.oxygenSaturationPct': number
  'vital_signs.weightKg': number
  'vital_signs.heightCm': number
  'vital_signs.temperatureC': number
  'habits_substances.tobacco': { current: true }
  'habits_substances.tobaccoAmountPerDay': number
  'habits_substances.alcohol': { current: true }
  'habits_substances.alcoholFrequency': string
  'habits_substances.recreationalSubstances': true
  'habits_substances.substancesDescription': string
  'habits_substances.recentUse': string
  'special_conditions.pregnancyApplicable': true
  'special_conditions.pregnant': true
  'special_conditions.lactating': true
  'special_conditions.communicationAccommodation': string
  'special_conditions.mobilityAccommodation': string
  'special_conditions.legalRepresentativeNeeded': true
  'special_conditions.otherCondition': string
  'exams_pending.documentsAvailable': true
  'clinical_notes.note': string
}

type RootAnswerFieldPath = keyof RootAnswerValueByPath
type ClinicalListPath =
  | 'allergies.items'
  | 'medications.items'
  | 'diagnoses.items'
  | 'exams_pending.items'

type AllergyItemInput = {
  id: string
  substance: AnswerInput<string>
  reaction: AnswerInput<string>
  severity: AnswerInput<'MILD' | 'MODERATE' | 'SEVERE' | 'UNKNOWN'>
}

type MedicationItemInput = {
  id: string
  catalogId: string | null
  name: string
  activeIngredient: string | null
  dose: AnswerInput<string>
  frequency: AnswerInput<string>
  lastUse: AnswerInput<string>
  reason: AnswerInput<string>
  sourceText: string
}

type DiagnosisItemInput = {
  id: string
  cidId: string | null
  code: string | null
  name: string
  controlled: AnswerInput<true>
  currentSymptoms: AnswerInput<true>
  detail: AnswerInput<string>
}

type ExamPendingItemInput = {
  id: string
  kind: 'EXAM' | 'REPORT' | 'INFORMATION'
  name: string
  requestedBy: AnswerInput<string>
  requestedAt: AnswerInput<string>
  dueAt?: AnswerInput<string>
  status: 'PRESENT' | 'MISSING' | 'REQUESTED'
  note?: AnswerInput<string>
}

type NewItemInputByListPath = {
  'allergies.items': AllergyItemInput
  'medications.items': MedicationItemInput
  'diagnoses.items': DiagnosisItemInput
  'exams_pending.items': ExamPendingItemInput
}

type AtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>
}[keyof T]

type ItemPatchByListPath = {
  [P in ClinicalListPath]: AtLeastOne<Omit<NewItemInputByListPath[P], 'id'>>
}

type SetAnswerOperation = {
  [P in RootAnswerFieldPath]: {
    type: 'SET_ANSWER'
    fieldPath: P
    answer: AnswerInput<RootAnswerValueByPath[P]>
  }
}[RootAnswerFieldPath]

type AddItemOperation = {
  [P in ClinicalListPath]: {
    type: 'ADD_ITEM'
    listPath: P
    item: NewItemInputByListPath[P]
    source: ClinicalSource
  }
}[ClinicalListPath]

type UpdateItemOperation = {
  [P in ClinicalListPath]: {
    type: 'UPDATE_ITEM'
    listPath: P
    itemId: string
    patch: ItemPatchByListPath[P]
    source: ClinicalSource
  }
}[ClinicalListPath]

type RemoveItemOperation = {
  type: 'REMOVE_ITEM'
  listPath: ClinicalListPath
  itemId: string
  source: ClinicalSource
}

type DraftOperation =
  | SetAnswerOperation
  | AddItemOperation
  | UpdateItemOperation
  | RemoveItemOperation

type SaveDraftInput = {
  anamnesisId: string
  expectedDraftVersion: number
  operations: DraftOperation[]
}

type SubmitFinalAnamnesisInput = {
  requestId: string
  caseId: string
  anamnesisId: string
  expectedDraftVersion: number
  expectedCaseVersion: number
}

type SubmitFinalAnamnesisResult = {
  anamnesisId: string
  anamnesisStatus: 'COMPLETE'
  finalRevision: 1
  requirementId: string
  requirementStatus: 'CALCULATED'
  caseStatus: 'NURSING_IN_PROGRESS'
}

type RebaseCaseContextInput = {
  requestId: string
  caseId: string
  anamnesisId: string
  expectedDraftVersion: number
  expectedCaseVersion: number
  reason: string
}

type AnamnesisErrorCode =
  | 'INVALID_TRANSITION'
  | 'VERSION_CONFLICT'
  | 'CASE_CONTEXT_STALE'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'IDEMPOTENCY_KEY_REUSED'
```

Os schemas executáveis são quatro unions estritas, nunca um parser de path genérico:

```ts
type AnswerSchemaRegistry = {
  [P in RootAnswerFieldPath]: z.ZodType<AnswerInput<RootAnswerValueByPath[P]>>
}

type NewItemSchemaRegistry = {
  [P in ClinicalListPath]: z.ZodType<NewItemInputByListPath[P]>
}

type ItemPatchSchemaRegistry = {
  [P in ClinicalListPath]: z.ZodType<ItemPatchByListPath[P]>
}

const draftOperationSchema = z.union([
  setAnswerOperationSchema,
  addItemOperationSchema,
  updateItemOperationSchema,
  removeItemOperationSchema,
])
```

`answerSchemaByFieldPath`, `newItemSchemaByListPath` e `itemPatchSchemaByListPath` usam
`satisfies` contra os três registries acima: chave ausente ou extra falha no typecheck. Cada
objeto Zod é `.strict()`. O parser primeiro discrimina `type`, depois seleciona o schema pela
chave literal e por fim roda `superRefine` do envelope para as condições da matriz. Patch
vazio, troca de `id`, item inexistente, path `items[*]` em `SET_ANSWER`, `ANSWERED false`,
`NOT_APPLICABLE` fora da condição e campo desconhecido falham como `VALIDATION_ERROR`.

Handlers:

| Channel | Papel | Efeito |
|---|---|---|
| `clinicalAnamnesis.getClinical` | ENFERMAGEM/ANESTESIOLOGISTA | caso + draft ou único FINAL + provenance |
| `clinicalAnamnesis.start` | ENFERMAGEM | cria draft do template fixo |
| `clinicalAnamnesis.saveDraft` | ENFERMAGEM | CAS por `expectedDraftVersion`; somente DRAFT |
| `clinicalAnamnesis.submitFinal` | ENFERMAGEM | FINAL/COMPLETE + requirement CALCULATED; mantém NURSING_IN_PROGRESS |
| `clinicalAnamnesis.rebaseCaseContext` | ENFERMAGEM | reancora contexto somente em DRAFT e antes de FINAL/CALCULATED |
| `catalogs.procedures.search` | RECEPCAO/ENFERMAGEM | busca read-only |
| `catalogs.services.search` | RECEPCAO | busca read-only |
| `catalogs.cid10.search` | ENFERMAGEM | busca read-only |
| `catalogs.medications.search` | ENFERMAGEM | busca read-only |
| `catalogs.met.search` | ENFERMAGEM | busca read-only |
| `clinicalAnamnesis.export` | ENFERMAGEM/ANESTESIOLOGISTA | produz DTO sanitizado do único FINAL para PDF |

Os handlers de leitura e exportação exigem `clinical:anamnesis:read`. `start`, `saveDraft`,
`rebaseCaseContext` e `submitFinal` exigem `clinical:anamnesis:edit`, que o mapa canônico de
acesso concede somente à `ENFERMAGEM`; o estado `DRAFT` e os guards transacionais continuam
obrigatórios mesmo com a capability. Depois de `COMPLETE`, não existe capability que
autorize escrita.

Todo input passa por Zod no processo main. Cada comando aceita de 1 a 100 operações. No
mesmo comando, `SET_ANSWER` não repete `fieldPath` e só existe uma operação para cada par
`(listPath,itemId)`; combinações ambíguas como adicionar e remover o mesmo item falham.
O service recebe o `ActorContext` main-only do domínio de acesso, derivado por
`requireSession`; esse tipo não é redeclarado neste domínio e nunca faz parte do payload do
renderer. O renderer escolhe a origem da
resposta, mas nunca envia SQL, papel, ator, timestamp de captura ou HTML clínico como fonte
de verdade; o main carrega o draft, aplica os patches e injeta autoria/horário na
provenance antes de validar e persistir. `ADD_ITEM` cria `itemProvenance.created` e
`lastUpdated`; `UPDATE_ITEM` preserva `created` e troca `lastUpdated`; `REMOVE_ITEM` apaga
somente o item ativo. As três operações acrescentam receipt sequencial em
`listMutationLog`, inclusive a remoção.

Toda leitura clínica compõe `ProcedureContextProjectionDTO` com o caso atual. Antes de
`start`, `saveDraft`, `submitFinal` ou `rebaseCaseContext`, o service recalcula o fingerprint.
Enquanto a anamnese estiver `DRAFT` e não houver revisão `FINAL` nem linha em
`scheduling_requirements`, o write path de correção do caso chama
`markCaseContextStale(caseId, newCaseVersion)` na mesma transação e emite
`ANAMNESIS_CONTEXT_STALE`. Divergência muda `context_state` para `STALE` e bloqueia save ou
submit com `CASE_CONTEXT_STALE`. `rebaseCaseContext` exige `DRAFT`, `context_state=STALE`,
as versões atuais do draft/caso e ausência de revisão `FINAL` e requirement; então atualiza
somente âncora/fingerprint, volta a `VALID` e incrementa `draft_version`.

O serviço de caso possui cross-guard obrigatório para qualquer `cases.correctIntake` de
`person_snapshot`, `referral_snapshot`, `procedure_snapshot` ou `requester_snapshot`. Na
mesma transação, ele bloqueia
`preop_cases`, `clinical_anamneses`, `clinical_anamnesis_revisions` e
`scheduling_requirements`. Se encontrar revisão `FINAL` ou qualquer requirement já criado
— inicialmente `CALCULATED`, depois possivelmente `CONFIRMED` ou `OVERRIDDEN` — rejeita com
`INVALID_TRANSITION` antes de alterar snapshot, versão ou evento. A regra vale inclusive
para caso ainda em `NURSING_IN_PROGRESS`. Não existe caminho de rebase depois desse marco.

O lifecycle de `preop_cases.status` é compartilhado por todos os domínios e não pode ser
substituído por estados internos da anamnese. Para este Build, as transições escritas são:
`RECEIVED_AT_RECEPTION → WAITING_NURSING → NURSING_IN_PROGRESS`; rascunho incompleto que
aguarda dado usa `TRIAGE_PENDING` e retoma para `NURSING_IN_PROGRESS`. `submitFinal` verde
mantém `NURSING_IN_PROGRESS`; somente `scheduling.requirements.confirm` ou
`scheduling.requirements.override`, pertencentes à agenda, movem o caso para
`READY_FOR_SCHEDULING`. Cada command valida origem, destino, versão esperada, papel e
auditoria na mesma transação.

#### Atomicidade e versão

- Save draft executa `UPDATE ... WHERE status='DRAFT' AND draft_version = expected` e exige
  uma linha afetada.
- `submitFinal` exige caso `NURSING_IN_PROGRESS`, anamnese `DRAFT`, contexto `VALID`,
  ausência de revisão/requirement e versões atuais. Ele valida o candidato e executa o motor
  no mesmo commit.
- Resultado não classificável reverte tudo: não cria revisão, requirement, evento ou
  receipt terminal e mantém o draft/caso.
- Resultado calculado insere a revisão `FINAL` número 1, grava requirement `CALCULATED`,
  limpa a cópia mutável `draft_content`, muda a anamnese para `COMPLETE`, mantém o caso
  `NURSING_IN_PROGRESS` e persiste evento/auditoria/receipt em um único commit.
- `requestId` é persistido em `clinical_anamnesis_command_receipts`; mesmo ID e fingerprint
  devolvem o mesmo resultado, enquanto mesmo ID com payload diferente falha fechado.
- Rebase usa receipt e lock simultâneo de `preop_cases.version`, `draft_version`,
  `case_context_fingerprint`, revisão e requirement; nunca reancora silenciosamente durante
  leitura ou save.
- Conteúdo final nunca recebe `UPDATE` ou `DELETE`.
- Depois de `COMPLETE`, save, rebase e segunda submissão falham `INVALID_TRANSITION`; não
  existe command de edição ou revisão adicional. `start` para um caso que já possui
  anamnese também falha `INVALID_TRANSITION`.

### Frontend

#### Rotas

- `/casos/:caseId/triagem` — enfermagem, editor dos 14 widgets.
- `/casos/:caseId/revisao` — anestesiologista, leitura do snapshot FINAL.
- A recepção usa sua superfície operacional; ela não importa componentes de widget.

#### Composição da triagem

1. Header: identificador da demo, procedimento e serviço read-only projetados do caso,
   estado e alerta bloqueante quando o contexto estiver stale.
2. Progresso: respondidos, pendentes e recusados; não usa score clínico.
3. Índice lateral dos 14 widgets com estado textual.
4. Área central: um widget por seção; navegação anterior/próximo e salvamento local.
5. Rodapé fixo: “Salvar rascunho” e “Finalizar anamnese”.
6. Drawer de pendências ao finalizar.

O composer reutiliza DnD apenas internamente onde necessário, mas template obrigatório não
pode ser reordenado ou deletado. Cada Answer tem um componente comum com opções
“Não”, “Não sabe”, “Não se aplica” e “Prefere não responder” somente quando o campo permite.

#### Estados UX

| Estado | Comportamento |
|---|---|
| loading | skeleton do header e seções |
| empty/new | template criado com todos os campos `NOT_ASKED` |
| dirty | indicador local + save explícito/debounce com revisão |
| saving | ações desabilitadas, conteúdo permanece visível |
| saved | revisão do draft exibida |
| conflict | banner bloqueante, recarregar ou copiar mudanças; nunca merge silencioso |
| context-stale | somente DRAFT: procedimento/serviço atualizados em read-only; salvar/submeter bloqueados até rebase explícito |
| invalid | foco no primeiro campo e lista completa de pendências |
| complete | terminal e readonly para todos os papéis; sem ação de mutação clínica |
| catalog miss | mantém texto livre e rotula “não vinculado ao catálogo” |
| error | mensagem recuperável, retry e nenhum falso “salvo” |

#### Acessibilidade

- Seções com headings reais e navegação por teclado.
- Estado nunca comunicado apenas por cor.
- Erros ligados por `aria-describedby`.
- Radio/checkbox têm legend e descrição.
- Foco vai para erro, conflito ou confirmação de finalização.

### Validation

| Camada | Prova |
|---|---|
| DTO | tabela parametrizada dos seis estados de resposta por campo |
| Registry | exatamente 14 tipos e um definition por tipo |
| Template | ordem fixa, sem widget herdado rejeitado |
| Serialization | round-trip v3, ID duplicado, versão errada e widget desconhecido |
| Completeness | positivo condicionado, NOT_ASKED, UNKNOWN, REFUSED e NA |
| Field matrix | cada path da matriz possui schema; required/optional/NA e condições cobertos parametrizadamente |
| Operations | quatro discriminantes; path/item inválido, patch vazio, duplicate target e unknown key falham |
| Item provenance | add/update/remove injetam autoria; remoção deixa receipt e não deixa item ativo |
| Case projection | correção pré-final gera stale/rebase; após FINAL ou requirement, case service falha `INVALID_TRANSITION` sem mutação |
| Persistence | caso sem patientId, homônimos, dois casos simultâneos; no máximo um FINAL por anamnese |
| Concurrency | dois saves com mesma versão: um vence, outro recebe VERSION_CONFLICT |
| Submit atomicity | FINAL/COMPLETE e requirement CALCULATED nascem juntos; falha deixa zero artefatos e caso NURSING_IN_PROGRESS |
| Idempotency | receipt de SUBMIT_FINAL/REBASE_CONTEXT devolve mesmo resultado por fingerprint e recusa chave reutilizada |
| Immutability | UPDATE/DELETE, segundo FINAL, save, rebase e nova submissão após COMPLETE falham |
| Terminal capability | capability de edição não contorna estado; start/save/rebase/submit após COMPLETE falham INVALID_TRANSITION |
| RBAC | recepção não obtém content; enfermagem não usa papel médico |
| Catalog | IDs válidos, fallback livre, hash e seed idempotente |
| Offline | `fetch` bloqueado durante init/schema/seed |
| Renderer | teclado, erro, version conflict, submissão final e estado terminal readonly |
| PDF | sem rede/JS; texto escapado; provenance e revisão impressas |

### Operations

- Banco fica no diretório atual do app; export continua por diálogo do Electron.
- Logs contêm IDs técnicos, ação e erro; não imprimem conteúdo clínico nem token.
- Este domínio não define backup, restore nem reset como superfície de produto.
- Limpeza de dados sintéticos existe somente no harness de teste, invocada fora dos routers
  clínicos e sem criar requisito de UI.
- Catálogos carregam antes da primeira janela; erro de hash impede boot com mensagem clara.

## Sequence

1. Congelar tipos comuns, 14 DTOs e refinements Zod.
2. Entregar primeiro a migration expand-only de serviços/procedimentos para preceder acesso.
3. Entregar, depois da migration de caso, a migration de anamnese/FINAL/receipts ao runner
   e ledger exclusivos da arquitetura; não criar `migrate.ts`, manifesto ou `schema_migrations`.
4. Expandir catálogos e seed read-only.
5. Implementar services transacionais e DTO mappers.
6. Expor handlers TIPC validados e filtrados por papel.
7. Construir template/registry e editors shadcn.
8. Montar rota da enfermagem e rota médica.
9. Integrar export sanitizado.
10. Executar provas de contrato, banco, RBAC, renderer, offline e PDF.

Esta sequência é dependência arquitetural. Plan a converterá em subtarefas somente depois do
BUILD integrado, Warlog e Writing Plan da fatia.

## Rollback / Containment

- Migration é apenas expansão; tabelas legadas permanecem intactas.
- Novos handlers usam prefixo `clinicalAnamnesis.*`; remover o wiring desativa o domínio sem afetar
  IA/RAG.
- Feature flag local oculta as rotas novas até a minispec estar verde.
- Nenhum dado legado é migrado automaticamente.
- Se seed novo falhar, a transação reverte e o hash não é atualizado.
- Se envelope v3 falhar, o v2 continua legível somente na superfície legada.

## Risks

| Risk | Containment |
|---|---|
| Duplicação entre v2/v3 | namespace explícito e nenhum adapter implícito |
| Scope de 14 widgets | template fixo, componentes comuns e Plan em minispecs |
| Catálogo incompleto | fallback livre rotulado; nenhuma alegação de completude ANVISA |
| Papel falsificado no IPC | sessão/actor resolvido no main; input não decide autorização |
| Escrita concorrente no PGlite | optimistic revision + transação curta |
| Correção de contexto reintroduzir evolução clínica | case service bloqueia FINAL/requirement e retorna INVALID_TRANSITION antes do write |
| Segundo snapshot clínico ser criado por atalho | UNIQUE por anamnese + trigger terminal + ausência de command de mutação pós-FINAL |
| Documento clínico arbitrário no PDF | DTO sanitizado e renderer de export dedicado |
| Confundir demo com protocolo | banner, copy e ausência de ASA/aptidão/conduta |

## Definition of Complete for Build

- [x] Produto, backend, frontend, validação e operações estão descritos como proposta.
- [ ] Contratos clínicos pesquisados e validados.
- [ ] Tabelas, DTOs, commands, queries e constraints provados no runtime.
- [ ] Estados, sequência e rollback aprovados pelo adversarial.
- [x] Conteúdo da PoC incorporado ao Analyst integrado.
- [ ] Critic revisar este blueprint.
- [ ] Review final de congruência do BUILD integrado antes do Warlog.

---

## Estado de consolidação

- Estado: `INCORPORATED_IN_BUILD`.
- Autoridade canônica: `hack/BUILD.md`.
- Gate individual: inexistente.
- Uso futuro: detalhe técnico para o Writing Plan, sem substituir a síntese.
