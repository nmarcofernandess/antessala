# Antessala — contrato operacional do repositório

Este repositório é o Antessala. A casca Electron existe, mas o produto clínico está em
descoberta. O código herdado não substitui evidência do HCFMRP.

## Leia antes de alterar

Nesta ordem e por completo:

1. `hack/PRD.md` — hipótese, promessa, limites e desconhecidos;
2. `hack/ANALYST.md` — gates e veredito `PASS/NO-GO`;
3. `hack/BUILD.md` — plano mestre e dependências;
4. `hack/WARLOG.md` — decisões, invalidações, provas e pendências;
5. `hack/minispecs/<sprint>/spec.md`;
6. `hack/minispecs/<sprint>/writing-plan.md`.

Um ponteiro não autoriza leitura parcial. Siga os links necessários antes de tocar no
código.

## Arquitetura documental obrigatória

Existem um único PRD, um único Analyst, um único Build e um único Warlog. Não crie outro
`analysis`, PRD, plano mestre, relatório paralelo ou árvore `specs/`.

Cada sprint possui exatamente:

```text
hack/minispecs/<sprint>/spec.md
hack/minispecs/<sprint>/writing-plan.md
```

O Warlog é append-only. Uma decisão invalidada recebe nova entrada; não é apagada para
reescrever a história.

## Veredito atual

**`NO-GO PARA BUILD`.** Apenas a MiniSpec 001 pode executar descoberta e fechamento de
contrato. Schema clínico definitivo, formulário, widget ativo, regra, score, agenda,
papel, tela e integração continuam bloqueados.

Hipótese canônica:

> Solicitações de consulta pré-anestésica representam casos com necessidades diferentes,
> mas chegam ao agendamento sem informação operacional suficiente — ou sem regra que use
> essa informação — para diferenciar prioridade de acesso, esforço esperado, recurso e
> pendências.

O alvo provável é um fluxo ambulatorial multidiário. Isso ainda não confirma o fluxo
exato, os atores, os sistemas nem qual propriedade do agendamento é semelhante.

## Leis inegociáveis

1. **Analyst é veto real.** Sem evidência e `PASS`, não existe writing plan executável nem
   build.
2. **Não invente o hospital.** Cargo, tela, sistema, API, campo, estado, classe, duração,
   modalidade, protocolo, capacidade e baseline desconhecidos permanecem desconhecidos.
3. **Caso não é pessoa na recepção.** A unidade candidata relaciona paciente
   institucional, procedimento e solicitação. “Pessoa descartável” e “sem histórico” não
   são mais leis.
4. **Não colapse eixos.** Risco, complexidade, prioridade de acesso, esforço, prontidão,
   modalidade e recurso não viram uma única cor ou score por conveniência.
5. **Humano decide.** O software pode organizar, explicar e sugerir conforme regra
   aprovada; aptidão, conduta e revisão clínica continuam humanas e auditáveis.
6. **Widget captura; protocolo interpreta.** Condições por procedimento pertencem a
   composição versionada e aprovada, não a um mega-widget improvisado.
7. **Agenda não fabrica capacidade.** Sem vaga compatível, o produto expõe o gargalo.
8. **Mock é visível.** Nenhuma integração sintética pode parecer conexão real com HC.
9. **Primeiro boot continua local.** Não introduza download de modelo, telemetria,
   updater ou chamada cloud no bootstrap.
10. **Legado provisório não é fundação de feature.** Não amplie `registros`,
    `registro_jornada`, prioridade 1..4, estados da antiga fila ou classificador antes do
    mapa de migração do Sprint 001.

## O que está confirmado

- o desafio trata da consulta pré-anestésica;
- pacientes possuem riscos e complexidades diferentes;
- hoje são agendados de forma semelhante;
- existe Ambulatório de Pré-Anestesia no HCFMRP;
- atendimento ambulatorial institucional é previamente agendado;
- paciente real possui registro institucional;
- decisão clínica de avaliação pré-anestésica é responsabilidade médica.

## O que continua desconhecido

- o evento que cria a solicitação e o ator que a cria;
- quem coleta, revisa, regula e escolhe a vaga;
- sistemas, telas, identificadores e integrações;
- se “semelhante” significa ordem, antecedência, duração, modalidade, profissional,
  recurso, pendência ou visibilidade;
- se a data cirúrgica existe antes da consulta;
- protocolo clínico, catálogo de procedimentos e condição específica por cirurgia;
- duração, tipo, capacidade, bloqueio e concorrência de agenda;
- métricas de baseline e metas aceitáveis.

Consulte `hack/ANALYST.md` para a prova mínima de cada resposta.

## Estado da superfície

Rotas ativas em `src/renderer/src/App.tsx`:

| Rota | Superfície atual |
|---|---|
| `/` | casca neutra e estado do protótipo |
| `/ia` | assistente cloud direto |
| `/configuracoes` | provedor de IA e informações essenciais |

Essas rotas não são a arquitetura final por ator. Não declare novas telas antes dos
gates G1–G4 do Analyst.

## Mapa técnico

```text
src/main/
├── index.ts                    bootstrap Electron, DB, IPC e seed local
├── tipc.ts                     fronteira IPC ativa
├── db/
│   ├── pglite.ts               singleton PGlite
│   ├── query.ts                helpers de query/transação
│   ├── schema.ts               schema geral
│   ├── clinical-schema.ts      legado clínico provisório + catálogos
│   └── seed.ts                 carga dos assets locais
├── ia/cliente.ts               chamada cloud direta
└── export/pdf.ts               HTML → PDF com rede bloqueada

src/renderer/src/
├── App.tsx                     rotas ativas
├── componentes/AppSidebar.tsx navegação e tema
├── anamnese/                   composer e widgets técnicos
├── componentes/RichTextEditor.tsx
└── paginas/                    Início, IA e Configurações

src/shared/
├── anamnese/                   tipos, registry, schemas, templates e texto
├── clinical/                   contratos e funções legadas provisórias
├── extensions/                encaixes bloqueados dos Sprints 002/003
├── ia-context.ts              contexto puro com escopo e orçamento
└── app-identity.ts             identidade central

src/data/catalogos/             snapshots versionados usados pelo seed
```

## Anamnese e catálogos

O envelope técnico atual é:

```ts
interface AnamneseContent {
  _v: 2
  blocos: Array<BlocoWidget | BlocoSnapshot | BlocoResultado>
}
```

O registry possui oito widgets do DietFlow com defaults, validação, completude e
`renderToText`. O JSX foi refeito com shadcn/ui. Isso prova capacidade técnica, não a
seleção clínica.

`ACTIVE_ANAMNESE_TEMPLATES` e
`src/shared/extensions/catalogo-widgets.ts` permanecem vazios até o Sprint 002 receber
`PASS`. `LEGACY_DIETFLOW_BASIC_TEMPLATE` é referência de compatibilidade, nunca default.

CID-10 codifica diagnóstico, mas não expressa sozinho controle, gravidade, atividade,
data ou impacto funcional. O recorte de medicamentos não é base ANVISA completa. MET,
comorbidades, grupos e o classificador atual também dependem de validação de protocolo.

## Legado clínico em quarentena

`src/main/db/clinical-schema.ts`, `src/shared/clinical/registro.ts`, handlers de jornada,
prioridade 1..4 e estados como `na_fila`/`no_hub` pertencem à hipótese invalidada. Eles
ficam compiláveis enquanto o Sprint 001 produz a matriz manter/adaptar/migrar/desativar/
remover.

Não:

- acrescente consumidores;
- faça migration corretiva por impulso;
- renomeie o legado como se já fosse o novo domínio;
- integre branches antigas de motor ou widgets;
- trate o classificador/parecer como protocolo aprovado.

O ponto `src/shared/extensions/motor-fila.ts` é apenas compatibilidade nominal. Sua decisão
futura é requisito de capacidade/agenda do Sprint 003, não ordenação da antiga fila.

## Offline e código dormente

- O boot lê catálogos locais e não usa `fetch`, embeddings, LLM ou banco remoto.
- `src/main/knowledge/embeddings.ts` não registra adaptador implícito nem baixa modelo.
- Gemini/OpenRouter usam rede apenas após ação explícita do usuário.
- PDF bloqueia `http`, `https`, `ws` e `wss`.
- Memória, RAG, grafo e importadores permanecem compiláveis, mas sem rota ou boot.
- STT permanece dormente para investigação futura, sem promessa de autopreenchimento.

Offline é requisito real da demo atual; produção hospitalar depende do gate G4.

## Padrões técnicos preservados

### IPC

O router vive em `src/main/tipc.ts` e o client em
`src/renderer/src/servicos/client.ts`. Procedimentos `@egoist/tipc` são chamados
diretamente:

```ts
const registros = await client['registros.listar']()
```

Nunca use `.invoke()`.

### Banco

- Inicialize uma vez com `initDb()` e use `src/main/db/query.ts`.
- Catálogos do primeiro boot vêm de arquivos versionados e hashes conferidos.
- `ANTESSALA_DB_PATH` isola banco em testes.
- Novos agregados e migrations só começam após contrato aprovado.

### Interface

- UI e mensagens em português brasileiro, com acentuação correta.
- O único dono de scroll é o `<main>` da cadeia
  `h-svh → SidebarProvider → SidebarInset → main`.
- Tailwind v4 exige `var()` em valores arbitrários.
- Identidade vem de `src/shared/app-identity.ts`.
- Não escolha FullCalendar ou qualquer grade antes de fechar o papel do produto perante a
  agenda.

## Comandos

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run pack
```

Rode provas proporcionais ao escopo. Quando tocar boot, rotas ou bundle, inclua build e
fluxo Electron. Não declare verde para prova pendente ou executada em outro SHA.

## Git e bases doadoras

- Trabalhe em branch `codex/*`, com PR contra `main`; não faça push direto em `main`.
- Antes de editar, prove worktree, branch, SHA e status.
- `/Users/marcoantonio/dietflow-app`, `~/escalaflow` e worktrees do FlowKit são somente
  leitura para esta operação.
- Branches antigas listadas em `hack/WARLOG.md` são material de pesquisa, não fonte
  canônica nem alvo de merge.
