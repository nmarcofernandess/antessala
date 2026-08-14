# Antessala — contrato operacional

## Estado atual

**`AGUARDANDO ASSINATURA DO PRD` — Analyst ainda bloqueado.**

Nenhum agente pode criar ou alterar funcionalidade, schema, teste, fixture, rota, contrato
ou componente do produto nesta fase.

## Leitura obrigatória

1. `hack/PRD.md`;
2. `hack/CONTRATO-DE-APROVACAO.md`;
3. `hack/status.json`;
4. `hack/progress.md`;
5. `hack/ANALYST.md`;
6. todos os arquivos em `hack/analyst/`.

`hack/BUILD.md`, `hack/WARLOG.md` e `hack/minispecs/` são rascunhos bloqueados. Não servem
como fonte de requisito.

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

Antes da assinatura do PRD, somente revisão documental e correção do próprio gate. Depois
da assinatura, o trabalho permitido será análise em `hack/ANALYST.md` e `hack/analyst/`:

- fluxo, entidades, estados e handoffs;
- atores, logins, permissões e ownership;
- catálogo de widgets, DTOs, validações e proveniência;
- procedimentos e catálogos clínicos;
- classificação, explicação, override e reclassificação;
- capacidade, slots, agenda e concorrência;
- arquitetura da demonstração e fronteira futura;
- segurança, auditoria, testes e prova ponta a ponta;
- inventário de reuso do Antessala, DietFlow e EscalaFlow.

## Trabalho proibido agora

- editar o PRD sem reabertura formal;
- preencher Build ou Warlog como se fossem reais;
- promover minispecs, specs ou plans;
- escrever teste TDD antes do Plan;
- escrever código;
- declarar arquitetura, schema ou contrato canônico fora do Analyst;
- tratar decisão da demo como protocolo oficial do hospital.

## Gate do Build

O Build só pode começar quando:

- os cinco dossiês do Analyst estiverem completos;
- a matriz mestra não contiver `a definir`;
- todos os campos, DTOs e permissões estiverem fechados;
- todos os estados, falhas e handoffs estiverem fechados;
- classificação e agenda tiverem contratos completos;
- a arquitetura e a estratégia de prova estiverem decididas;
- `hack/ANALYST.md` declarar `READY FOR BUILD`.

Até isso acontecer, parar no Analyst não é burocracia. É o trabalho.
