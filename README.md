# Antessala

Aplicativo desktop para triagem pré-anestésica, com persistência clínica local e sem
dependência de servidor. Este repositório está na etapa de **preparação do terreno**: a
casca foi reduzida, os contratos clínicos foram plantados e os pontos de encaixe foram
declarados. As quatro telas finais e o motor de ordenação da fila ainda não fazem parte
desta entrega.

## Leis do produto

- A pessoa **não é cadastrada**. Nome, sexo, idade e plano pertencem a um registro
  autônomo e descartável.
- Não existe busca, deduplicação ou aviso de nome repetido. Dois registros iguais são
  duas entradas válidas.
- Não existe evolução, série temporal ou leitura que dependa de atendimento anterior.
- A jornada é append-only: cada novo estado recebe seu próprio carimbo de horário.
- O app não decide a especialidade de destino.

A definição completa está em
[`specs/000-produto-antessala/analysis.md`](specs/000-produto-antessala/analysis.md).

## O que existe nesta etapa

### Fundação ativa

- Electron + React 19, Tailwind CSS v4 e componentes shadcn/ui;
- PGlite como Postgres embarcado;
- IPC tipado com `@egoist/tipc`;
- três rotas ativas: Início (`/`), Assistente IA (`/ia`) e Configurações
  (`/configuracoes`);
- seletor de tema claro, escuro ou sistema no rodapé da interface;
- assistente cloud direto, sem tool calling, RAG ou modelo local;
- editor rich text genérico com TipTap e contrato puro de contexto da IA;
- exportação HTML → PDF pelo motor de impressão do Electron, com recursos remotos
  bloqueados.

### Esqueleto clínico

- tabela `registros`, com a pessoa embutida e anamnese versionada em JSONB;
- tabela `registro_jornada`, append-only, com os seis estados definidos pelo produto;
- oito widgets portados do DietFlow: rotina alimentar, hidratação, sono, Bristol,
  problemas de saúde, medicações, adesão e observações gerais;
- contrato de serialização `{ _v: 2, blocos: [...] }`, validação e renderização textual;
- composer/drawer dos widgets refeito com shadcn/ui;
- CID-10 completo (14.793 itens), 382 medicamentos, 35 classes terapêuticas, 12 grupos
  de risco, 94 atividades MET e 14 comorbidades;
- classificador de risco e parecer clínico portados como funções puras.

O registro dos oito widgets existe, mas a **seleção clínica ativa** e o catálogo de
templates estão deliberadamente vazios. Essa decisão chega depois por
`hack/specs/02-quais-widgets/`. O contrato detalhado do porte está em
[`specs/001-preparar-ambiente/mapa-esquemas.md`](specs/001-preparar-ambiente/mapa-esquemas.md).

## O que foi escondido

Memória, RAG, knowledge graph e importadores continuam no repositório, mas não têm rota,
menu nem inicialização no boot. Eles são material de roadmap para uma futura base de
conteúdo científico.

A gravação/transcrição de voz também foi preservada como código dormente, por decisão de
produto posterior à spec: poderá alimentar transcrições e preenchimento assistido no
futuro. Ela não está ligada à interface ativa, ao IPC, ao boot nem aos recursos do
instalador desta etapa.

Parte do código escondido está fora do `typecheck` ativo. Reativá-lo exige trazê-lo de
volta às rotas, reconciliar seus contratos e recolocá-lo na validação TypeScript — não é
apenas trocar uma flag.

## O que foi removido

- terminal embutido e harness de shell;
- CLI;
- servidor MCP e tool-server HTTP;
- cron;
- modelo local, `llama.cpp` e seus downloads;
- assistente Maiá e suas permissões de sistema;
- galeria;
- onboarding/wizard herdado;
- orquestração antiga da IA, tool calling e dependências sem consumidor ativo;
- seed da documentação do FlowKit.

Essas peças aumentavam o boot, a superfície de permissões, o tamanho instalado e a
manutenção sem participar da triagem.

## Limite offline

O primeiro boot cria o schema e carrega os catálogos a partir de arquivos versionados no
próprio repositório/bundle. Esse caminho não usa `fetch`, embeddings, LLM nem banco
remoto; o carregador de embeddings também está configurado para não buscar modelos na
internet.

O Assistente IA é opcional e cloud: Gemini ou OpenRouter só acessam a rede depois que o
usuário configura um token e executa uma ação explícita de teste ou conversa. Nenhuma
chave é necessária para abrir o app ou usar a persistência clínica local.

## Como rodar

Requer Node.js 20 ou mais novo.

```bash
git clone https://github.com/nmarcofernandess/antessala.git
cd antessala
npm install
npm run dev
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Abre o Electron com hot reload |
| `npm test` | Executa os testes Vitest |
| `npm run typecheck` | Valida TypeScript do processo principal e do renderer |
| `npm run build` | Gera o build de produção |
| `npm run test:e2e` | Executa o fluxo Electron coberto pelo Playwright |
| `npm run pack` | Empacota em diretório, sem instalador |
| `npm run dist:mac` | Gera `.dmg` e `.zip` para macOS |

Para testes isolados, `ANTESSALA_DB_PATH=/caminho/temporario` troca o diretório do
banco. `ANTESSALA_HEADLESS=1` impede a exibição da janela sem mudar o bootstrap.

## Pontos de encaixe reservados

| Frente futura | Ponto de encaixe | Fonte da decisão |
|---|---|---|
| Widgets/templates específicos | `src/shared/extensions/catalogo-widgets.ts` | `hack/specs/02-quais-widgets/` |
| Motor de urgência, espera e ordenação | `src/shared/extensions/motor-fila.ts` | `specs/002-motor-da-fila/` |

Esses arquivos estão vazios de propósito. Não use o template legado dos oito widgets
como decisão clínica e não implemente ordenação fora da spec do motor.

## Documentação

- [`docs/PLANO.html`](docs/PLANO.html) — produto e divisão das frentes;
- [`docs/INVENTARIO.html`](docs/INVENTARIO.html) — inventário das bases doadoras;
- [`specs/001-preparar-ambiente/spec.md`](specs/001-preparar-ambiente/spec.md) — spec
  desta preparação;
- [`specs/001-preparar-ambiente/relatorio.md`](specs/001-preparar-ambiente/relatorio.md)
  — decisões, números e provas da execução.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Electron 34 + React 19 |
| Build | electron-vite + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui + TipTap |
| Banco | PGlite (Postgres embarcado) |
| IPC | `@egoist/tipc`, com chamada direta e tipada |
| IA opcional | Vercel AI SDK + Gemini/OpenRouter |
| Testes | Vitest + Playwright |
