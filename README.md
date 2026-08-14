# Antessala

Produto para diferenciar o agendamento da consulta pré-anestésica a partir da anamnese de
enfermagem.

> **Estado: Analyst forense redigido e aguardando revisão de Marco. Código bloqueado.**

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
5. [`hack/analysis.md`](hack/analysis.md) — Analyst canônico e síntese ponta a ponta;
6. [`hack/ANALYST.md`](hack/ANALYST.md) — índice, contratos globais e gate semântico;
7. [`hack/domains/`](hack/domains/) — sete Analysts e sete BUILDs correspondentes;
8. [`hack/BUILD.md`](hack/BUILD.md) — síntese técnica em revisão, sem autoridade de execução;
9. [`hack/CRITIC.md`](hack/CRITIC.md) — rascunho bloqueado;
10. [`hack/WARLOG.md`](hack/WARLOG.md) — rascunho bloqueado;
11. [`hack/SPRINTS.md`](hack/SPRINTS.md) — mapa ainda não aprovado;
12. [`hack/minispecs/`](hack/minispecs/) — possíveis sprints, sem autorização;
13. [`hack/qa_report.md`](hack/qa_report.md) — QA final ainda não iniciado.

## Sequência obrigatória

```text
Taskgen → PRD → Analyst → Build → Critic → Warlog → Sprints
→ Spec → Plan → TDD → código → QA da minispec
→ próxima minispec ou QA final
```

Cada seta exige assinatura de Marco no artefato anterior e no gate correspondente de
`status.json`. Cada minispec repete Spec → assinatura → Plan → assinatura → TDD → código →
QA → assinatura. Alteração material invalida a assinatura anterior.

## Fundação técnica existente

O repositório já contém Electron, React, PGlite, IPC, widgets de anamnese, catálogos
offline, tema, PDF e testes. Isso é inventário, não autorização para construir o produto.
O Analyst registra o que será reutilizado, adaptado ou rejeitado; o código só começa após
BUILD, Critic, Warlog, Sprints, Spec, Plan e primeiro teste TDD aprovados.

---

## Contrato de encerramento deste arquivo

- Artefato: `README.md`.
- Gate controlador: `taskgen` em `hack/status.json`.
- Estado: `AGUARDANDO_ASSINATURA`.
- Assinatura de Marco: `PENDENTE`.
- Data: `PENDENTE`.
- Revisão Git examinada: `PENDENTE`.
- Declaração: `PENDENTE`.

Declaração exigida: “Aprovo o README como parte do bundle Taskgen do Antessala.”

Sem essa assinatura, este arquivo não terminou e não autoriza a próxima fase.
