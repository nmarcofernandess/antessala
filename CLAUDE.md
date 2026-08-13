# Antessala — contexto operacional

Este repositório é o **Antessala**, uma aplicação Electron de triagem pré-anestésica com
banco embarcado. Ele nasceu do FlowKit, mas o FlowKit não é mais a especificação do
produto.

## Leia antes de alterar

Nesta ordem e por completo:

1. `specs/000-produto-antessala/analysis.md` — produto, quatro telas e invariantes;
2. `specs/001-preparar-ambiente/spec.md` — limites desta preparação;
3. `specs/001-preparar-ambiente/mapa-esquemas.md` — contrato DietFlow → Antessala;
4. `docs/INVENTARIO.html` — procedência das peças;
5. `docs/PLANO.html` — divisão das frentes.

## Leis inegociáveis

1. **A pessoa não é cadastrada.** Nome, sexo, idade e plano são um snapshot embutido em
   cada registro. Não crie tabela de paciente, FK, busca, deduplicação ou aviso de nome
   repetido.
2. **Não existe evolução.** Não crie timeline clínica, série temporal, comparação ou
   leitura que dependa de outro atendimento da mesma pessoa.
3. **Primeiro boot offline.** Schema e seed devem usar somente assets locais. Não ligue
   download de modelo, telemetria, atualização automática ou chamada cloud ao bootstrap.
4. **Jornada é append-only.** Toda entrada de estado recebe horário; marcos existentes
   não são atualizados nem apagados.
5. **A preparação não ordena a fila.** Urgência, tempo de espera, transições e ordenação
   pertencem a `specs/002-motor-da-fila/`.
6. **A preparação não escolhe o formulário clínico.** Widgets/templates específicos
   pertencem a `hack/specs/02-quais-widgets/`.

## Estado atual da superfície

Rotas ativas, declaradas em `src/renderer/src/App.tsx`:

| Rota | Superfície |
|---|---|
| `/` | Início neutro da casca |
| `/ia` | Assistente cloud direto |
| `/configuracoes` | Provedor de IA e informações essenciais |

O menu deve apontar somente para essas rotas. O seletor claro/escuro/sistema fica sempre
visível no rodapé da sidebar. As telas finais de Entrada, Anamnese, Fila e Resumo ainda
não devem ser declaradas como prontas nesta etapa.

## Mapa do código ativo

```text
src/main/
├── index.ts                    bootstrap Electron, DB, IPC e seed local
├── tipc.ts                     fronteira IPC ativa
├── db/
│   ├── pglite.ts               singleton PGlite
│   ├── query.ts                helpers de query/transação
│   ├── schema.ts               schema geral
│   ├── clinical-schema.ts      registros, jornada e catálogos
│   └── seed.ts                 carga exclusiva dos assets clínicos locais
├── ia/cliente.ts               chamada cloud direta, sem tools/RAG
└── export/pdf.ts               HTML → PDF, com rede bloqueada

src/renderer/src/
├── App.tsx                     rotas ativas
├── componentes/AppSidebar.tsx navegação e tema
├── anamnese/                   composer e widgets em shadcn/ui
├── componentes/RichTextEditor.tsx
└── paginas/                    Início, IA e Configurações

src/shared/
├── anamnese/                   tipos, registry, schemas, templates e texto
├── clinical/                   registro, risco e parecer
├── extensions/                encaixes das duas frentes paralelas
├── ia-context.ts              contexto puro com escopo e orçamento
└── app-identity.ts             identidade central do produto

src/data/catalogos/             snapshots versionados usados pelo seed
```

## Contratos de domínio

### Registro autônomo

`registros` contém `nome`, `sexo`, `idade`, `plano`, `anamnese JSONB`, prioridade
opcional e timestamps. Não existe tabela `Patient` nem `patientId`. O mesmo conjunto de
dados pessoais pode aparecer em várias linhas sem qualquer vínculo.

### Anamnese

O envelope canônico é:

```ts
interface AnamneseContent {
  _v: 2
  blocos: Array<BlocoWidget | BlocoSnapshot | BlocoResultado>
}
```

O registry porta os oito widgets do DietFlow com defaults, validação, completude e
`renderToText`. O JSX do DietFlow/HeroUI não foi copiado; a camada visual daqui usa
shadcn/ui.

`ACTIVE_ANAMNESE_TEMPLATES` e
`src/shared/extensions/catalogo-widgets.ts` ficam vazios até chegar a decisão clínica.
`LEGACY_DIETFLOW_BASIC_TEMPLATE` existe apenas como referência de compatibilidade e não
deve virar default do produto.

### Jornada e fila

`registro_jornada` aceita os seis estados do analyst e bloqueia `UPDATE`/`DELETE` no
banco. O tipo compartilhado também os enumera, mas não define transição, score, relógio
ou ordem. O único encaixe autorizado para isso é
`src/shared/extensions/motor-fila.ts`, guiado pela spec 002.

## Offline e rede

- O boot lê os catálogos de `src/data/catalogos/` em desenvolvimento ou de
  `clinical-data/` no bundle.
- O seed não usa `fetch`, embeddings, LLM ou banco remoto.
- `src/main/knowledge/embeddings.ts` proíbe modelos remotos. Não reverta isso ao reativar
  a Memória.
- Gemini/OpenRouter são opcionais. Rede só pode ocorrer após ação explícita do usuário
  para testar a configuração ou conversar.
- O export PDF deve continuar bloqueando `http`, `https`, `ws` e `wss`.
- Não introduza updater ou telemetria silenciosa.

## Código escondido e código removido

Memória, RAG, knowledge graph e importadores permanecem como fonte dormente, sem rota ou
boot. Parte deles está explicitamente fora dos `tsconfig` ativos porque ainda referencia
contratos retirados. Reativação exige reconciliação e retorno ao typecheck.

A base de gravação/STT também permanece dormente para o roadmap de
transcrição → preenchimento assistido. Ela não deve entrar no menu, IPC, bootstrap ou
bundle sem uma spec própria.

Terminal, CLI, MCP, tool-server, cron, modelo local/llama, Maiá e galeria foram removidos.
Não recrie imports, scripts ou dependências dessas superfícies por conveniência.

## Padrões técnicos

### IPC tipado

O router vive em `src/main/tipc.ts` e o client em
`src/renderer/src/servicos/client.ts`. Chamadas são diretas:

```ts
const registros = await client['registros.listar']()
await client['registros.salvarAnamnese']({ id, anamnese })
```

Nunca use `.invoke()` em um procedimento `@egoist/tipc`.

### Banco

- Inicialize uma vez com `initDb()` e use os helpers de `src/main/db/query.ts`.
- Dados da pessoa ficam nas colunas do registro; blocos clínicos ficam no JSONB.
- Novos marcos são `INSERT`; nunca “mova” um marco com `UPDATE`.
- Catálogos do primeiro boot vêm de arquivo versionado, com hash conferido.
- `ANTESSALA_DB_PATH` permite banco isolado em testes.

### Interface

- UI e mensagens em português brasileiro, com acentuação correta.
- O único dono de scroll é o `<main>` da cadeia
  `h-svh → SidebarProvider → SidebarInset → main`.
- Tailwind v4 exige `var()` em valores arbitrários, por exemplo
  `w-[var(--sidebar-width)]`.
- Identidade do produto vem de `src/shared/app-identity.ts`; não espalhe strings de
  branding.

## Comandos

```bash
npm install          # instala/pruna pelo lockfile; não baixa modelo de IA
npm run dev          # Electron + hot reload
npm run typecheck    # TypeScript main + renderer
npm test             # Vitest
npm run test:e2e     # fluxo Electron ativo
npm run build        # build de produção
npm run pack         # bundle em diretório
```

Antes de entregar uma mudança: rode os testes proporcionais ao escopo, `npm test`,
`npm run typecheck` e, quando tocar boot/rotas/bundle, `npm run build` e o fluxo Electron.
Não declare verde se alguma dessas provas estiver pendente.

## Git e bases doadoras

- Trabalho em branch `codex/*`, com PR contra `main`; não faça push direto em `main`.
- `/Users/marcoantonio/dietflow-app`, `~/escalaflow` e o worktree do Studio são fontes
  somente leitura para esta operação.
- Não implemente nesta branch o conteúdo recebido das duas frentes paralelas; apenas
  preserve seus pontos de encaixe.
