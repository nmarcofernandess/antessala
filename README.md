# Antessala

Protótipo para investigar e demonstrar **triagem aplicada ao agendamento da consulta
pré-anestésica**.

O produto ainda não está liberado para construção clínica. A hipótese mais provável é
que solicitações com necessidades diferentes cheguem à alocação de vagas sem informação
operacional suficiente — ou sem uma regra que use essa informação — para diferenciar
prioridade de acesso, esforço esperado, recurso necessário e pendências.

> **Estado atual: `NO-GO PARA BUILD`.** A descoberta está autorizada dentro do Analyst;
> nenhuma minispec de construção foi liberada. Código existente não transforma hipótese
> em requisito.

## O que o Antessala pretende provar

Se a investigação confirmar a hipótese, o protótipo deverá transformar uma solicitação
sintética de consulta pré-anestésica em um perfil operacional revisado por humano, capaz
de orientar a procura por uma vaga compatível.

O Antessala não é:

- pulseira ou classificação por cores de pronto atendimento;
- fila física de pessoas aguardando chamada no mesmo dia;
- gestão do centro cirúrgico;
- substituto do anestesiologista;
- liberação automática para anestesia ou cirurgia;
- prescrição automática de exames ou suspensão de medicamentos;
- prova de integração com sistemas do HC.

Risco clínico, prioridade de acesso, complexidade, esforço de consulta, prontidão da
solicitação e recurso de agenda são eixos diferentes até que evidência do hospital prove
o contrário.

## Fonte de verdade

O projeto possui exatamente quatro documentos canônicos:

1. [`hack/PRD.md`](hack/PRD.md) — problema, hipótese, promessa e limites;
2. [`hack/ANALYST.md`](hack/ANALYST.md) — evidências obrigatórias e portão `PASS/NO-GO`;
3. [`hack/BUILD.md`](hack/BUILD.md) — plano mestre, dependências e estratégia técnica;
4. [`hack/WARLOG.md`](hack/WARLOG.md) — decisões, invalidações, provas e pendências.

Cada sprint possui apenas `spec.md` e `writing-plan.md`:

| Sprint | Estado | Objetivo |
|---|---|---|
| [`001-caso-triagem-classificacao`](hack/minispecs/001-caso-triagem-classificacao/spec.md) | bloqueado | construir caso, coleta, régua explicável e decisão humana aprovadas |
| [`002-capacidade-agenda-booking`](hack/minispecs/002-capacidade-agenda-booking/spec.md) | bloqueado | traduzir o requisito em capacidade e executar o caminho de agenda aprovado |
| [`003-handoff-prova-final`](hack/minispecs/003-handoff-prova-final/spec.md) | bloqueado | fechar o handoff real e lacrar a prova end-to-end |

Os documentos antigos em `specs/`, `hack/specs/` e os HTMLs de planejamento foram
removidos porque cristalizavam o produto errado. Permanecem recuperáveis no histórico
Git, mas não possuem autoridade.

## O que já sabemos — e o que não sabemos

Está confirmado que o desafio trata da consulta pré-anestésica, que casos apresentam
riscos e complexidades diferentes e que são agendados de forma semelhante. Também há
evidência institucional da existência de Ambulatório de Pré-Anestesia e de atendimento
ambulatorial previamente agendado no HCFMRP.

Ainda não sabemos, entre outras coisas:

- quem cria, completa, revisa e agenda a solicitação;
- quais sistemas e identificadores participam;
- o que exatamente é “semelhante”: ordem, antecedência, duração, modalidade, recurso ou
  visibilidade;
- se o produto recomenda um tipo de vaga, mantém agenda própria ou integra uma agenda;
- quais protocolos, campos, widgets, classes ou tempos são aprovados;
- se a cirurgia possui data antes da consulta pré-anestésica;
- qual baseline permitirá medir melhora.

Essas lacunas são trabalho do Analyst, não licença para adivinhar.

## Fundação técnica existente

A preparação anterior deixou uma base reaproveitável:

- Electron, React 19, Tailwind CSS v4 e shadcn/ui;
- PGlite como Postgres embarcado e IPC tipado com `@egoist/tipc`;
- primeiro boot local sem download de modelo;
- editor rich text, exportação HTML → PDF e tema claro/escuro/sistema;
- contrato de anamnese versionado, composer e oito widgets técnicos portados do
  DietFlow;
- CID-10, medicamentos, classes terapêuticas, grupos de risco, MET e comorbidades em
  arquivos locais versionados;
- IA cloud opcional; Memória/RAG/importadores e STT preservados como código dormente;
- testes Vitest e Playwright.

Essa fundação prova infraestrutura, não adequação clínica.

## Legado provisório — não construir em cima

O schema, os handlers e os tipos atuais de `registros` e `registro_jornada` nasceram da
hipótese invalidada de pessoa descartável, jornada no mesmo dia e fila por
urgência/espera. Eles continuam no código apenas para que a correção seja feita com mapa
de consumidores e decisão de migração aprovada pelo Analyst.

Também permanecem vazios, de propósito:

| Ponto de encaixe legado | Decisão futura |
|---|---|
| `src/shared/extensions/catalogo-widgets.ts` | catálogo aprovado do Sprint 001 |
| `src/shared/extensions/motor-fila.ts` | contrato de capacidade/agenda do Sprint 002 |

Os oito widgets portados são infraestrutura disponível, não o formulário aprovado. O
classificador e o parecer existentes são hipóteses legadas, não protocolo médico.

Branches antigas de motor e widgets estão em quarentena conforme o
[`WARLOG`](hack/WARLOG.md); não devem ser mergeadas ou cherry-pickadas em bloco.

## Offline e integrações

O primeiro boot cria o schema e carrega catálogos a partir do bundle, sem baixar modelo
ou consultar banco remoto. A IA cloud só usa rede após configuração e ação explícita do
usuário.

Offline é uma propriedade real da demonstração atual, não uma afirmação sobre a
arquitetura de produção do HCFMRP. Até existir contrato fornecido pelo hospital, PEP,
agenda, mapa cirúrgico e outros sistemas serão apenas fronteiras mockadas e visivelmente
identificadas.

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
| `npm run dev` | abre o Electron com hot reload |
| `npm test` | executa os testes Vitest |
| `npm run typecheck` | valida TypeScript do processo principal e do renderer |
| `npm run build` | gera o build de produção |
| `npm run test:e2e` | executa o fluxo Electron coberto pelo Playwright |
| `npm run pack` | empacota em diretório, sem instalador |

`ANTESSALA_DB_PATH=/caminho/temporario` isola o banco em testes.
`ANTESSALA_HEADLESS=1` impede a exibição da janela sem alterar o bootstrap.

## Regra de contribuição

Trabalho em branch `codex/*`, com PR contra `main`. Antes de criar schema, tela, widget,
regra clínica, score ou agenda, leia na ordem `PRD → ANALYST → BUILD → WARLOG → spec e
writing plan da minispec`. Sem `PASS` explícito do Analyst, a mudança não começa.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Electron 34 + React 19 |
| Build | electron-vite + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui + TipTap |
| Banco | PGlite (Postgres embarcado) |
| IPC | `@egoist/tipc` |
| IA opcional | Vercel AI SDK + Gemini/OpenRouter |
| Testes | Vitest + Playwright |
