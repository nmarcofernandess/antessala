# IA, RAG, CLI e Terminal — Fluxo Operacional

Este documento descreve o fluxo vivo do FlowKit para IA local/cloud, RAG em massa,
enrichment, CLI e Terminal Harness.

Ele existe para evitar um erro especifico: declarar sucesso porque a tela abriu,
sem provar que a IA respondeu, que o RAG importou, que o enrichment gravou no
banco ou que o terminal executou de verdade.

## Componentes

| Camada | Arquivos | Papel |
|--------|----------|-------|
| IA config | `src/main/ia/config.ts` | provider/modelo/token |
| Readiness | `src/main/ia/readiness.ts` | decide se chat/CLI pode rodar |
| Readiness Terminal IA | `src/main/ia/runtime-readiness.ts` | matriz concreta antes de abrir Terminal |
| IA local | `src/main/ia/local-llm.ts` | catalogo, download, status, validacao |
| Runtime local | `src/main/ia/llama-server-runtime.ts` | sidecar `llama-server` para Gemma 4 |
| Tools | `src/main/ia/tools.ts` | 11 handlers internos |
| Familias | `src/main/ia/tool-families.ts` | 3 tools publicas do LLM |
| RAG bulk | `src/main/knowledge/bulk-import.ts` | scan/importacao em massa |
| RAG jobs | `src/main/knowledge/bulk-persistence.ts` | grupos, runs, arquivos |
| Enrichment config | `src/main/knowledge/enrichment-config.ts` | modelo/provider do enrichment |
| Enrichment | `src/main/knowledge/enrichment.ts` | resumo/tags/graph + re-embedding |
| Terminal launcher | `src/main/terminal/harness.ts`, `open-system-terminal.ts`, `terminal-wrapper.ts` | exec/read/write + abertura do Terminal do sistema |
| Terminal sessions | `src/main/terminal/sessions.ts` | primitivo de shell vivo para API/teste |
| Contrato launcher | `src/shared/terminal-launch-contract.ts`, `ai-runtime-contract.ts` | comando, copy e matriz compartilhada |
| CLI | `src/cli/index.ts` | cliente HTTP para app aberto |
| Tool server | `src/main/tool-server.ts` | HTTP local `127.0.0.1:17380`; `/health` aberto, ações protegidas por token local |

## IA local

Modelo local padrao:

| Campo | Valor |
|-------|-------|
| ID | `gemma-4-e2b-it-q4` |
| Label | Gemma 4 E2B IT |
| Arquivo | `gemma-4-E2B-it-Q4_K_M.gguf` |
| Tamanho esperado | ~3.11 GB |
| RAM minima | 4GB+ |
| Uso | chat, tools e enrichment |

O FlowKit usa `llama-server` recente para Gemma 4, porque o `node-llama-cpp`
instalado ainda nao carrega arquitetura `gemma4`.

Ordem de descoberta do binario:

1. `FLOWKIT_LLAMA_SERVER_BIN`
2. `~/Library/Application Support/FlowKit/runtimes/llama.cpp/<platform>-<arch>/llama-server`
3. `runtimes/llama.cpp/<platform>-<arch>/llama-server`
4. `tmp/llama-gemma4-build/bin/llama-server`
5. `process.resourcesPath/llama.cpp/...` no app empacotado

Parametros atuais:

- host: `127.0.0.1`
- porta: livre, escolhida em runtime
- contexto: `8192`
- flags: `--jinja --reasoning off`
- chat endpoint: `/v1/chat/completions`

## Readiness

`baixado` nao significa `pronto`. O gate de chat fica em `ia/readiness.ts`.

| Reason | Pode conversar? | Mensagem esperada |
|--------|-----------------|-------------------|
| `configure_provider` | nao | configurar provider |
| `configure_cloud_token` | nao | informar API key/token |
| `download_local_model` | nao | baixar modelo local |
| `validate_local_model` | nao | testar conexao antes de usar |
| `local_model_error` | nao | remover/baixar novamente ou trocar provider |
| `ready` | sim | provider/modelo pronto |

O CLI e o chat app devem passar por readiness antes de aceitar mensagem. O
`/health` tambem expõe esse estado para scripts e smoke tests.

Para a pagina Terminal IA existe uma matriz adicional em
`src/main/ia/runtime-readiness.ts`. Ela nao substitui `ia/readiness.ts`; ela
embrulha o gate de chat com CLI, SO, tools e comando resolvido.

| Code | Abre Terminal? | Causa |
|------|----------------|-------|
| `configMissing` | nao | provider/modelo ausente |
| `credentialMissing` | nao | token/API key ausente |
| `modelDownloadRequired` | nao | modelo local ausente |
| `modelNeedsValidation` | nao | arquivo existe, mas ainda precisa passar em Testar conexao |
| `modelLoadingFailed` | nao | load falhou apos validacao/tentativa de uso |
| `cliMissing` | nao | CLI nao existe neste build |
| `toolsUnavailable` | nao | tool de terminal/arquivo indisponivel |
| `osUnsupported` | nao | abertura automatica sem suporte |
| `ready` | sim | provider/modelo/CLI/tools prontos |

O contrato compartilhado reserva outros codigos para evolucao futura, mas o
runtime atual emite apenas os estados acima.

## RAG bulk import

### UI

O modal de conhecimento aceita importacao de arquivo/pasta. Para massa:

1. Usuario escolhe pasta ou arquivo.
2. Usuario informa apenas o nome do grupo.
3. FlowKit cria `knowledge_groups`.
4. FlowKit cria `knowledge_import_jobs`.
5. Cada arquivo vira linha em `knowledge_import_files`.
6. Cada arquivo valido passa por ingestao e cria `knowledge_sources` +
   `knowledge_chunks`.
7. O job mostra progresso e permite pausa/retomada/cancelamento enquanto o worker esta vivo.

### CLI

```bash
npm run cli -- rag import ~/Documents/minha-pasta --group "Meu Grupo" --wait
```

Com enrichment forcado:

```bash
npm run cli -- rag import ~/Documents/minha-pasta --group "Meu Grupo" --enrich --wait
```

Status final honesto:

- `done`: arquivos importados e enrichment, quando solicitado, concluiu sem erro.
- `partial`: houve arquivo com erro ou enrichment indisponivel/falho depois de importar dados. A UI mostra aviso; `rag import --wait` sai com codigo 2.
- `failed`: falha estrutural impediu o job de concluir.

Inspecionar jobs:

```bash
npm run cli -- rag jobs
npm run cli -- rag job <id>
npm run cli -- rag pause <id>
npm run cli -- rag resume <id>
npm run cli -- rag cancel <id>
```

## Enrichment

Config global:

| Campo | Default | Significado |
|-------|---------|-------------|
| `auto_enrich_after_import` | `false` | se import dispara enrichment automaticamente |
| `provider` | `auto` | `auto`, `local`, `gemini`, `openrouter` |
| `modelo` | `auto` | modelo especifico ou auto |
| `force_all_default` | `false` | reprocessar chunks ja enriquecidos |

Resolucao `auto`:

1. Prefere modelo local disponivel e validado.
2. Se local nao estiver disponivel, usa provider cloud ativo com chave.
3. Se provider ativo nao servir, usa qualquer cloud configurado.
4. Se nada estiver disponivel, nao roda.

Comando manual:

```bash
npm run cli -- rag enrich --group <id> --provider local --model gemma-4-e2b-it-q4 --force-all
```

Resultado esperado:

```json
{
  "status": "ok",
  "result": {
    "chunks_enriquecidos": 1,
    "entities_count": 3,
    "relations_count": 2,
    "batches_processados": 1,
    "batches_failed": 0,
    "provider": "local",
    "modelo": "gemma-4-e2b-it-q4"
  }
}
```

Prova no banco:

```sql
SELECT id, source_id, enriched_at, enrichment_json
FROM knowledge_chunks
WHERE source_id = $1
ORDER BY id;
```

O enrichment so conta como feito se `enriched_at` e `enrichment_json` foram
gravados, e se a busca encontra o conteudo importado.

Se o enrichment foi solicitado mas nao ha modelo/token valido, o import termina
`partial` com `error_message` explicito; isso nao pode ser apresentado como
sucesso verde.

## Ditado STT Parakeet/Handy

O ditado local é transcript-first. A UI do chat chama STT com
`post_process: false` e injeta o texto bruto transcrito no input.

Contratos atuais:

- `post_process: true` retorna erro claro: pos-processamento ainda nao foi
  implementado.
- Status de modelo separa `source`: `bundled`, `user` ou `missing`.
- Modelo bundled nao é deletavel pela UI; modelo em install path do usuario é.
- Sidecar STT só conta como disponivel se existir e for executavel.

## CLI

O CLI exige app aberto porque fala com o tool-server HTTP local. O CLI e o MCP
incluem automaticamente o token local de sessão; requests manuais para endpoints
de ação precisam enviar `x-flowkit-tool-token` ou `Authorization: Bearer`.

Health:

```bash
curl -s http://127.0.0.1:17380/health
```

Chat:

```bash
npm run cli -- chat "Me conta uma piada de padeiro."
```

Tool direta:

```bash
npm run cli -- tool status_sistema
```

RAG:

```bash
npm run cli -- rag search "termo unico"
```

Terminal:

```bash
npm run cli -- terminal exec --wait --cwd "$HOME" pwd
npm run cli -- terminal read ~/arquivo.txt
printf 'conteudo' | npm run cli -- terminal write ~/arquivo.txt --stdin
```

Readiness do launcher Terminal IA:

```bash
curl -s "http://127.0.0.1:17380/terminal/ai-status?cwd=$PWD"
```

## Terminal Harness

Existem tres conceitos separados:

| Conceito | O que e |
|----------|---------|
| `terminal_exec` | comando shell pontual, auditado |
| Terminal session | shell local vivo usado por API/testes; nao e a UX principal da pagina Terminal IA |
| Terminal IA launcher | roda readiness e abre o CLI oficial no Terminal do sistema |

`terminal_exec` roda com as permissoes do usuario local. Ele aplica:

- `cwd`
- timeout maximo
- limite de saida
- captura de stdout/stderr
- auditoria em `terminal_command_log`

Campos de auditoria:

- `source`
- `command`
- `cwd`
- `status`
- `exit_code`
- `timed_out`
- `output_preview`
- `started_at`
- `finished_at`

Quando o LLM usa terminal, `source` deve ser `ia_tool`.

## Terminal nao e chat

A pagina Terminal IA nao renderiza input interativo de comando ou mensagem. Ela
e um launcher: mostra readiness, provider/modelo resolvido, comando real,
botao `Copiar comando` e botao `Abrir IA no Terminal do Sistema`.

O clique principal chama readiness antes da abertura. Se faltar config,
credencial, modelo, CLI, tool ou suporte de SO, a UI abre modal de configuracao
e nao dispara Terminal quebrado.

Abrir chat no Terminal em dev:

```bash
npm --prefix /caminho/do/flowkit run cli -- chat --attach
```

No app empacotado, o launcher usa o CLI empacotado via `node
<resources>/cli/index.js -- chat --attach`.

Capturar uma chamada fechada:

```bash
npm run cli -- chat "Me conta uma piada de padeiro." | tee /tmp/flowkit-terminal-padeiro.txt
```

## Superficie de chat e voz (AI Elements)

A UI de chat e voz foi migrada para componentes Vercel AI Elements vendorizados em
`src/renderer/src/components/ai-elements/`, envolvidos por wrappers FlowKit em
`src/renderer/src/componentes/ai/`:

| Wrapper | Papel |
|---------|-------|
| `ai-elements-adapters.ts` | mapeia dados de chat FlowKit (ToolCall, IaMensagem, tools em andamento, snapshot de voz) para `UIMessage`/parts do AI SDK v6 |
| `FlowMessage` / `FlowToolCalls` | renderizam mensagens e tool calls; `IaMensagemBubble`/`IaToolCallsCollapsible` viraram re-exports compatíveis |
| `FlowPromptInput` | input de chat (textarea + envio + anexo + badge de modelo + slot de voz) |
| `FlowSpeechInput` / `FlowTranscriptionStatus` | ditado local transcript-first |

Regras que a migração preserva (e que a prova de runtime deve confirmar):

- **Uma única superfície de status de tool.** `tools_em_andamento` e
  `tool_calls_parciais` renderizam pelo mesmo `FlowToolCalls` (estados
  `Executando`/`Concluída`/`Erro`); o antigo `ToolProgressPill` foi removido — não
  pode haver dois indicadores competindo.
- **Streaming honesto.** O texto parcial renderiza por `MessageResponse`
  (`data-testid="ia-streaming-text"`) e some quando a mensagem persistida assume.
- **Transcript-first de verdade.** O ditado chama STT com `post_process: false` e a
  UI nunca afirma limpeza/reescrita por IA. `post_process: true` segue não
  implementado e deve falhar com erro claro, não com limpeza falsa.

Evidência de validação desta migração: `docs/superpowers/evidence/2026-06-14-ai-elements-validation.md`.

## Prova real obrigatoria

Fluxos de IA/RAG/CLI/Terminal nao podem ser validados so com screenshot ou E2E
que abre pagina.

| Fluxo | Prova minima |
|-------|--------------|
| IA chat | mensagem enviada + resposta literal |
| RAG import | job `done` ou `partial` explicado + source/chunks + busca por token unico |
| Enrichment | provider/modelo + contadores + `enriched_at`/`enrichment_json`, ou motivo claro de nao execucao |
| Terminal tool | linha em `terminal_command_log` + efeito no disco/saida |
| Terminal IA launcher | readiness `ready` + wrapper/comando + abertura do Terminal do sistema |
| Terminal CLI | resposta literal capturada do CLI/Terminal |

Exemplo de resposta que deve ser copiada no log:

```text
Mensagem enviada:
Me conta uma piada de padeiro.

Resposta recebida:
Claro! Aqui está uma piada de padeiro:
Por que o padeiro foi ao médico?
... Porque ele estava com fermento!
```

## Comandos de validacao

Antes de declarar pronto:

```bash
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Se `npm run test` falhar por app dev ocupando `127.0.0.1:17380`, pare o app,
confirme a porta livre e rode de novo. Nao conte a primeira falha como verde.

```bash
lsof -nP -iTCP:17380 -sTCP:LISTEN || true
```

## Maiá (companion macOS) — voz, cérebro local e visão honesta

A Maiá (`src/main/maia/*`) é camada fina sobre o FlowKit. Roteia pela IA via a
rota `maia_command` (herda a global = Gemma 4 local por padrão).

- **Voz:** `src/main/maia/tts/openai-tts.ts` → `speakViaProvider()` é o ponto
  único de fala. OpenAI com chave gera **WAV real** (`/v1/audio/speech`,
  `response_format:'wav'`, `gpt-4o-mini-tts`) tocado por `afplay`; sem chave cai
  no `say`. Config em Configurações → **"Voz da Maiá"** (tabela `config`, key
  `maia_voice`). 401/403 → erro acionável.
- **Cérebro local:** texto pelo Gemma 4 via `llama-server` (provado offline).
- **Visão local (gated):** catálogo tem o `mmproj` (`mmproj-F16.gguf`);
  `detectVisionSupport()` faz probe real (mmproj baixado + `--mmproj` carrega).
  Sem isso, visão fica off declarado. `buildMessages` só emite `image_url`
  quando a visão está ligada — nunca manda imagem a rota sem visão.
- **Capability snapshot:** `src/main/maia/capabilities.ts` →
  `getMaiaCapabilities()` agrega permissões + hotkey + rota + voz + visão.
  `supportsScreenshot = visão real && Screen Recording`. A UI só ativa o que
  cumpre; resto é roadmap desativado/declarado.

### Prova real obrigatória (Maiá)

Gated por `FLOWKIT_REAL_AI_TESTS=1` + recurso presente (fora do `npm test` padrão):

```bash
source ~/.zshrc.local   # OPENAI_API_KEY
FLOWKIT_REAL_AI_TESTS=1 npx vitest run \
  tests/main/maia/tts-openai-real.spec.ts \
  tests/main/maia/maia-voice-flow-real.spec.ts \
  tests/main/ia/gemma-local-real.spec.ts
```

- Voz OpenAI: WAV válido (`RIFF`/`WAVE`, bytes > limiar), não erro disfarçado.
- Gemma local: resposta real não-vazia offline; visão só liga se o probe passa.

Evidência arquivada: `docs/superpowers/evidence/2026-06-15-maia-mvp-validation.md`.

## Warlog local

O incidente que originou este contrato pode ter warlog local em
`docs/superpowers/warlogs/`, mas essa pasta e ignorada para novos artefatos de
agente. A fonte versionada e este documento.
