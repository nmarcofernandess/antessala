# Antessala — instruções para agentes

Este arquivo é um adaptador operacional, não uma fonte de produto. As fontes canônicas
vivem no PRD, nos Analysts, nos Builds e em `.context`. Em conflito, siga a hierarquia de
[`.context/manifest.yaml`](.context/manifest.yaml), pare e reporte; não reconcilie sozinho.

## Estado e trabalho permitido

Marco aprovou o PRD. O Analyst e o BUILD integrados aguardam a revisão final de
congruência antes do Warlog. Consulte [`hack/status.json`](hack/status.json) e
[o tracker](.context/review/STATUS.md) antes de agir. Até o Warlog definir as fatias e a
fatia ativa possuir um Writing Plan com o primeiro teste em RED, não escreva código de
produto.

## Leitura obrigatória

1. [`.context/manifest.yaml`](.context/manifest.yaml);
2. [`hack/PRD.md`](hack/PRD.md), sem alterá-lo sem reabertura explícita;
3. [`hack/status.json`](hack/status.json) e [`hack/progress.md`](hack/progress.md);
4. [`.context/product.yaml`](.context/product.yaml),
   [`.context/workflow.yaml`](.context/workflow.yaml) e
   [`.context/review/STATUS.md`](.context/review/STATUS.md);
5. [`hack/ANALYST.md`](hack/ANALYST.md), [`hack/analysis.md`](hack/analysis.md) e o
   `hack/domains/ANALYST-*.md` dono da tarefa;
6. o `BUILD-*.md` correspondente somente quando a tarefa envolver arquitetura ou review;
7. [`.context/architecture.yaml`](.context/architecture.yaml) e o código do HEAD antes de
   afirmar capacidade existente.

## Produto em uma página

**Goal:** transformar a entrevista de enfermagem em uma necessidade operacional de agenda
compreensível pela recepção e acompanhar o caso até o resultado chegar ao serviço
solicitante.

```text
médico solicitante indica procedimento
→ recepção registra o encaminhamento
→ enfermagem conduz anamnese pré-anestésica
→ sistema produz ou sugere uma necessidade operacional de agenda
→ profissional humano confirma ou altera com justificativa
→ recepção encontra e reserva vaga compatível
→ anestesiologista realiza a consulta
→ abre pendências e retorno quando necessário
→ finaliza resultado
→ serviço solicitante recebe o resultado
→ marcação da cirurgia continua externa
```

A triagem geral do SUS ocorre antes e está fora. A marcação da cirurgia ocorre depois e
está fora. O MVP é uma demonstração local com dados sintéticos, não um protocolo ou uma
arquitetura hospitalar.

### Definition of Done

A lista canônica está em [`.context/product.yaml`](.context/product.yaml). O produto precisa
demonstrar:

- um caso sintético do encaminhamento ao recebimento do resultado;
- responsabilidades e dados limitados por papel;
- entrevista com origem e estados semânticos, sem transformar ausência em negativa;
- requisito de agenda explicável, confirmado ou corrigido por pessoa autorizada;
- reserva apenas de vaga compatível, com conflito e falta de capacidade tratados;
- avaliação, pendência, retorno, conclusão e handoff ao solicitante;
- autoria e auditoria reconstruíveis;
- boot e fluxo-base sem internet;
- um uso real de IA e um de memória, assistivos, auditáveis e sob confirmação humana.

## Arquitetura comprovada no HEAD

- Electron separa processo principal, preload e renderer React.
- PGlite persiste localmente; schema e seed carregam assets versionados sem download no
  primeiro boot.
- TIPC expõe o contrato tipado. No renderer, use `client['namespace.action'](input)`; não
  chame canal TIPC por `.invoke()` manual.
- `src/shared/app-identity.ts` é a fonte do nome Antessala.
- A sessão do renderer bloqueia egress remoto; IA cloud, quando usada, sai pelo processo
  principal após ação explícita.
- PDF usa `printToPDF` em janela isolada e bloqueada para rede.
- A casca ativa possui `/`, `/ia` e `/configuracoes`; o fluxo clínico ainda não existe.
- Anamnese, memória, RAG, grafo, importadores e gravação/transcrição têm peças reutilizáveis,
  mas não formam contrato pronto. Os handlers legados de conhecimento foram contidos no
  router ativo; STT não possui canais registrados e seu modelo não integra o bundle.
- Autenticação, RBAC no processo principal, schema canônico, ledger de migrations e
  superfícies por papel permanecem incompletos.
- A janela principal usa `contextIsolation: true` e `nodeIntegration: false`, mas ainda
  usa preload genérico e `sandbox: false`; não descreva essa fronteira como endurecida.

O inventário e as evidências pertencem a
[`.context/architecture.yaml`](.context/architecture.yaml). Existência no código não é
autorização para reativar produto legado.

## Vinte guardrails

1. Comece por `.context/manifest.yaml`.
2. Leia `hack/PRD.md`; não mude sua promessa por acidente.
3. Localize o Analyst dono e, quando aplicável, o Build correspondente.
4. Consulte `.context/review/STATUS.md`; texto não pesquisado não é verdade pronta.
5. Prove capacidade no código e nos testes do HEAD antes de afirmá-la.
6. Respeite as fronteiras Electron, PGlite, TIPC e offline.
7. Nunca invente regra clínica, protocolo hospitalar, duração, SLA, score ou relação.
8. Separe gravidade, urgência, prioridade cirúrgica e duração necessária da consulta.
9. Preserve autoridade humana e registre justificativa para override relevante.
10. Não crie paciente longitudinal; cada encaminhamento abre caso autônomo.
11. Não crie evolução, deduplicação ou comparação entre casos da mesma pessoa.
12. IA sugere e explica; não decide ASA, aptidão, urgência, gravidade ou conduta.
13. Caso individual, identidade e narrativa integral nunca viram memória global
    automaticamente.
14. Não escreva código antes do Warlog, do Writing Plan da fatia e do primeiro teste TDD em RED.
15. Não crie Spec paralela nem gate individual: PRD, Analyst integrado e BUILD integrado são
    o contrato; o tracker registra a maturidade sem fingir aprovação.
16. Não crie documentação paralela quando um artefato canônico já possui a regra.
17. Após research ou adversarial, corrija o owner canônico e atualize o tracker; não
    arquive a resposta bruta.
18. Nunca trate instrução herdada do FlowKit como especificação do Antessala.
19. Mantenha primeiro boot e fluxo-base offline; modelo local não baixa no boot.
20. Todo uso opcional de rede deve ser explícito, informado, auditável e dispensável para
    caso, agenda e handoff.

## Fluxo de execução

Analyst define semântica; Build traduz para arquitetura. Build não inventa resposta que o
Analyst deixou aberta. O contrato das superfícies vive no BUILD integrado. Documento de
tela separado só nasce durante um Writing Plan quando sua necessidade for demonstrada;
não se cria uma segunda fonte de verdade.

```text
PRD aprovado
→ Analyst integrado
→ BUILD integrado
→ review final de congruência
→ Warlog corta minispecs verticais
→ por minispec: writing-plan.md → TDD RED → código → QA
→ QA final do fluxo ponta a ponta
```

## Comandos reais

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm test
npm run test:e2e
```

O projeto não possui script de lint. Para docs, valide YAML/JSON, links, Mermaid e
`git diff --check`; não rode CI pesado sem mudança que o justifique.

## Git e worktrees

Antes de editar, prove caminho, worktree, branch, HEAD e estado da árvore. Preserve
alterações alheias; não troque branch nem limpe arquivo sem verificar ownership. Branches
novas usam prefixo `codex/`. Commits devem ser pequenos e coerentes. Push ou PR não
autorizam merge; merge exige ordem explícita de Marco.

---

## Estado deste adaptador

Este arquivo acompanha o fluxo registrado em `hack/status.json`. Ele não cria gate,
aprovação ou autorização própria.
