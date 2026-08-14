# Antessala

Produto para diferenciar o agendamento da consulta pré-anestésica a partir da anamnese de
enfermagem.

> **Estado: `ANALYST IN PROGRESS`. Nenhum Build, teste novo ou código está autorizado.**

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
2. [`hack/ANALYST.md`](hack/ANALYST.md) — fase ativa e barreira do Build;
3. [`hack/analyst/`](hack/analyst/) — dossiês de domínio, atores, dados, agenda e prova;
4. [`hack/BUILD.md`](hack/BUILD.md) — rascunho bloqueado;
5. [`hack/WARLOG.md`](hack/WARLOG.md) — rascunho bloqueado;
6. [`hack/minispecs/`](hack/minispecs/) — possíveis sprints, ainda sem autorização.

## Sequência obrigatória

```text
PRD → Analyst → Build → Warlog → Sprints → Spec → Plan → TDD → código
```

Não se cria artefato de uma fase antes que a anterior esteja concluída. O Analyst só libera
o Build quando fechar o fluxo ponta a ponta, os dados, os DTOs dos widgets, os papéis, as
permissões, a classificação, a agenda, a arquitetura e a estratégia de prova.

## Fundação técnica existente

O repositório já contém Electron, React, PGlite, IPC, widgets de anamnese, catálogos
offline, tema, PDF e testes. Isso é inventário, não autorização para construir o produto.
O Analyst decidirá o que será copiado, adaptado, mantido ou rejeitado.
