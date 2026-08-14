# Antessala — contrato operacional

## Estado atual

**`ANALYST PRONTO PARA REVISÃO HUMANA` — nenhuma implementação autorizada.**

Nenhum agente pode criar ou alterar funcionalidade, schema, teste, fixture, rota, contrato
ou componente do produto nesta fase.

## Leitura obrigatória

1. `hack/PRD.md`;
2. `hack/CONTRATO-DE-APROVACAO.md`;
3. `hack/status.json`;
4. `hack/progress.md`;
5. `hack/analysis.md`;
6. `hack/ANALYST.md`;
7. todos os `hack/domains/ANALYST-*.md`.

Os `hack/domains/BUILD-*.md` e `hack/BUILD.md` foram redigidos antecipadamente por ordem
direta de Marco para revisão conjunta. Continuam rascunhos bloqueados: não são Spec, Plan
nem autorização de execução. `hack/CRITIC.md`, `hack/WARLOG.md` e `hack/minispecs/`
permanecem bloqueados.

## Sequência imutável

```text
PRD congelado
→ assinatura Marco
→ Analyst completo → assinatura Marco
→ Build → Critic → assinatura Marco
→ Warlog-base → assinatura Marco
→ Sprints → assinatura Marco
→ Spec da minispec → assinatura Marco
→ Plan da minispec → assinatura Marco
→ primeiro teste TDD
→ código
→ QA da minispec → assinatura Marco
→ próxima minispec
→ QA final → assinatura Marco
```

Não antecipar uma fase. Não escrever “a gente vê no Build”. Não usar código existente como
desculpa para decidir o domínio por acidente.

Uma IA nunca assina por Marco. Aprovação só existe quando Marco nomeia o artefato, declara
`APROVADO`, informa a revisão examinada e autoriza a próxima fase. Qualquer alteração
material posterior invalida a assinatura.

## Lei do produto

```text
encaminhamento chega à recepção
→ enfermagem realiza anamnese pré-anestésica
→ triagem produz necessidade de vaga rápida, normal ou estendida
→ recepção agenda vaga compatível
→ anestesiologista avalia, conclui ou abre pendência/retorno
→ resultado volta ao serviço solicitante
```

Triagem geral do SUS e marcação da cirurgia ficam fora.

## Trabalho permitido agora

Somente revisão e reconciliação do PRD, `analysis.md`, sete Analysts e sete BUILDs de
domínio:

- fluxo, entidades, estados e handoffs;
- atores, logins, permissões e ownership;
- catálogo de widgets, DTOs, validações e proveniência;
- procedimentos e catálogos clínicos;
- classificação, explicação, override e imutabilidade após publicação;
- capacidade, slots, agenda e concorrência;
- arquitetura da demonstração e fronteira futura;
- segurança, auditoria, testes e prova ponta a ponta;
- inventário de reuso do Antessala, DietFlow e EscalaFlow.

## Trabalho proibido agora

- editar materialmente o PRD sem ordem direta ou reabertura formal;
- promover BUILD ou Warlog como se estivessem aprovados;
- promover minispecs, specs ou plans;
- escrever teste TDD antes do Plan;
- escrever código;
- declarar arquitetura, schema ou contrato canônico fora do Analyst;
- tratar decisão da demo como protocolo oficial do hospital.

## Gate do Build

O BUILD formal só pode começar quando:

- os sete dossiês do Analyst estiverem completos;
- `analysis.md` não contiver decisão obrigatória aberta;
- todos os campos, DTOs e permissões estiverem fechados;
- todos os estados, falhas e handoffs estiverem fechados;
- classificação e agenda tiverem contratos completos;
- a arquitetura e a estratégia de prova estiverem decididas;
- Marco assinar o PRD e o conjunto do Analyst.

Até isso acontecer, parar no Analyst não é burocracia. É o trabalho.

---

## Contrato de encerramento deste arquivo

- Artefato: `CLAUDE.md`.
- Gate controlador: `taskgen` em `hack/status.json`.
- Estado: `AGUARDANDO_ASSINATURA`.
- Assinatura de Marco: `PENDENTE`.
- Data: `PENDENTE`.
- Revisão Git examinada: `PENDENTE`.
- Declaração: `PENDENTE`.

Declaração exigida: “Aprovo o contrato operacional como parte do bundle Taskgen do Antessala.”

Sem essa assinatura, este arquivo não terminou e não autoriza a próxima fase.
