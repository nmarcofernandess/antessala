# Plug-and-Play — FlowKit

8 receitas pra estender o kit. Cada uma com arquivos exatos e o que adicionar.

> **IMPORTANTE — Tailwind v4 e CSS Variables:**
> No Tailwind v4, use `var()` explicito em arbitrary values.
> `w-[var(--minha-var)]` (CORRETO) — `w-[--minha-var]` (ERRADO, gera CSS invalido no v4).

---

## 1. Renomear o projeto

Trocar "FlowKit" pelo nome do seu app.

**Arquivos:**

1. `src/shared/app-identity.ts` — mudar identidade compartilhada por main,
   renderer, CLI e Terminal IA:
   ```ts
   export const APP_IDENTITY = {
     appName: 'MeuApp',
     productName: 'MeuApp',
     assistantName: 'Assistente IA',
     terminalAgentName: 'Assistente IA no Terminal',
     cliName: 'meuapp',
     cliDisplayName: 'MeuApp CLI',
     cliNpmScript: 'npm run cli',
     enableTerminalLauncher: true,
   } as const
   ```

2. `src/main/config/app-config.ts` — mudar `icon`, `description`, `dbName`
   e manter `name` vindo de `APP_IDENTITY.appName`:
   ```ts
   export const APP_CONFIG = {
     name: APP_IDENTITY.appName,
     icon: 'Rocket',        // nome do icone lucide-react
     description: 'Descricao curta',
     dbName: 'meuapp-pg',   // diretorio do PGlite em userData
     // ... resto fica igual
   }
   ```

3. `src/renderer/src/lib/app-info.ts` — manter `APP_NAME` vindo de
   `APP_IDENTITY.appName` e mudar icone/descricao:
   ```ts
   export const APP_NAME = APP_IDENTITY.appName
   export const APP_ICON = 'Rocket'
   export const APP_DESCRIPTION = 'Descricao curta'
   ```

4. `package.json` — mudar `name` e `productName`:
   ```json
   { "name": "meuapp", "productName": "MeuApp" }
   ```

5. `electron-builder.yml` — mudar `productName` e `appId`:
   ```yaml
   appId: com.meuapp.desktop
   productName: MeuApp
   ```

6. (Opcional) `src/renderer/src/componentes/AppSidebar.tsx` — mudar o `AvatarFallback` de "FK" para suas iniciais.

---

## 2. Adicionar uma pagina

**Passo 1 — Criar pagina:**
Criar `src/renderer/src/paginas/MinhaPagina.tsx`:
```tsx
export function MinhaPagina() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Minha Pagina</h1>
    </div>
  )
}
```

**Passo 2 — Adicionar rota:**
Em `src/renderer/src/App.tsx`, importar e adicionar no router:
```tsx
import { MinhaPagina } from './paginas/MinhaPagina'

// dentro de children:
{ path: '/minha-pagina', element: <MinhaPagina /> },
```

**Passo 3 — Adicionar na sidebar:**
Em `src/renderer/src/componentes/AppSidebar.tsx`, adicionar no array `mainNav`:
```tsx
import { Star } from 'lucide-react'

const mainNav = [
  // ... existentes
  { label: 'Minha Pagina', to: '/minha-pagina', icon: Star },
]
```

**Passo 4 — (Opcional) Adicionar dica de contexto IA:**
Em `src/main/ia/discovery.ts`, adicionar no `PAGE_HINTS`:
```ts
'/minha-pagina': '\nUsuario esta na pagina X. Contexto relevante: ...',
```

---

## 3. Adicionar uma tool de IA

O LLM ve 3 familias. Para adicionar uma tool interna nova:

**Passo 1 — Adicionar schema, tool entry e handler em `src/main/ia/tools.ts`:**

Criar schema Zod:
```ts
const MinhaToolSchema = z.object({
  param1: z.string().describe('Descricao do parametro'),
})
```

Adicionar no array `IA_TOOLS`:
```ts
export const IA_TOOLS = [
  // ... existentes
  {
    name: 'minha_tool_interna',
    description: 'O que essa tool faz.',
    parameters: toJsonSchema(MinhaToolSchema),
  },
]
```

Adicionar no objeto `TOOL_SCHEMAS`:
```ts
export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny | null> = {
  // ... existentes
  minha_tool_interna: MinhaToolSchema,
}
```

Adicionar handler na funcao `executeTool()` (if-chain):
```ts
if (name === 'minha_tool_interna') {
  const { param1 } = args
  // logica
  return toolOk({ resultado: 'sucesso' }, { summary: 'Descricao do resultado' })
  // ou: return toolError('CODIGO', 'mensagem de erro')
}
```

**Passo 2 — Rotear na familia em `src/main/ia/tool-families.ts`:**

Opcao A — Adicionar como nova entidade numa familia existente:
```ts
// Dentro de routeFamilyTool, no bloco da familia adequada:
if (entidade === 'minha_entidade') {
  return { internalTool: 'minha_tool_interna', internalArgs: { param1: filtros?.param1 } }
}
```

Atualizar o schema Zod da familia para incluir a nova entidade no `z.enum()`.

Opcao B — Criar familia nova (raro, so se nao cabe nas 3 existentes):
Adicionar schema, routing e entry em `FAMILY_TOOLS` e `FAMILY_SCHEMAS`.

**Passo 3 — Atualizar descricao da familia:**
No array `FAMILY_TOOLS`, atualizar a `description` para mencionar a nova capacidade.

---

## 4. Adicionar contexto por pagina

O discovery injeta contexto automatico no system prompt baseado na pagina atual.

**Arquivo:** `src/main/ia/discovery.ts`

**Passo 1 — Adicionar hint:**
No objeto `PAGE_HINTS` dentro da funcao `_dicaPagina`:
```ts
const PAGE_HINTS: Record<string, string> = {
  // ... existentes
  '/minha-pagina': '\nUsuario esta na pagina X. Ele pode querer fazer Y ou Z.',
}
```

**Passo 2 — (Opcional) Adicionar dados dinamicos:**
Na funcao `buildContextBundle`, adicionar query especifica:
```ts
// Depois do bloco de memorias
if (contexto.pagina === '/minha-pagina') {
  const dados = await queryAll<{ ... }>('SELECT ... FROM minha_tabela LIMIT 10')
  // adicionar ao bundle
}
```

**Como funciona:** O renderer envia `{ pagina, rota }` no campo `contexto` de cada mensagem. O `buildContextBundle` monta memorias + RAG + page hints e o `renderContextBriefing` converte tudo em markdown que vai no system instruction.

---

## 5. Adicionar uma tabela

**Passo 1 — DDL em `src/main/db/schema.ts`:**
Criar nova constante DDL e chamar em `createTables`:
```ts
const DDL_MINHA_TABELA = `
CREATE TABLE IF NOT EXISTS minha_tabela (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export async function createTables(): Promise<void> {
  // ... existentes
  await execDDL(DDL_MINHA_TABELA)
}
```

**Passo 2 — Tipo em `src/shared/types.ts`:**
```ts
export interface MinhaEntidade {
  id: number
  nome: string
  ativo: boolean
  criada_em: string
  atualizada_em: string
}
```

**Passo 3 — Handlers IPC em `src/main/tipc.ts`:**
```ts
const minhaEntidadeListar = t.procedure
  .input(z.object({ ativo: z.boolean().optional() }))
  .query(async ({ input }) => {
    return queryAll<MinhaEntidade>(
      'SELECT * FROM minha_tabela WHERE ($1::boolean IS NULL OR ativo = $1) ORDER BY criada_em DESC',
      input.ativo ?? null
    )
  })
```

Adicionar no objeto `router`:
```ts
export const router = {
  // ... existentes
  'minhaEntidade.listar': minhaEntidadeListar,
}
```

**Passo 4 — (Opcional) Service no renderer:**
Criar `src/renderer/src/servicos/minha-entidade.ts` se a logica de chamada for reutilizada em varios componentes.

---

## 6. Adicionar um IPC procedure

**Passo 1 — Handler em `src/main/tipc.ts`:**
```ts
const meuHandler = t.procedure
  .input(z.object({
    id: z.number(),
    nome: z.string().min(1),
  }))
  .mutation(async ({ input }) => {
    await execute(
      'UPDATE minha_tabela SET nome = $1, atualizada_em = NOW() WHERE id = $2',
      input.nome, input.id
    )
    return { ok: true }
  })
```

**Passo 2 — Registrar no router:**
```ts
export const router = {
  // ... existentes
  'minhaEntidade.atualizar': meuHandler,
}
```

**Passo 3 — Chamar no renderer:**
```ts
import { client } from '@/servicos/client'

// Chamada direta — tipo inferido automaticamente
const result = await client['minhaEntidade.atualizar']({ id: 1, nome: 'Novo nome' })
```

**Passo 4 — (Opcional) Tipo compartilhado:**
Se o input/output for usado em mais de um lugar, definir em `src/shared/types.ts`:
```ts
export interface AtualizarMinhaEntidadeInput {
  id: number
  nome: string
}
```

**Convencoes de nomeacao:**
- Handlers: `dominio.acao` (ex: `knowledge.listar`, `ia.memorias.salvar`)
- `.query()` para leituras, `.mutation()` para escritas
- Retorno de erro: throw ou retornar `{ ok: false, erro: '...' }`

---

## 7. Adicionar importacao RAG em massa

Use esta receita quando uma feature precisa aceitar pasta/arquivo grande e
importar tudo em um grupo.

**Arquivos:**

- `src/main/knowledge/bulk-import.ts` — scan, fila, ingestao por arquivo
- `src/main/knowledge/bulk-persistence.ts` — grupos, jobs e arquivos persistentes
- `src/main/tipc.ts` — handlers IPC `knowledge.bulkImport.*`
- `src/main/tool-server.ts` — endpoints HTTP `/rag/import`, `/rag/jobs`
- `src/cli/index.ts` — comandos `rag import/jobs/job/pause/resume/cancel`
- `src/renderer/src/componentes/AdicionarConhecimentoDialog.tsx` — modal de import

**Fluxo:**

1. Crie ou reutilize um `knowledge_group`.
2. Crie `knowledge_import_jobs`.
3. Faça scan incremental da pasta.
4. Grave cada arquivo em `knowledge_import_files`.
5. Para cada arquivo valido, chame `ingestFromFile`.
6. Atualize progresso do job vivo e persistente.
7. Ao final, rode enrichment se `auto_enrich` estiver ativo.

**CLI esperado:**

```bash
npm run cli -- rag import ~/Documents/minha-pasta --group "Meu Grupo" --wait
npm run cli -- rag import ~/Documents/minha-pasta --group "Meu Grupo" --enrich --wait
```

**Done real:**

- [ ] Job termina `done`, ou `partial` com aviso explícito quando dados entraram mas arquivos/enrichment falharam.
- [ ] `knowledge_import_jobs` tem run persistido.
- [ ] `knowledge_import_files` tem status por arquivo.
- [ ] `knowledge_sources.group_id` aponta para o grupo.
- [ ] Busca por token unico retorna o documento importado.
- [ ] Se enrichment rodou, `knowledge_chunks.enriched_at` e
  `enrichment_json` foram gravados.
- [ ] No CLI, `rag import --wait` retorna exit code 2 quando o status final é `partial`.

---

## 8. Adicionar ou expor uma acao de Terminal Harness

Use esta receita quando uma feature precisa ler arquivo, escrever arquivo,
executar comando local ou abrir o CLI no Terminal do sistema.

**Arquivos:**

- `src/main/terminal/harness.ts` — `exec`, `read`, `write`, `open-cli`
- `src/main/terminal/config.ts` — cwd, timeout e limite de saida
- `src/main/terminal/sessions.ts` — shell vivo usado por API/testes
- `src/main/ia/tools.ts` — tool interna `terminal_exec`
- `src/main/ia/tool-families.ts` — familia publica `executar_acao`
- `src/main/tool-server.ts` — endpoints `/terminal/*`
- `src/cli/index.ts` — comandos `terminal exec/read/write/open-cli`
- `src/renderer/src/paginas/TerminalPagina.tsx` — launcher da IA no Terminal do sistema

**Contrato:**

- `terminal_exec` executa comando pontual e grava `terminal_command_log`.
- `terminal sessions` sao primitivo de shell local para API/testes, nao a tela principal.
- `open-cli` abre o comando oficial no Terminal do sistema; o launcher de IA resolve `npm --prefix <repo> run cli -- chat --attach` em dev ou `node <resources>/cli/index.js -- chat --attach` empacotado.
- Quando a IA executa comando, `source` no log deve ser `ia_tool`.
- Endpoints HTTP de ação do Terminal exigem token local do tool-server.

**CLI esperado:**

```bash
npm run cli -- terminal exec --wait --cwd "$HOME" pwd
npm run cli -- terminal open-cli
```

**Done real:**

- [ ] Comando executou com `exit_code` esperado.
- [ ] `terminal_command_log` gravou `source`, `command`, `cwd` e
  `output_preview`.
- [ ] Se a acao veio da IA, `source = 'ia_tool'`.
- [ ] O efeito no disco/saida foi verificado fora da UI.
- [ ] A UI nao apresenta shell como se fosse chat.
