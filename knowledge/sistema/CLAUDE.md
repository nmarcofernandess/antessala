# FlowKit

Kit quickstart para projetos Electron com IA + RAG + Knowledge Graph.
Forkado do EscalaFlow v1.8.2 (dominio CLT removido). Pronto pra virar qualquer app desktop offline com IA embutida.

**Status:** Funcionalidades principais entregues (shell, RAG/knowledge, IA, galeria + cron) e cobertas por testes — ver tabela de milestones no README.
**Path:** raiz do clone (ex.: `<repo-root>/flowkit`)
**Design specs / plans (opcional):** existem alguns specs/plans historicos versionados em `docs/superpowers/`; novos artefatos gerados por agentes nessa pasta ficam locais, ignorados e não são fonte canônica.

---

## Tech Stack

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Runtime | Electron + Node.js (main) / React (renderer) | 34 / 19 |
| Build | electron-vite, Vite, TypeScript | 3 / 6+ / 5.7 |
| UI | Tailwind CSS v4, shadcn/ui (Radix), lucide-react, sonner, next-themes | 4.2 |
| State | Zustand (um store por dominio) | 5 |
| IPC | @egoist/tipc (type-safe, chamada direta) | 0.3 |
| DB | PGlite + pgvector + pg_trgm | embedded Postgres |
| IA | Vercel AI SDK, Gemini direto / OpenRouter / Local Gemma 4 via `llama-server`; `FLOWKIT_GEMINI_ENABLE=0` desliga Gemini direto | v6 |
| Embeddings | @huggingface/transformers (multilingual-e5-base ONNX, 768d) | local |
| Testes | Vitest + Playwright E2E | 4 / latest |

---

## Comandos

```bash
npm run dev          # Dev com hot reload (Electron + Vite)
npm run build        # Build de producao (main + preload + renderer)
npm run typecheck    # TypeScript check (node + web)
npm test             # Vitest unit/integration tests
npm run test:e2e     # Playwright E2E com Electron real (14 testes, requer build)
npm run pack         # Package app (dir, sem instalador)
npm run dist:mac     # Gerar .dmg/.zip
```

---

## Estrutura de Arquivos

```
flowkit/
├── CLAUDE.md                              # ESTE ARQUIVO — leia primeiro
├── README.md                              # Visao geral do projeto
├── docs/
│   ├── ARCHITECTURE.md                    # Diagrama de camadas + data flow
│   ├── PLUG-AND-PLAY.md                   # 8 receitas pra estender o kit
│   ├── IA-RAG-CLI-TERMINAL.md             # IA local, RAG bulk/enrichment, CLI, Terminal
│   ├── backup-restore.md                  # Sistema de backup/restore
│   ├── release.md                         # Fluxo de release (auto-update, .dmg)
│   ├── tool-calling.md                    # Pattern: 11 tools internas → 3 familias
│   └── superpowers/                       # specs/plans historicos; novos artefatos locais são ignorados
├── knowledge/
│   ├── sistema/                           # Docs do proprio FlowKit (seed)
│   │   ├── CLAUDE.md
│   │   ├── ARCHITECTURE.md
│   │   └── PLUG-AND-PLAY.md
│   └── seed/
│       ├── enrichment-seed.json           # Tags/resumos pre-computados
│       └── graph-seed.json                # Entidades/relacoes pre-computadas
├── models/
│   └── embeddings/                        # Modelo ONNX (gitignored, ~400MB)
│
├── src/
│   ├── main/                              # Processo principal (Node.js)
│   │   ├── index.ts                       # Entry point: initDb → createTables → createWindow → seedData (background)
│   │   ├── tipc.ts                        # Router IPC (~1950 linhas, ~70 handlers)
│   │   ├── backup.ts                      # Backup/restore ZIP (FlowKit tables only)
│   │   ├── tool-server.ts                 # HTTP tool server local (porta 17380, token para ações)
│   │   ├── terminal/
│   │   │   ├── harness.ts                 # exec/read/write/open-cli + terminal_command_log + audit status
│   │   │   ├── cli-command.ts             # resolve CLI dev/empacotado para Terminal IA
│   │   │   ├── config.ts                  # cwd, timeout, output cap
│   │   │   └── sessions.ts                # shell vivo embutido na UI
│   │   ├── gallery/
│   │   │   └── service.ts                 # Gallery CRUD (listar, upload, remover, tags, favorito)
│   │   ├── cron/
│   │   │   └── pipeline.ts                # 6-step cron pipeline (guard, enrichment, memory, session, decay, log)
│   │   ├── config/
│   │   │   └── app-config.ts              # APP_CONFIG — branding central (nome, icone, dbName)
│   │   ├── db/
│   │   │   ├── pglite.ts                  # Singleton PGlite + pgvector + pg_trgm
│   │   │   ├── query.ts                   # queryAll, queryOne, execute, insertReturningId, transaction
│   │   │   ├── schema.ts                  # 14 tabelas (IF NOT EXISTS) + indexes + migrations
│   │   │   └── seed.ts                    # 3-phase seed: docs → enrichment → graph (background)
│   │   ├── importers/
│   │   │   ├── importer-registry.ts       # detectFormat() + detectJsonFormat() + importFile()
│   │   │   ├── text-importer.ts           # .md, .txt, .html → ImportedText
│   │   │   ├── pdf-importer.ts            # .pdf → ImportedText (via pdf-parse)
│   │   │   ├── chatgpt-importer.ts        # .json (mapping) → ImportedConversations (DFS traversal)
│   │   │   ├── claude-importer.ts         # .json (chat_messages) → ImportedConversations
│   │   │   └── zip-importer.ts            # .zip → extrai JSONs → roteia pros importers
│   │   ├── knowledge/
│   │   │   ├── ingest.ts                  # ingestKnowledge() + ingestFromFile() + ingestConversations() + insertChunk()
│   │   │   ├── bulk-import.ts             # Importacao em massa com jobs, pause/resume/cancel
│   │   │   ├── bulk-persistence.ts        # knowledge_groups/import_jobs/import_files
│   │   │   ├── chunking.ts               # chunkText() + chunkConversation()
│   │   │   ├── embeddings.ts              # e5-base ONNX: generateQueryEmbedding/PassageEmbedding (auto-download dev)
│   │   │   ├── search.ts                  # searchKnowledge() — hibrida 70% vetor + 30% FTS + trigram fallback
│   │   │   ├── enrichment-config.ts       # Config de provider/modelo para enrichment
│   │   │   ├── enrichment.ts              # enrichAllChunks() — batch LLM (resumo, tags, entidades, relacoes)
│   │   │   └── graph.ts                   # rebuildGraph() + importGraphSeed() + traversal CTE
│   │   └── ia/
│   │       ├── cliente.ts                 # enviarMensagemStream() — streaming + tool loop (max 10 steps)
│   │       ├── system-prompt.ts           # System prompt (~200 linhas cloud, ~60 local)
│   │       ├── tools.ts                   # 11 tool handlers reais (RAG, memorias, backup, terminal, galeria)
│   │       ├── tool-families.ts           # 3 familias LLM-facing + routing Zod
│   │       ├── discovery.ts               # buildContextBundle() — auto-context (stats, memorias, RAG, page hints)
│   │       ├── readiness.ts               # Gate de chat/CLI (provider, token, download, validacao local)
│   │       ├── config.ts                  # Multi-provider: Gemini, OpenRouter, Local
│   │       ├── local-llm.ts               # Catalogo/download/status/validacao local
│   │       ├── llama-server-runtime.ts    # Sidecar Gemma 4: chat, tool calling, JSON enrichment
│   │       └── session-processor.ts       # Compactacao + memory extraction
│   │
│   ├── preload/
│   │   └── index.ts                       # contextBridge: invoke + on
│   │
│   ├── renderer/src/
│   │   ├── App.tsx                        # createHashRouter + AppLayout (SidebarProvider → SidebarInset → main)
│   │   ├── paginas/                       # 6 rotas
│   │   │   ├── Dashboard.tsx              # / — stats + status sistema + CTAs
│   │   │   ├── MemoriaPagina.tsx          # /memoria — 4 tabs (Memorias, Documentos, Relacoes, Avancado)
│   │   │   ├── IaPagina.tsx               # /ia — full page chat (history sidebar + chat area)
│   │   │   ├── GaleriaPagina.tsx          # /galeria — grid + filtros + upload
│   │   │   ├── TerminalPagina.tsx         # /terminal — launcher Terminal IA (sem shell/chat embutido)
│   │   │   ├── ConfiguracoesPagina.tsx    # /configuracoes — tema, IA config, backup, cron, about
│   │   │   └── NaoEncontrado.tsx          # * — 404
│   │   ├── componentes/                   # 25 componentes do app
│   │   │   ├── AppSidebar.tsx             # Sidebar colapsavel (icon mode) — 5 nav items
│   │   │   ├── PageHeader.tsx             # Breadcrumbs + IA toggle + nav arrows
│   │   │   ├── IaChatPanel.tsx            # Painel lateral 380px (Cmd+J toggle)
│   │   │   ├── IaChatView.tsx             # Core: messages, streaming, empty state
│   │   │   ├── IaChatInput.tsx            # Textarea + model pill + send
│   │   │   ├── AdicionarConhecimentoDialog.tsx  # Import dialog multi-step
│   │   │   ├── GraphVisualizer.tsx        # react-force-graph-2d
│   │   │   ├── RagPlayground.tsx          # Search + score visual (dev tool)
│   │   │   ├── GaleriaGrid.tsx            # CSS grid responsivo + lazy loading
│   │   │   ├── GaleriaCard.tsx            # Card individual com favorito + badge
│   │   │   ├── GaleriaDetailModal.tsx     # Preview + metadata + tags editaveis
│   │   │   ├── GaleriaUploadDialog.tsx    # Upload de imagem
│   │   │   ├── onboarding/SetupWizard.tsx # 3-step primeiro boot
│   │   │   └── ... (demais componentes IA/UI)
│   │   ├── components/ui/                 # shadcn/ui (32 componentes, NAO editar)
│   │   ├── store/
│   │   │   ├── iaStore.ts                 # Chat IA: streaming, conversas, mensagens
│   │   │   ├── galeriaStore.ts            # Galeria: imagens, filtros, CRUD (race-guarded)
│   │   │   └── appDataStore.ts            # Cache global + invalidacao IPC
│   │   ├── servicos/
│   │   │   ├── client.ts                  # tipc client (IPC tipado)
│   │   │   ├── conhecimento.ts            # Service: knowledge CRUD + search
│   │   │   ├── terminal.ts                # Service: Terminal Harness
│   │   │   ├── memorias.ts               # Service: memorias CRUD
│   │   │   └── galeria.ts                # Service: gallery CRUD
│   │   ├── hooks/                         # 9 custom hooks (useApiData, useDirtyGuard, useImageBlobUrl, etc)
│   │   └── lib/
│   │       ├── app-info.ts                # APP_NAME, APP_ICON, APP_DESCRIPTION (renderer)
│   │       ├── utils.ts                   # cn() tailwind merge
│   │       ├── cores.ts                   # ENTITY_TYPE_COLORS (generico)
│   │       └── tool-labels.ts             # Labels + tempo estimado de tools
│   │
│   └── shared/
│       ├── types.ts                       # Tipos compartilhados (IA, Knowledge, Backup) — 266 linhas
│       ├── importer-types.ts              # ImportedText, UnifiedConversation, ImportResult, DetectedFormat
│       ├── constants.ts                   # Constantes
│       └── index.ts                       # Re-export
│
├── tests/
│   ├── e2e/                               # 14 testes Playwright + Electron real
│   │   ├── helpers.ts                     # launchApp() com DB isolado por teste
│   │   └── *.spec.ts                      # app, sidebar, dark-mode, wizard, pages, search, memory, etc
│   ├── main/
│   │   ├── importers/                     # 5 test files (registry, chatgpt, claude, pdf, zip)
│   │   ├── knowledge/                     # 5 test files (chunking, ingest, seed, memory, backup)
│   │   └── ia/                            # 2 test files (tool-handlers, discovery)
│   └── fixtures/                          # sample.md, sample-chatgpt.json, sample-claude.json
│
└── data/                                  # PGlite DB dir (dev, gitignored)
```

---

## Padrao IPC (@egoist/tipc)

Router em `src/main/tipc.ts`. Client em `src/renderer/src/servicos/client.ts`.

**CRITICO: Chamada DIRETA de funcao — sem `.invoke()`**
```typescript
// CORRETO
const fontes = await client['knowledge.listarFontes']()
await client['ia.memorias.salvar']({ conteudo: 'fato' })

// ERRADO — NAO usar .invoke()
await client['knowledge.listarFontes'].invoke()
```

---

## Padrao DB (PGlite)

- **Singleton:** `db/pglite.ts` — `initDb()` no boot, `getDb()` depois
- **Helpers:** `db/query.ts` — `queryAll<T>`, `queryOne<T>`, `execute`, `insertReturningId`, `transaction`
- **Schema:** `db/schema.ts` — 14 tabelas com `IF NOT EXISTS`
- **Seed:** `db/seed.ts` — 3 fases (docs → enrichment → graph), roda em background apos window

### Tabelas

| Tabela | Fase | Funcao |
|--------|------|--------|
| `config` | 1 | Key-value store (onboarding, backup, enrichment, terminal, etc) |
| `configuracao_ia` | 1 | Provider IA (Gemini/OpenRouter/Local) + API keys |
| `knowledge_groups` | 2 | Grupos de importacao RAG em massa |
| `knowledge_import_jobs` | 2 | Runs persistentes de importacao em massa |
| `knowledge_import_files` | 2 | Status por arquivo importado |
| `knowledge_sources` | 2 | Fontes importadas (tipo: manual, sistema, importacao_usuario, importacao_conversa) |
| `knowledge_chunks` | 2 | Fragmentos com embedding vector(768) + FTS + trigram |
| `knowledge_entities` | 2 | Entidades do knowledge graph (tipos dinamicos) |
| `knowledge_relations` | 2 | Relacoes entre entidades (peso 0-1) |
| `ia_conversas` | 3 | Conversas com IA |
| `ia_mensagens` | 3 | Mensagens de chat |
| `ia_memorias` | 2 | Memorias persistentes (manual + auto, max 50) |
| `gallery_images` | 4 | Galeria de imagens (plantada, funcional Spec 4) |
| `terminal_command_log` | 5 | Auditoria de comandos executados pelo Terminal Harness |

---

## Importers (Registry Pattern)

Cada formato tem seu importer isolado. Se um falha, os outros funcionam.

| Importer | Formato | Saida |
|----------|---------|-------|
| `text-importer` | .md, .txt, .html | `ImportedText` |
| `pdf-importer` | .pdf | `ImportedText` |
| `chatgpt-importer` | .json (mapping) | `ImportedConversations` (DFS) |
| `claude-importer` | .json (chat_messages) | `ImportedConversations` |
| `zip-importer` | .zip | Extrai JSONs → roteia |

`detectFormat(filePath)` detecta automaticamente. `importFile(filePath)` roteia pro importer certo.

---

## Arquitetura IA (3 Familias de Tools)

O LLM ve EXATAMENTE 3 tools. Routing interno traduz pra handlers reais:

| Familia | Handlers |
|---------|----------|
| `consultar_contexto` | buscar_conhecimento, explorar_relacoes, listar_conhecimento, status_sistema, listar_galeria |
| `editar_ficha` | salvar_memoria, remover_memoria, salvar_conhecimento |
| `executar_acao` | fazer_backup, terminal_exec |

### Readiness IA

Antes de chat app ou CLI, `ia/readiness.ts` precisa dizer `ready`.

| Reason | O que significa |
|--------|-----------------|
| `configure_provider` | provider ausente/desativado |
| `configure_cloud_token` | Gemini/OpenRouter sem chave |
| `download_local_model` | modelo local ausente |
| `validate_local_model` | GGUF existe, mas ainda precisa passar em Testar conexao |
| `local_model_error` | load falhou |
| `ready` | chat liberado |

O `/health` deve refletir isso. `Ativa` na UI so pode aparecer para provider/modelo
que `ia.capabilities.obter` marca como disponivel; para IA local, isso exige
`usable === true`.

### IA local

Modelo local padrao: `gemma-4-e2b-it-q4` (Gemma 4 E2B IT, GGUF Q4_K_M).

Gemma 4 roda via `llama-server` recente, nao pelo path antigo puro de
`node-llama-cpp`, porque a versao instalada nao carrega arquitetura `gemma4`.
O runtime local fica em `ia/llama-server-runtime.ts`, sobe com contexto `8192`,
`--jinja` e `--reasoning off`, e alimenta chat, tool calling e enrichment JSON.

### Ditado local STT

Parakeet/Handy é transcript-first: a UI injeta transcrição literal no input e
chama STT com `post_process: false`. `post_process: true` ainda nao é
implementado e precisa retornar erro claro, nao uma limpeza falsa por IA.

### Discovery (Auto-Context)

`discovery.ts` → `buildContextBundle()` retorna contexto injetado em CADA mensagem:
- `global` — stats (fontes, chunks, entidades, memorias) via Promise.all
- `memorias` — todas ia_memorias (max 50), sempre injetadas
- `rag` — auto-RAG: busca semantica com mensagem do usuario
- `knowledge_catalogo` — top fontes com stats
- `dica_pagina` — hint por rota (dashboard, memoria, ia, galeria, configuracoes)

---

## Layout Chain (CRITICO — 6 regras)

```
h-svh → SidebarProvider → SidebarInset → main (UNICO scroll owner)
```

1. `SidebarProvider` recebe `className="h-svh overflow-hidden"`
2. `SidebarInset` recebe `className="h-full min-h-0 overflow-hidden"`
3. `<main>` e o UNICO elemento com `overflow-auto`
4. Paginas NUNCA definem height/overflow — o main cuida
5. Chat panel usa width animation (`w-[380px]`/`w-0`, nao position)
6. Sidebar colapsavel via `collapsible="icon"` (3rem width)

---

## Tailwind v4 — ATENCAO CSS Variables

**OBRIGATORIO usar `var()` explicito em arbitrary values:**
```css
/* CORRETO */
w-[var(--sidebar-width)]
h-[var(--minha-var)]
max-h-[var(--radix-content-height)]

/* ERRADO — gera CSS invalido no v4 */
w-[--sidebar-width]
h-[--minha-var]
```

---

## Branding Configuravel

**Main:** `src/main/config/app-config.ts` → `APP_CONFIG`
**Renderer:** `src/renderer/src/lib/app-info.ts` → `APP_NAME`, `APP_ICON`, `APP_DESCRIPTION`

### Para renomear o projeto:
1. `app-config.ts` → `name`, `icon`, `dbName`
2. `app-info.ts` → `APP_NAME`, `APP_ICON`
3. `package.json` → `name`, `productName`
4. `electron-builder.yml` → `productName`, `appId`

---

## Seed (Self-Knowledge)

**O que vem no Git (seed mínimo de teste / demo):** tudo é **arquivo local** em `knowledge/` — **não** chama internet para importar esses docs.

1. **Phase 1:** Ingest `knowledge/sistema/` (`CLAUDE.md`, `ARCHITECTURE.md`, `PLUG-AND-PLAY.md`) → chunks; embeddings gerados se o modelo ONNX já estiver baixado.
2. **Phase 2:** Aplica `knowledge/seed/enrichment-seed.json` (tags, resumos pré-computados).
3. **Phase 3:** Importa `knowledge/seed/graph-seed.json` (entidades/relações do stack).

**Primeira execução:** o download do modelo de embedding (~400MB) pode ocorrer uma vez; depois o pipeline de seed/embeddings é **offline**. Se o modelo não estiver pronto, o seed ainda grava texto + FTS; vetores ficam para quando o modelo existir.

**Opcional (não versionado):** `src/main/db/seed-local.ts` — listado no `.gitignore` para overrides locais; **não é importado** por `seed.ts` (não quebra clone/teste se o arquivo não existir).

Roda em **background** (não bloqueia o startup). **Idempotente** (se já existir `knowledge_sources` tipo `sistema`, pula).

---

## Ferramentas Disponiveis

- **shadcn MCP:** `mcp__shadcn__*` — buscar, ver, instalar componentes
- **FlowKit MCP:** stdio via `npm run mcp` — consultar_contexto, editar_ficha, executar_acao, terminal
- **Computer Use:** `mcp__computer-use__*` — screenshots, clicks (se habilitado)

---

## O Que Funciona Agora

- ✅ App abre com sidebar colapsavel, dark mode, wizard
- ✅ Import de .md, .txt, .pdf, .json (ChatGPT/Claude), .zip
- ✅ Bulk RAG import por modal/CLI com grupo, job persistente, pause/resume/cancel
- ✅ Bulk RAG termina `partial` com aviso quando dados entram mas arquivo/enrichment falha
- ✅ Busca hibrida (vetor 70% + FTS 30%) com score
- ✅ Enrichment configuravel por `auto`, local, Gemini ou OpenRouter
- ✅ Knowledge graph (entidades + relacoes + visualizacao)
- ✅ Memorias CRUD (manual, max 50)
- ✅ MemoriaPagina com 4 tabs funcionais
- ✅ Seed auto-popula no primeiro boot
- ✅ Backup/restore manual
- ✅ Chat IA streaming (Gemini direto, OpenRouter e local Gemma 4) com tool calling
- ✅ Readiness/preflight de IA antes de chat e CLI
- ✅ System prompt expandido (~200 linhas cloud, ~60 local)
- ✅ Session compaction (30K token threshold)
- ✅ Auto-memory extraction (fatos, preferencias, correcoes)
- ✅ Error handling amigavel (401/403/429)
- ✅ CLI/Core API: chat, search/import legados, tools, jobs, RAG, terminal e MCP
- ✅ Terminal Harness: exec/read/write/open-cli + shell local na UI + auditoria
- ✅ Terminal IA launcher resolve comando correto em dev/empacotado antes de abrir Terminal
- ✅ MCP server stdio (familias IA + resources + terminal)
- ✅ Discovery retorna contexto real (stats, memorias, RAG, page hints)
- ✅ Galeria de imagens (upload, grid, detail modal, tags, favoritos)
- ✅ Cron IA pipeline (6 steps: guard, enrichment, memory, session indexing, lazy decay, log)
- ✅ Vitest + E2E cobrindo contratos principais
- ✅ Tool handlers funcionam via IPC/CLI/MCP/tool-server (11 handlers internos)

## Ideias / roadmap opcional (não bloqueia o kit)

- ⬜ Gemini Embedding 2 — image RAG multimodal (cross-modal search)
- ⬜ AI image analysis (vision, tags automáticas)
- ⬜ CLI com streaming real (SSE)
- ⬜ Empacotar runtime `llama-server` de forma versionada para distribuicao fora deste worktree

---

## CLI

```bash
npm run cli -- status                                # Stats do sistema
npm run cli -- chat "mensagem"                       # Chat IA com preflight
npm run cli -- search "query"                        # Busca RAG legada
npm run cli -- import ./file                         # Import simples legado
npm run cli -- tools                                 # Listar tools internas
npm run cli -- tool status_sistema                   # Chamar tool interna
npm run cli -- rag search "query"                    # Busca RAG
npm run cli -- rag import ./pasta --group Docs --wait
npm run cli -- rag import ./pasta --group Docs --enrich --wait
npm run cli -- rag enrich --group 1 --provider local --model gemma-4-e2b-it-q4 --force-all
npm run cli -- rag jobs
npm run cli -- terminal exec --wait --cwd "$HOME" pwd
npm run cli -- terminal open-cli
```

Conecta via HTTP no tool-server (porta 17380). Requer app rodando. O `/health`
é aberto; endpoints de ação exigem token local de sessão, lido automaticamente
pelo CLI/MCP via env/arquivo temporário.

### Prova real obrigatoria

Para IA/RAG/CLI/Terminal, teste que so abre tela nao basta:

- Chat IA: registrar mensagem enviada e resposta literal.
- RAG: provar job `done` ou `partial` explicado, busca por token unico e rows no banco.
- Enrichment: provar `provider/modelo`, contadores e `enriched_at`/`enrichment_json`, ou motivo claro de nao execucao.
- Terminal tool: provar `terminal_command_log.source = 'ia_tool'` e efeito real.
- Terminal CLI: provar `opened: true` e saida capturada.

Ver `docs/IA-RAG-CLI-TERMINAL.md`.

## MCP Server

```bash
npm run mcp   # Inicia server stdio
```

Expoe 6 tools (`consultar_contexto`, `editar_ficha`, `executar_acao`, `terminal_exec`, `terminal_open_cli`, `terminal_read_file`) e 5 resources (`knowledge://sources`, `knowledge://stats`, `memory://list`, `system://instructions`, `app://health`).
Config em `.mcp.json` para auto-discovery do Claude Code.

---

## Convencoes

- **UI:** Portugues (labels, mensagens, nomes de pagina)
- **DB:** Colunas em portugues (`ativo`, `nome`, `criada_em`). Excecao: knowledge usa mix
- **Arquivos:** Nomes em ingles
- **Soft delete:** `ativo = false`
- **PKs:** SERIAL para knowledge/memorias, TEXT UUID para gallery/conversas
- **Timestamps:** TIMESTAMPTZ com `DEFAULT NOW()`
- **Imports:** `@/` = renderer/src, `@shared/` = shared/
- **Tool responses:** `toolOk(data, { summary, meta })` / `toolError(code, msg, { correction })`
