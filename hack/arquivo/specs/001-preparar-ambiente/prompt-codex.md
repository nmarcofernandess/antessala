# Handoff para o Codex — preparar o terreno

> Execução da spec 001. Cole isto no Codex, com o repo `antessala` aberto.

---

## Quem você é nesta operação

Você prepara o terreno. **Não constrói funcionalidade nova.** No fim do seu trabalho o
repositório precisa estar limpo, magro, offline de verdade, e com o esqueleto pronto para
receber duas coisas que **não são suas** e chegam depois:

| Não é seu | Quem faz | Chega como |
|---|---|---|
| **Quais widgets específicos** a triagem precisa e quais templates existem | outra pessoa, em paralelo | `hack/specs/02-quais-widgets/` |
| **A lógica de urgência + tempo de espera** e a ordenação da fila | outro Codex, em paralelo | `specs/002-motor-da-fila/` |

Não invente essas duas. Deixe o encaixe pronto e siga.

---

## Leia antes de tocar em qualquer arquivo

Nesta ordem, por completo:

1. `specs/000-produto-antessala/analysis.md` — o produto, as quatro telas, os invariantes
2. `specs/001-preparar-ambiente/spec.md` — **a spec que você está executando**: o que fica,
   o que esconde, o que sai, o roadmap de 8 passos, os critérios de aceite
3. `docs/INVENTARIO.html` — abra no navegador. É o levantamento do que existe em cada base
   (FlowKit, branch Studio, DietFlow, EscalaFlow) e de onde cada peça vem
4. `docs/PLANO.html` — a divisão de frentes
5. `CLAUDE.md` — atenção ao aviso no topo: o corpo do arquivo ainda descreve o FlowKit
   original, não o Antessala. Use como mapa do terreno herdado, não como especificação

---

## As três leis que não se negociam

1. **O paciente não é cadastrado.** É um identificador descartável: nome, sexo, idade,
   plano. Sem busca, sem deduplicação, sem "já existe". O mesmo nome pode aparecer duas
   vezes na fila e isso é correto.
2. **Não existe evolução.** Nenhuma série temporal, nenhuma comparação entre registros,
   nenhuma leitura que dependa de um atendimento anterior da mesma pessoa.
3. **Offline de verdade.** Quando você terminar, o primeiro boot **não pode acessar a
   internet**. Hoje ele baixa 278 MB de embeddings da Hugging Face.

---

# Parte A · Mapear os dois esquemas

Antes de mexer, produza o mapa. Ele é entregável, não rascunho.

## A.1 — Como o DietFlow guarda a anamnese

Repositório: `~/dietflow-app`. **Somente leitura.** Outra pessoa trabalha nele agora; não
edite, não crie branch, não rode build lá dentro.

Pontos de entrada já localizados:

| O quê | Onde |
|---|---|
| Registro de widgets | `src/lib/anamnese/widget-registry.ts` |
| Os 8 widgets | `src/lib/anamnese/widgets/` — adesao, bristol, hidratacao, medicacoes, observacoes-gerais, problemas-saude, rotina-alimentar, sono |
| Contrato `WidgetDefinition` | `src/lib/widgets/types.ts` |
| Tipos de bloco | `src/lib/anamnese/types.ts` — `BlocoWidget`, `BlocoSnapshot`, `BlocoResultado`, campo `_v` de versão |
| Templates prontos | `src/lib/anamnese/templates.ts` |
| Drawer / composer | `src/components/composer-universal/` — 898 linhas em 7 arquivos |
| Persistência | `prisma/schema.prisma` → **`model Content`** |
| Catálogo CID | `prisma/schema.prisma` → `model Cid10` (hierárquico: capítulo → grupo → categoria → subcategoria) |
| Catálogo de medicamentos | `prisma/schema.prisma` → `model MedicamentoBase` + `ClasseTerapeutica` (ANVISA) |
| Sementes em JSON | `prisma/seeds/` — inclusive `system/met/met_items_golden.json` |

**O achado que decide o desenho.** No `model Content`, o campo `patientId` faz o papel
duplo:

```
patientId NULL      → é um FAVORITO / template (anamnese modelo, sem dono)
patientId NOT NULL  → é um REGISTRO preso a um paciente cadastrado  ← histórico
```

É exatamente essa segunda linha que **não** existe no Antessala. Traga a anamnese inteira
do DietFlow — widgets, contrato, templates, drawer — e **deixe o vínculo com paciente para
trás**. No Antessala, um registro de anamnese é autônomo: a pessoa mora dentro dele, e ele
não aponta para nenhuma tabela de pacientes, porque essa tabela não existe.

## A.2 — Como este app guarda as coisas

| O quê | Onde |
|---|---|
| Tabelas | `src/main/db/schema.ts` — `CREATE TABLE IF NOT EXISTS` + migrations |
| Helpers de query | `src/main/db/query.ts` — `queryAll`, `queryOne`, `execute`, `insertReturningId`, `transaction` |
| Banco | `src/main/db/pglite.ts` — PGlite, Postgres embarcado |
| Semente do primeiro boot | `src/main/db/seed.ts` — 3 fases; **hoje semeia a documentação do FlowKit** |
| IPC tipado | `src/main/tipc.ts` — ~70 handlers. Chamada direta, **nunca** `.invoke()` |
| Rotas | `src/renderer/src/App.tsx` |
| Páginas | `src/renderer/src/paginas/` |
| Identidade do app | `src/shared/app-identity.ts` — fonte única do nome |
| Config central | `src/main/config/app-config.ts` |

## A.3 — Entregue o mapa

Escreva `specs/001-preparar-ambiente/mapa-esquemas.md` respondendo:

- Como o conteúdo de uma anamnese é serializado no DietFlow (o formato de `content`), e
  como esse mesmo formato passa a viver numa coluna `JSONB` do PGlite aqui.
- O que cada um dos 8 widgets guarda, e qual deles depende de catálogo externo
  (medicações depende da base ANVISA; problemas de saúde depende de CID).
- **Como os catálogos vêm para o offline**: o DietFlow os tem em Postgres na nuvem. Aqui
  eles precisam virar arquivo versionado no repositório, carregado no banco embarcado no
  primeiro boot. Proponha o formato e o tamanho.
- Onde o vínculo com paciente aparece no DietFlow e **como ele é cortado** aqui.

---

# Parte B · Preparar o repositório

Execute o roadmap da spec 001. O detalhe de cada passo está lá; abaixo só o que não está
escrito e você precisa saber.

## B.1 — O caminho adotado

A spec adota o **caminho A**: trazer a branch do Studio por cima deste fork e remover o
editorial, em vez de podar o kit à mão.

- Branch: `codex/editorial-ux-simplification` no repositório `nmarcofernandess/flowkit`
- Worktree local já existente, para leitura: `/Volumes/Vader/Marco/worktrees/flowkit-ux-simplification`
- O que ela traz de bom: editor rich text (TipTap v3), o contexto da IA reescrito (modos
  `global`/`adaptive`/`pinned`, escopo documento → caderno → global, orçamento de
  caracteres), navegação enxuta, configurações magras
- O que ela traz de ruim e precisa sair: todo o editorial — gravar, transcrever, traduzir,
  glossário, montador de livro, cadernos, aulas, e as tabelas `editorial_*` que só servem
  a isso

**Julgue antes de obedecer.** Se ao abrir a branch você concluir que trazer +46 mil linhas
para depois remover metade é pior do que copiar dela apenas as três peças boas, **diga
isso e siga pelo plano B** (registrado na spec). Você tem o código na frente; eu tenho
só o levantamento. Justifique a escolha em uma seção do relatório.

## B.2 — Manter, ajustar, esconder, remover

A spec 001 tem as quatro listas completas. O que merece cuidado extra:

**Esconder é tirar da rota, não apagar.** Memória, RAG, grafo e importadores saem do menu
e continuam no repositório — eles voltam quando a Memória virar o repositório de conteúdo
científico que alimenta a IA. É assim que o Studio fez: zero rotas apontando para as
páginas, arquivos intactos.

**Remover é remover.** Terminal, CLI, MCP, tool-server, cron, ditado, modelo local e
galeria saem do código e do `package.json`. Repare no `phaser` (146 MB, motor de jogo 2D)
— se nada real o importa, ele vai junto.

**Ajustar:**
- O primeiro boot para de semear a documentação do FlowKit e para de baixar o modelo de
  embeddings. Esse é o critério de aceite mais importante da spec.
- Fora o painel "configure seu tema" do dashboard e o passo de tema do wizard.
- Dentro um seletor **claro / escuro / sistema** no canto da interface. Atenção: **isso
  não existe em nenhuma das duas bases.** O provider está fixo em `system` e o único
  seletor vivo mora numa página que está fora das rotas. É construção, não cópia.

## B.3 — O esqueleto

Deixe pronto o encaixe, sem inventar conteúdo:

1. **Tabelas** para registro (pessoa embutida, anamnese em JSONB, jornada append-only com
   carimbo de horário) e para os catálogos clínicos.
   **Atenção à fronteira:** quem fecha a lista definitiva de estados da jornada é o outro
   Codex, na spec 002 — a jornada real tem mais estados do que o analyst esboça (cadastro
   incompleto, anamnese incompleta, hub, desfecho). Crie a tabela com a forma
   `{ estado, entrouEm }` append-only e **o estado como texto livre com validação
   frouxa**, para não travar o que ainda vai ser definido. Não implemente ordenação.
2. **Os widgets do DietFlow portados.** Pode trazer os 8 na íntegra. Aviso: o DietFlow
   desenha com **HeroUI** e este app com **shadcn/ui**. O contrato atravessa — tipos,
   registro, validação, `renderToText`, dados padrão. O JSX não atravessa: refaça.
3. **Os catálogos carregados**: CID-10, medicamentos com classe terapêutica, equivalentes
   metabólicos. Já existem extraídos e prontos em
   `/Volumes/Vader/Marco/antessala/src/data/` — 382 medicamentos, 12 grupos de risco
   perioperatório, 94 atividades com MET, 14 comorbidades com CID. Use-os como ponto de
   partida; se precisar de mais, extraia dos seeds do DietFlow.
4. **Classificador de risco**: `/Volumes/Vader/Marco/antessala/src/lib/risco.js` e
   `parecer.js`, com 16 testes verdes. Traga e converta para TypeScript, mantendo os
   testes passando. É função pura — não a reescreva, porte.
5. **Export em PDF**: copie do EscalaFlow (`~/escalaflow`, somente leitura) o handler
   `export.imprimirPDF` em `src/main/tipc.ts` — HTML entra, PDF sai pelo motor de
   impressão do próprio Electron, sem biblioteca.
6. **Um lugar declarado** onde o catálogo de widgets específicos e o motor de fila entram
   quando chegarem. Interface vazia com comentário apontando a spec correspondente.

Sobre o dashboard: o analyst prevê quatro telas e a terceira é a fila. Se ao montar o
esqueleto você concluir que falta uma superfície — um painel de status, uma home — proponha
no relatório, com o motivo. Não construa por conta.

---

# Parte C · Provar

Sem prova, não está feito.

- [ ] `npm install` conclui sem baixar modelo de IA.
- [ ] **O primeiro boot não acessa a internet.** Prove: apague os dados do app, desligue a
      rede, abra. Registre o que aconteceu.
- [ ] `npm run dev` abre a janela com o nome Antessala.
- [ ] Nenhuma rota morta no menu.
- [ ] Seletor de tema claro / escuro / sistema funcionando.
- [ ] `npm test` e `npm run typecheck` verdes. Hoje são 409 testes passando — se algum
      morrer junto com o código removido, diga qual e por quê.
- [ ] Tamanho do `node_modules` medido **antes e depois**. Hoje: 1,6 GB.
- [ ] `npm audit` antes e depois. Hoje: 51 vulnerabilidades, 37 altas, 4 críticas.
- [ ] README atualizado: o que ficou, o que escondeu, o que saiu, e por quê.

## O relatório

Escreva `specs/001-preparar-ambiente/relatorio.md` com: o caminho escolhido e o motivo, o
que foi removido e o que foi apenas escondido, os números antes/depois, o que quebrou e
como foi resolvido, e **o que você decidiu diferente do que esta spec mandou** — com a
justificativa. Divergência fundamentada é bem-vinda; divergência silenciosa não.

## Trabalho em git

Branch própria, commits pequenos e legíveis, PR contra `main` de
`nmarcofernandess/antessala`. Nada de push direto na `main` — outras pessoas leem esse
repositório enquanto você trabalha.

---

## Resumo em uma frase

Deixe o repositório magro, offline e com o esqueleto da anamnese pronto — trazendo a
anamnese inteira do DietFlow **menos o vínculo com paciente** — para que o catálogo de
widgets e o motor de fila só precisem ser encaixados quando chegarem.
