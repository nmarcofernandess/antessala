# Provas Terminal IA — FlowKit

Documento historico de uma prova local. Os paths, branch e worktree abaixo
registram aquela execucao; nao sao contrato copiavel para novas validacoes.

Data/hora: 2026-06-14 02:26:07 -03  
Worktree: `/Users/marcoantonio/flowkit-terminal-ia`  
Branch: `codex/terminal-ia-launcher`  
Commit base no momento da prova: `39a6f59` + alteracoes locais do fix `npm --prefix`

## Escopo provado

- Pagina Terminal IA sem input interativo de comando/mensagem: provado por teste renderer.
- Botao/copy principal: `Abrir IA no Terminal do Sistema`; comando visivel e copiavel.
- Readiness antes de abrir Terminal: provado por endpoint `/terminal/ai-status` e `/terminal/open-ai-terminal`.
- Sem config valida: endpoint bloqueou com `configMissing` e nao abriu Terminal.
- Com config local valida: endpoint retornou `ready` e abriu Terminal.app.
- CLI e chat lateral usam provider/modelo resolvido `local / gemma-4-e2b-it-q4`.
- Piada do padeiro: transcript real no CLI, chat lateral e Terminal.app.
- Tool de terminal: escreveu arquivo real em path com espaco e leu o conteudo.
- Path com espaco: bug encontrado no wrapper antigo, corrigido com `npm --prefix`.

## Comandos automatizados

```bash
npm run typecheck
npm test -- tests/main/tool-server-contract.spec.ts tests/shared/ai-terminal-contract.spec.ts tests/main/terminal/ai-terminal-builders.spec.ts tests/main/ia/runtime-readiness.spec.ts tests/renderer/terminal-page.spec.tsx
npm test
npm run build
```

Resultados:

- `npm run typecheck`: passou.
- Testes especificos: 5 arquivos, 28 testes passaram.
- `npm test`: 56 arquivos, 263 testes passaram.
- `npm run build`: passou; warnings existentes de dynamic/static import do Vite, sem falha.

## Readiness real

Primeira verificacao, sem config:

```json
{
  "status": "ok",
  "readiness": {
    "ok": false,
    "code": "configMissing",
    "message": "Configure provider e modelo antes de abrir o Terminal.",
    "runtime": {
      "provider": null,
      "model": null,
      "toolsAvailable": true,
      "toolsCount": 11
    },
    "command": "npm --prefix '/Users/marcoantonio/flowkit' run cli -- chat --attach",
    "cwd": "/tmp/FlowKit Proof Path With Spaces"
  }
}
```

Tentativa de abrir Terminal sem config:

```http
HTTP/1.1 409 Conflict
```

Retorno:

```json
{
  "opened": false,
  "status": "blocked",
  "error_message": "Configure provider e modelo antes de abrir o Terminal."
}
```

Depois de configurar provider local no banco dev da worktree e validar modelo:

```json
{
  "ok": true,
  "code": "ready",
  "runtime": {
    "provider": "local",
    "model": "gemma-4-e2b-it-q4",
    "displayName": "local:gemma-4-e2b-it-q4",
    "toolsAvailable": true,
    "toolsCount": 11,
    "validatedAt": "2026-06-14T05:25:29.909Z"
  },
  "command": "npm --prefix '/Users/marcoantonio/flowkit-terminal-ia' run cli -- chat --attach",
  "cwd": "/tmp/FlowKit Proof Path With Spaces"
}
```

## Chat lateral

Execucao via Playwright Electron no app real. Para o build empacotado enxergar o mesmo modelo local do dev runtime, foram usados:

```bash
FLOWKIT_DB_PATH=/Users/marcoantonio/flowkit-terminal-ia/data/flowkit-pg
FLOWKIT_LOCAL_MODELS_DIR="$HOME/Library/Application Support/FlowKit/models"
FLOWKIT_USER_DATA_DIR="$HOME/Library/Application Support/FlowKit"
```

Screenshot: `/tmp/flowkit-side-chat-padeiro.png`

Prompt:

```text
me conta uma piada de padeiro
```

Resposta literal:

```text
Claro! Aqui está uma piada de padeiro:

Por que o padeiro foi ao médico?

... Porque ele estava com fermento!

[Fonte: "Piada"]
```

## CLI direto

Comando:

```bash
npm run cli -- chat "me conta uma piada de padeiro" | tee /tmp/flowkit-cli-padeiro.txt
```

Resposta literal:

```text
Claro! Aqui está uma piada de padeiro:

**Por que o padeiro foi ao médico?**

... Porque ele estava com **fermento**!

[Fonte: "Piada"]
```

## Terminal.app via launcher

Comando de abertura:

```bash
curl -s -X POST http://127.0.0.1:17380/terminal/open-ai-terminal \
  -H 'Content-Type: application/json' \
  --data '{"cwd":"/tmp/FlowKit Proof Path With Spaces"}'
```

Retorno:

```json
{
  "status": "ok",
  "result": {
    "opened": true,
    "command": "npm --prefix '/Users/marcoantonio/flowkit-terminal-ia' run cli -- chat --attach",
    "cwd": "/tmp/FlowKit Proof Path With Spaces",
    "status": "dispatched"
  }
}
```

Terminal.app:

```text
FlowKit IA no Terminal
CWD: /tmp/FlowKit Proof Path With Spaces
Comando: npm --prefix '/Users/marcoantonio/flowkit-terminal-ia' run cli -- chat --attach

> flowkit@1.8.2 cli
> npx tsx src/cli/index.ts chat --attach

FlowKit chat conectado e IA validada. Digite "sair" para encerrar.
Voce > me conta uma piada de padeiro
IA > Claro! Aqui está uma piada de padeiro:

**Por que o padeiro foi ao médico?**

... Porque ele estava com **fermento**!

[Fonte: "Piada"]
Voce >
```

## Tool/arquivo

Comando:

```bash
npm run cli -- tool terminal_exec --json '{"command":"printf flowkit-terminal-tool-proof > proof.txt && cat proof.txt","cwd":"/tmp/FlowKit Proof Path With Spaces","timeout_ms":5000}'
```

Resultado:

```json
{
  "status": "ok",
  "summary": "Terminal terminou com exit_code 0.",
  "result": {
    "command": "printf flowkit-terminal-tool-proof > proof.txt && cat proof.txt",
    "cwd": "/tmp/FlowKit Proof Path With Spaces",
    "exit_code": 0,
    "stdout": "flowkit-terminal-tool-proof",
    "stderr": "",
    "timed_out": false
  },
  "_meta": {
    "tool_kind": "terminal"
  }
}
```

Arquivo:

```text
/tmp/FlowKit Proof Path With Spaces/proof.txt
flowkit-terminal-tool-proof
```

## Falhas encontradas e correcoes

1. Sem config inicial:
   - Estado real: `configMissing`.
   - Resultado correto: `/terminal/open-ai-terminal` retornou 409 e `opened:false`.

2. Sem credencial cloud:
   - `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY` e `FLOWKIT_GEMINI_API_KEY` ausentes.
   - Caminho usado: provider local.

3. Playwright empacotado nao via o modelo local:
   - Estado real: `modelDownloadRequired`.
   - Causa: runtime empacotado/teste usava outro diretorio de modelos.
   - Correcao da prova: passar `FLOWKIT_LOCAL_MODELS_DIR` e `FLOWKIT_USER_DATA_DIR`.

4. Path com espaco abriu Terminal mas falhou antes do fix:
   - Comando antigo: `npm run cli -- chat --attach`.
   - Falha: `npm error enoent Could not read package.json` em `/private/tmp/FlowKit Proof Path With Spaces/package.json`.
   - Correcao de produto: readiness monta `npm --prefix '<repo>' run cli -- chat --attach` em dev e `node '<resources>/cli/index.js' -- chat --attach` no app empacotado.
   - Reprova corrigida: Terminal.app abriu em cwd com espaco e o CLI attach respondeu.

## O que nao foi declarado como pronto

- Nao foi declarado sucesso quando a IA estava `configMissing`.
- Nao foi declarado sucesso quando o build Playwright estava `modelDownloadRequired`.
- Nao foi contado "Terminal abriu" como sucesso de IA; o sucesso so foi registrado apos transcript literal.
