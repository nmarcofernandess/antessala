# Build — IA, memória e conhecimento

## Estado documental

- Papel: `CANONICAL_DOMAIN_BUILD`.
- Indexado por: `hack/BUILD.md`.
- Gate ou assinatura individual: inexistente.
- O estado de maturidade permanece no tracker único; o hub não pode promovê-lo sozinho.
- Este arquivo é a fonte técnica do domínio. `hack/BUILD.md` apenas integra dependências;
  não substitui, resume com perda nem supera este contrato.

## Propósito deste Build

Este arquivo é o owner físico de IA, memória e conhecimento. O hub `hack/BUILD.md` apenas
indexa sua integração. Ele fecha:

1. capacidades comprovadas no HEAD;
2. incompatibilidades entre o legado e o novo contrato;
3. restrições que já vêm das leis do produto;
4. limites que o Writing Plan não pode violar.

O contrato abaixo cobre tabelas, namespaces, Gemini, captura/transcrição, superfícies e
transações que o Writing Plan deve executar; não existe alternativa paralela.

## Fontes consumidas

- `hack/PRD.md` — fronteiras gerais da prova, ainda sem o contrato deste domínio.
- `hack/domains/ANALYST-ia-memoria-e-conhecimento.md` — `ADVERSARIAL_REQUIRED`.
- `hack/domains/ANALYST-acesso-e-auditoria.md` — atores e fronteira de confiança.
- `hack/domains/ANALYST-anamnese-e-catalogos.md` — respostas semânticas e proveniência.
- `hack/domains/ANALYST-classificacao-e-agenda.md` — requisito operacional e autoridade humana.
- `hack/domains/ANALYST-arquitetura-offline-e-prova.md` — boot e fluxo-base offline.
- Código do HEAD citado na matriz abaixo.

## Terreno comprovado no HEAD

| Capacidade | Estado real | Evidência |
|---|---|---|
| Chat cloud genérico | `ATIVO`, fora do caso clínico | `/ia` e painel lateral estão montados em `src/renderer/src/App.tsx:13-55`; envio usa `src/main/ia/cliente.ts`. |
| Configuração de provedor | `ATIVA`, inadequada para segredo clínico | Token/modelo persistem em `configuracao_ia` (`src/main/db/schema.ts:14-24`) e handlers salvam token (`src/main/tipc.ts:61-103`). |
| Egress cloud do main | `ATIVO` por ação de chat/teste, divergente do alvo | O legado ainda contém Gemini e OpenRouter em `src/main/ia/cliente.ts:52-107`; o Analyst corrigido fixa Gemini único, sintético e demo-only. |
| Conversas e mensagens | `ATIVAS`, sem vínculo com caso | Tabelas em `src/main/db/schema.ts:133-163`; handlers em `src/main/tipc.ts:131-262`. |
| Memória de texto livre | `CONTIDA` no IPC, superfície sem rota | O router ativo não espalha mais `dormantKnowledgeRouter`; módulos e tabelas permanecem no repositório. |
| RAG/importadores/grafo | Backend preservado, não IPC-callable | Módulos em `src/main/knowledge/` e tabelas em `src/main/db/schema.ts:31-126`; nenhum canal ativo os expõe no recon atual. |
| Embeddings | `DORMENTE` sem adaptador | Sem adapter, funções retornam `null` e busca textual permanece disponível (`src/main/knowledge/embeddings.ts:1-79`). |
| Captura de áudio | Componente `DORMENTE` | `FlowSpeechInput` grava WAV, mas o input ativo é somente texto (`FlowSpeechInput.tsx:14-66`; `IaChatInput.tsx:14-55`). |
| STT local | `INCOMPLETO` | Main possui catálogo, download e sidecar, mas `ia.stt.*` não está no router ativo (`src/main/stt/*`; `src/main/tipc.ts:373-409`). |
| Modelo STT | Opcional e externo | Catálogo aponta para artefato de 478 MB (`src/main/stt/catalog.ts:8-24`); download usa `fetch` explícito (`src/main/stt/download.ts:51-79`). |
| Preload | `ATIVO`, allowlist fechada | O bridge ainda oferece `invoke`, mas `assertActiveIpcChannel` rejeita qualquer nome fora dos 17 canais publicados (`src/preload/index.ts:1-18`; `src/shared/active-ipc-channels.ts`). Isso reduz a superfície, sem substituir autenticação e capability no main. |
| Propostas por campo | `INEXISTENTE` | Não há contrato que ligue transcript, widget, origem e decisão humana. |
| Relação aprovada/versionada | `INEXISTENTE` | `knowledge_relations` guarda arestas e vigência, mas não aprovação, versão, justificativa ou auditoria clínica (`src/main/db/schema.ts:105-126`). |

O terreno mudou depois da primeira redação deste Build: a superfície e os handlers de
conhecimento estão contidos, enquanto o chat cloud genérico permanece ativo. O recon deve
ser repetido no SHA que receber o futuro Build; nome de módulo não prova exposição.

## Gap entre legado e produto

| Legado | Por que não satisfaz o Analyst |
|---|---|
| Chat livre | Não conhece caso, widgets, responsabilidades, fontes por campo nem confirmação individual. |
| `ia_memorias` com texto livre | Não distingue caso, exemplo e regra; não tem revisão, aprovação, versão ou desativação clínica. |
| Importação automática de conversas | Pode promover narrativa e identidade sem decisão explícita; é proibida até reconciliação. |
| Grafo extraído por LLM | Relação inferida pode ser persistida sem o lifecycle humano exigido. |
| `peso` da relação | Não representa evidência, validade clínica nem autoridade para decidir. |
| Token no PGlite | Não fecha segredo, escopo, redaction, rotação ou acesso administrativo. |
| STT baixável | Não pode baixar 478 MB no primeiro boot nem virar dependência do fluxo-base. |
| Painel global de IA | Facilita enviar conteúdo clínico sem contexto, minimização ou explicação de rede. |
| Memória automática configurável | Contraria a proibição de promoção implícita de casos para memória global. |

Nenhuma tabela ou handler legado é declarado canônico por este anexo. Reuso exige
adaptação comprovada; nome semelhante não basta.

## Restrições físicas já obrigatórias

Estas restrições decorrem de leis do produto e não dependem da escolha de arquitetura:

1. Boot, caso, agenda, avaliação, PDF e handoff não dependem de IA nem rede.
2. Não existe download automático de modelo no primeiro boot.
3. O renderer não acessa PGlite, segredo ou arquivo clínico diretamente.
4. Todo conteúdo cloud sai somente após ação explícita e confirmação informada.
5. Toda saída da IA persiste, se persistir, como `DRAFT` até ação humana autorizada.
6. Caso, exemplo e regra global têm storage/lifecycle separados ou separação equivalente
   comprovável; nunca compartilham estado implícito.
7. Somente relações aprovadas e ativas entram na recuperação operacional.
8. Proposta por campo preserva origem, versão de entrada, modelo e decisão humana.
9. Recepção, solicitante e admin não recebem conteúdo clínico deste domínio por padrão.
10. Mutação e recibo de decisão humana são atômicos no main.
11. Conteúdo clínico e segredos ficam fora de logs, erros públicos, auditoria e exportação.
12. Fallback manual funciona quando microfone, STT, embeddings, provedor ou rede falham.
13. A PoC cloud usa somente Gemini e somente fixture sintética; OpenRouter e fallback entre
    provedores não pertencem ao produto-alvo.
14. Conteúdo não confiável não amplia tools, rede, campos, papel ou transição, e a IA não
    recebe ferramenta mutadora.

## Contrato físico do domínio

O produto não implementa chat global, embeddings obrigatórios nem uma base clínica
universal. Ele implementa, dentro de `/assistente`, transcript sintético digitado ou
capturado, transcrição Gemini explícita, propostas por campo e recuperação textual de
relação ativa. Não existe modelo STT local nem download de 478 MB.

### Persistência

```sql
CREATE TABLE case_audio_capture_receipts (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  anamnesis_id TEXT NOT NULL,
  draft_revision INTEGER NOT NULL CHECK (draft_revision > 0),
  operational_choice TEXT NOT NULL CHECK (operational_choice IN ('GRANTED','REFUSED','REVOKED')),
  status TEXT NOT NULL CHECK (status IN ('READY','RECORDING','STOPPED','DISCARDED','TRANSCRIBED','FAILED')),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 3600000),
  audio_sha256 TEXT CHECK (audio_sha256 IS NULL OR char_length(audio_sha256) = 64),
  created_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,
  discarded_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, case_id)
);

CREATE TABLE case_transcripts (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  anamnesis_id TEXT NOT NULL,
  draft_revision INTEGER NOT NULL CHECK (draft_revision > 0),
  capture_receipt_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('SYNTHETIC_TYPED','SYNTHETIC_GEMINI_AUDIO')),
  data_classification TEXT NOT NULL CHECK (data_classification = 'FICTIONAL_NON_DERIVED'),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 12000),
  content_hash TEXT NOT NULL CHECK (char_length(content_hash) = 64),
  status TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','INVALIDATED')),
  created_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL,
  invalidated_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, case_id),
  FOREIGN KEY (capture_receipt_id, case_id)
    REFERENCES case_audio_capture_receipts(id, case_id) ON DELETE RESTRICT,
  CHECK (
    (kind = 'SYNTHETIC_TYPED' AND capture_receipt_id IS NULL)
    OR (kind = 'SYNTHETIC_GEMINI_AUDIO' AND capture_receipt_id IS NOT NULL)
  )
);

CREATE TABLE ai_invocations (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES preop_cases(id) ON DELETE RESTRICT,
  transcript_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'GEMINI'),
  model TEXT NOT NULL,
  instruction_version TEXT NOT NULL,
  input_hash TEXT NOT NULL CHECK (char_length(input_hash) = 64),
  status TEXT NOT NULL CHECK (status IN ('REQUESTED','SUCCEEDED','FAILED','CANCELLED')),
  safe_error_code TEXT,
  requested_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  requested_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  UNIQUE (id, case_id),
  FOREIGN KEY (transcript_id, case_id)
    REFERENCES case_transcripts(id, case_id) ON DELETE RESTRICT
);

CREATE TABLE ai_field_proposals (
  id TEXT PRIMARY KEY,
  invocation_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  anamnesis_id TEXT NOT NULL,
  draft_revision INTEGER NOT NULL CHECK (draft_revision > 0),
  widget_type TEXT NOT NULL,
  field_path TEXT NOT NULL,
  proposed_answer JSONB NOT NULL,
  source_excerpt TEXT NOT NULL,
  evidence_state TEXT NOT NULL CHECK (evidence_state IN (
    'SUPPORTED','AMBIGUOUS','CONFLICTING','NO_EVIDENCE','OUT_OF_SCOPE'
  )),
  status TEXT NOT NULL CHECK (status IN (
    'DRAFT','ACCEPTED','REJECTED','CORRECTED','INVALIDATED'
  )),
  decided_answer JSONB,
  decided_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, case_id),
  UNIQUE (invocation_id, widget_type, field_path),
  FOREIGN KEY (invocation_id, case_id)
    REFERENCES ai_invocations(id, case_id) ON DELETE RESTRICT,
  CHECK (jsonb_typeof(proposed_answer) = 'object'),
  CHECK (decided_answer IS NULL OR jsonb_typeof(decided_answer) = 'object'),
  CHECK (
    (status = 'DRAFT' AND decided_by_actor_id IS NULL AND decided_at IS NULL)
    OR (status IN ('ACCEPTED','REJECTED','CORRECTED','INVALIDATED')
      AND decided_by_actor_id IS NOT NULL AND decided_at IS NOT NULL)
  )
);

CREATE TABLE knowledge_sources (
  id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  locator TEXT NOT NULL,
  license_or_basis TEXT NOT NULL,
  scope TEXT NOT NULL,
  limitations TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','RETIRED')),
  created_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, version)
);

CREATE TABLE knowledge_relations (
  id TEXT PRIMARY KEY,
  predecessor_id TEXT,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  scope TEXT NOT NULL,
  limitations TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'SUGGESTED','APPROVED_INACTIVE','ACTIVE','REJECTED','SUPERSEDED','RETIRED'
  )),
  proposed_by_actor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  reviewed_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  review_decision TEXT CHECK (review_decision IN ('APPROVE','REJECT')),
  activated_by_actor_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  version_lock INTEGER NOT NULL DEFAULT 1 CHECK (version_lock > 0),
  FOREIGN KEY (source_id, source_version)
    REFERENCES knowledge_sources(id, version) ON DELETE RESTRICT,
  FOREIGN KEY (predecessor_id)
    REFERENCES knowledge_relations(id) ON DELETE RESTRICT,
  CHECK (predecessor_id IS NULL OR predecessor_id <> id),
  CHECK (
    (status = 'SUGGESTED' AND reviewed_by_actor_id IS NULL
      AND review_decision IS NULL AND reviewed_at IS NULL
      AND activated_by_actor_id IS NULL AND activated_at IS NULL AND retired_at IS NULL)
    OR (status = 'APPROVED_INACTIVE' AND reviewed_by_actor_id IS NOT NULL
      AND review_decision = 'APPROVE' AND reviewed_at IS NOT NULL
      AND activated_by_actor_id IS NULL AND activated_at IS NULL AND retired_at IS NULL)
    OR (status = 'ACTIVE' AND reviewed_by_actor_id IS NOT NULL
      AND review_decision = 'APPROVE' AND reviewed_at IS NOT NULL
      AND activated_by_actor_id IS NOT NULL AND activated_at IS NOT NULL AND retired_at IS NULL)
    OR (status = 'REJECTED' AND reviewed_by_actor_id IS NOT NULL
      AND review_decision = 'REJECT' AND reviewed_at IS NOT NULL
      AND activated_by_actor_id IS NULL AND activated_at IS NULL AND retired_at IS NULL)
    OR (status IN ('SUPERSEDED','RETIRED') AND reviewed_by_actor_id IS NOT NULL
      AND reviewed_at IS NOT NULL AND retired_at IS NOT NULL)
  )
);

CREATE INDEX knowledge_relations_text_search
  ON knowledge_relations(status, lower(subject), lower(predicate), lower(object));
```

`knowledge_sources` guarda versões imutáveis pelo par `(id, version)`. A relação usa
`version_lock` para CAS do lifecycle e cria outra linha ligada por `predecessor_id` quando
for supersedida; nunca altera a fonte histórica. As migrations contêm CHECKs adicionais de
tamanho e timestamps, mas não podem alterar os enums/lifecycles acima. Não existe FK entre
caso e `knowledge_relations`: conhecimento global nasce somente por comando explícito de
curadoria.

### DTOs e channels

```ts
type GenerateFieldProposalsInput = {
  caseId: string
  anamnesisId: string
  expectedDraftRevision: number
  transcriptId: string
  acknowledgement: 'SYNTHETIC_DEMO_ONLY'
  requestId: string
}

type DecideFieldProposalInput = {
  proposalId: string
  expectedProposalVersion: number
  decision: 'ACCEPT' | 'REJECT' | 'CORRECT'
  correctedAnswer?: unknown
  reason?: string
  requestId: string
}

type KnowledgeRelationInput = {
  subject: string
  predicate: string
  object: string
  scope: string
  limitations: string
  sourceId: string
  sourceVersion: number
}
```

| Channel | Capability | Resultado |
|---|---|---|
| `ai.transcripts.createSynthetic` | `ai:proposal:generate` | transcript local classificado e hashado |
| `ai.capture.prepare` | `ai:proposal:generate` | recibo e arquivo temporário delimitado, sem iniciar microfone |
| `ai.capture.start/pause/resume/stop/cancel` | `ai:proposal:generate` | lifecycle explícito; cancel/revoke descarta o temporário |
| `ai.capture.excludeSegment` | `ai:proposal:generate` | marca trecho de terceiro para remoção antes da transcrição confirmada |
| `ai.transcripts.transcribeCapture` | `ai:proposal:generate` | confirmação de egress → Gemini → transcript revisável → descarte do áudio |
| `ai.transcripts.saveReview/confirm` | `ai:proposal:generate` | revisão humana do texto; somente `ACTIVE` pode gerar propostas |
| `ai.proposals.generate` | `ai:proposal:generate` | invocation + propostas `DRAFT` validadas pelo schema dos widgets |
| `ai.proposals.list` | `clinical:anamnesis:read` | propostas somente do caso/revisão autorizados |
| `ai.proposals.decide` | `ai:proposal:decide` | proposta decidida + operação aplicada atomicamente no draft |
| `knowledge.relations.searchActive` | `knowledge:read` | somente relações `ACTIVE`, fonte e limitações |
| `knowledge.relations.suggest` | `knowledge:suggest` | relação `SUGGESTED` |
| `knowledge.relations.approve` | `knowledge:approve` | `APPROVED_INACTIVE` |
| `knowledge.relations.activate` | `knowledge:activate` | `ACTIVE` |
| `knowledge.relations.retire` | `knowledge:activate` | `RETIRED`; sai imediatamente de novas buscas |
| `ia.configuracao.obter/salvar/testar` | `ai:config:manage` | Gemini/modelo/estado; nunca devolve segredo |

Capabilities: `ai:proposal:generate` e `ai:proposal:decide` pertencem à `ENFERMAGEM`;
`knowledge:read/suggest/approve/activate` ao `ANESTESIOLOGISTA`; `ai:config:manage` ao
`ADMIN`. Na demo o mesmo anestesiologista pode aprovar e ativar em ações separadas; isso
fica explicitamente rotulado como limitação da PoC.

### Transações e invalidação

1. `prepare/start/stop` exigem caso sintético, anamnese `DRAFT`, revisão exata e escolha
   operacional explícita. O arquivo vive apenas em diretório temporário emitido pelo main.
2. `transcribeCapture` exige confirmação de envio, remove intervalos marcados como fala de
   terceiro, trava o recibo, envia o áudio ao
   `GeminiGateway`, valida resposta e persiste transcript revisável; sucesso, cancelamento e
   falha descartam bytes temporários conforme a matriz de retry. O banco guarda somente
   hash/duração/recibo, nunca path ou áudio.
3. `generate` exige transcript `ACTIVE`, anamnese `DRAFT`, revisão exata e conteúdo sintético;
   cria invocation `REQUESTED`, faz uma chamada Gemini e, após parser `.strict()`, persiste
   lote de proposals ou `FAILED` sem write clínico parcial.
4. `decide` trava proposta e draft. `ACCEPT/CORRECT` aplica uma única operação do schema
   canônico da anamnese e persiste decisão/autoria na mesma transação; `REJECT` não altera
   resposta. Aceitar uma proposta não decide outras.
5. Mudança de transcript, schema ou revisão do draft invalida propostas `DRAFT`; propostas
   decididas permanecem como recibo histórico, nunca são reaplicadas.
6. `suggest → approve → activate` são três comandos CAS e três eventos. Somente `ACTIVE`
   entra em `searchActive`; retire/supersede altera o índice antes de responder sucesso.
7. Busca vazia retorna coleção vazia e a copy “nenhum conhecimento aprovado encontrado”.

### Segredo, egress e contenção

- O alvo remove OpenRouter e o painel global, substitui `/ia` por `/assistente` e não monta
  IA no header, agenda, Composer ou widget.
- A chave Gemini é criptografada com `electron.safeStorage.encryptString`; PGlite guarda
  somente ciphertext. Se `safeStorage.isEncryptionAvailable()` for falso, salvar/testar
  falha com `SECRET_STORAGE_UNAVAILABLE` e o caminho manual continua.
- Só `GeminiGateway` no main pode abrir rede, apenas após `transcribeCapture`, `generate` ou teste explícito,
  para host fixo do Gemini, timeout finito, `redirect: 'error'`, JSON e limite de payload.
- Logs/auditoria guardam invocationId, modelo, hashes, duração e código seguro; nunca token,
  transcript, prompt integral ou proposta clínica.
- `PROVIDER_UNAVAILABLE`, `NETWORK_UNAVAILABLE`, `INVALID_PROVIDER_RESPONSE`,
  `PROPOSAL_STALE`, `SECRET_STORAGE_UNAVAILABLE`, `FORBIDDEN` e `VERSION_CONFLICT` são
  códigos estáveis; todos preservam o draft manual.
- Chat, conversas, memórias automáticas, importadores, grafo extraído e downloads/modelos STT
  permanecem fora do router ativo.

### Componentes e superfícies

- `/assistente`: `AssistantCasePicker`, `CaptureDisclosure`, `AudioCaptureControls`,
  `ThirdPartySegmentEditor`, `TranscriptReview`, `SyntheticTranscriptPanel`,
  `GenerateProposalsDisclosure`, `FieldProposalReview` e `KnowledgeEvidencePanel`; sem
  apply-all. A rota pode ser aberta a partir de um caso, mas continua isolada.
- `FieldProposalReview` mostra campo alvo, trecho/origem, explicação, versão e as ações
  aceitar/rejeitar/corrigir. A decisão aceita/corrigida chama a operação canônica do draft;
  não injeta componente nem estado de IA no widget.
- `/conhecimento`: `KnowledgeSearch`, `KnowledgeRelationForm`, fila de aprovação e ações
  separadas de ativação/retirada.
- `/configuracoes/ia`: Gemini, modelo, segredo mascarado e teste técnico sem conteúdo.
- Loading, vazio, cloud indisponível, resposta inválida, stale, forbidden e conflito são
  estados obrigatórios. Nenhuma superfície de IA bloqueia salvar/submeter manualmente.

## Fronteiras com outros Builds

- **Acesso e auditoria** é owner de sessão, papel, capability, guard e ledger; este Build
  apenas consome.
- **Anamnese e catálogos** é owner do schema de widgets e estados de resposta; a IA propõe,
  nunca redefine.
- **Classificação e agenda** é owner do requisito operacional; o resumo assistivo não cria
  segundo motor.
- **Avaliação e handoff** é owner do resultado e pendências; transcript não vira laudo.
- **Superfícies** define onde cada trabalho aparece depois dos contratos físicos.
- **Arquitetura offline** é owner da política global de boot, router, rede e prova negativa.

Divergência entre owners retorna ao Analyst; este Build não resolve conflito silenciosamente.

## Limite dos Writing Plans

O Writing Plan escolhe arquivos, ordem TDD, fixtures e commits para materializar o contrato
acima. Ele não pode inventar coluna, enum, capability, channel, transação, provider,
lifecycle, política de segredo ou egress. Embeddings, chat global, importadores automáticos,
grafo extraído e modelo STT local continuam fora; reintroduzi-los exige reabrir este Build.

## Provas que o Build definitivo deverá tornar executáveis

1. Boot e fluxo-base com todo egress bloqueado.
2. Chamada opcional mostra disclosure e não acontece ao cancelar.
3. Proposta fora do schema não produz write.
4. Aceite, correção e rejeição por campo preservam autoria e origem.
5. Mudança de transcript/schema invalida proposta pendente.
6. Caso não aparece em busca de memória nem em outro caso.
7. Relação sugerida fica fora do índice ativo até promoção humana.
8. Nova versão não reescreve casos antigos; desativação preserva auditoria.
9. Busca vazia/conflitante não produz conclusão.
10. Papel proibido recebe `FORBIDDEN` sem payload protegido.
11. Falha de STT/cloud/embedding mantém o caminho manual.
12. Logs, auditoria, PDF e erros não contêm segredo ou conteúdo clínico proibido.
13. Nenhum modelo grande é baixado no boot.
14. Uma prova sintética executa um uso real de IA e um uso real de memória aprovada.
15. OpenRouter não aparece em configuração, rota, fallback ou chamada do produto-alvo.
16. Prompt injection não ganha efeito sem ação humana autorizada.
17. Pausar, revogar ou cancelar captura funciona; fala de terceiro marcada não entra no
    transcript confirmado, em proposta nem em memória.
18. Nenhuma proposta é gerada antes de a enfermagem confirmar a revisão do transcript.

Esta lista define resultados. O Writing Plan da minispec escolhe arquivos e testes dentro
da arquitetura já consolidada.

## Riscos abertos

| Risco | Severidade | Estado |
|---|---|---|
| Dado sair pelo main fora da ação explícita | Crítica | Contido por `GeminiGateway` único, host fixo, payload sintético e testes negativos. |
| Caso virar memória por processamento herdado | Crítica | Contido: não há FK/canal de promoção automática; chat/importadores/grafo ficam fora do router. |
| Relação inferida ganhar aparência de protocolo | Crítica | Contido por `SUGGESTED → APPROVED_INACTIVE → ACTIVE`, fonte e limitações visíveis. |
| Token persistido em texto recuperável | Alta | Resolvido no alvo por `safeStorage`; indisponibilidade desativa Gemini sem bloquear o fluxo. |
| Prompt injection em transcript/fonte | Alta | Contenção de efeitos: parser estrito, zero tools mutadoras e decisão humana por campo; não se promete invulnerabilidade do modelo. |
| Áudio sobreviver ao descarte prometido | Alta | Recibo sem path, temporário emitido pelo main, teardown em sucesso/cancel/falha e teste de filesystem. |
| Modelo local inflar pacote ou iniciar download | Alta | Não há STT local no produto; catálogo/downloader legado fica fora do router e do boot. |
| Chat global capturar contexto indevido | Alta | `CONFIRMADO`; superfície ativa atual não é reutilizável como está. |
| Embeddings ausentes degradarem silenciosamente | Média | `CONFIRMADO`; modo textual deve ser explícito e testado. |

## Recibo de incorporação

- [x] Gemini único e fixtures sintéticas foram fixados.
- [x] Propostas por campo, decisão humana e proveniência foram integradas.
- [x] Aprovação e ativação de conhecimento foram separadas.
- [x] Falha de cloud preserva o fluxo manual.
- [x] Transcrição opcional foi fechada via Gemini explícito; STT local grande e embeddings
      continuam fora do caminho crítico.
- [x] O Build do domínio permanece a autoridade física deste domínio; o hub apenas o indexa.

## Estado de consolidação

- Estado: `CANONICAL_DOMAIN_BUILD`.
- Autoridade canônica: este arquivo no domínio de IA, memória e conhecimento.
- Gate individual: inexistente.
- Uso futuro: fonte obrigatória do Warlog e dos Writing Plans que tocarem Assistente,
  conhecimento, Gemini ou rede opcional.
