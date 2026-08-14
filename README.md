# Antessala

Produto para diferenciar o agendamento da consulta pré-anestésica a partir da anamnese de
enfermagem.

> **Estado: `AGUARDANDO ASSINATURA DO PRD`. O Analyst ainda não está autorizado.**

## Problema

A recepção precisa reservar a consulta pré-anestésica, mas não deve interpretar dados
clínicos. A enfermagem coleta a anamnese, porém essa avaliação precisa virar uma orientação
operacional de agenda: vaga rápida, normal ou estendida.

## Fluxo canônico

```text
médico indica procedimento e entrega encaminhamento
→ recepção recebe o encaminhamento
→ enfermagem realiza a anamnese
→ triagem define a necessidade da vaga
→ recepção agenda uma vaga compatível
→ anestesiologista conclui ou registra pendência e retorno
→ resultado volta ao serviço solicitante
```

A triagem geral do SUS acontece antes. A marcação da cirurgia acontece depois. As duas
ficam fora do Antessala.

## Documentação

1. [`hack/PRD.md`](hack/PRD.md) — contrato do produto, congelado;
2. [`hack/status.json`](hack/status.json) — GPS mecânico e assinaturas dos gates;
3. [`hack/progress.md`](hack/progress.md) — recibo humano do estado;
4. [`hack/CONTRATO-DE-APROVACAO.md`](hack/CONTRATO-DE-APROVACAO.md) — regra de assinatura;
5. [`hack/ANALYST.md`](hack/ANALYST.md) — rascunho bloqueado pelo PRD;
6. [`hack/analyst/`](hack/analyst/) — dossiês de domínio, atores, dados, agenda e prova;
7. [`hack/BUILD.md`](hack/BUILD.md) e [`hack/CRITIC.md`](hack/CRITIC.md) — rascunhos bloqueados;
8. [`hack/WARLOG.md`](hack/WARLOG.md) — rascunho bloqueado;
9. [`hack/SPRINTS.md`](hack/SPRINTS.md) — mapa ainda não aprovado;
10. [`hack/minispecs/`](hack/minispecs/) — possíveis sprints, sem autorização;
11. [`hack/qa_report.md`](hack/qa_report.md) — QA final ainda não iniciado.

## Sequência obrigatória

```text
Taskgen → PRD → Analyst → Build → Critic → Warlog → Sprints
→ Spec → Plan → TDD → código → QA
```

Cada seta exige assinatura de Marco no artefato anterior e no gate correspondente de
`status.json`. Cada minispec repete Spec → assinatura → Plan → assinatura → TDD → código →
QA → assinatura. Alteração material invalida a assinatura anterior.

## Fundação técnica existente

O repositório já contém Electron, React, PGlite, IPC, widgets de anamnese, catálogos
offline, tema, PDF e testes. Isso é inventário, não autorização para construir o produto.
O Analyst decidirá o que será copiado, adaptado, mantido ou rejeitado.
