# Progresso — Antessala

## Estado atual

- Rota: `analyst_prd`, orçamento `forensic`.
- Fase formal: `taskgen_review_and_signature`.
- Autoridade: revisão documental; teste e código continuam proibidos.
- Decisão: `needs_analysis`.
- Assinaturas de Marco: nenhuma.
- Tracker único de research/review: [`.context/review/STATUS.md`](../.context/review/STATUS.md).

O PRD permanece intocado nesta rodada. O pacote agora possui oito pares
Analyst/Build, mas nenhum deles está aprovado. O Build de IA, memória e conhecimento é
somente `DRAFT/BLOCKED`.

## O que esta rodada estabeleceu

- [x] `.context/` mínimo com produto, workflow, arquitetura e tracker.
- [x] README humano e instruções Antessala em `CLAUDE.md` e `AGENTS.md`.
- [x] Recon do HEAD separando `ACTIVE`, `DORMANT`, `INCOMPLETE` e `REMOVED`.
- [x] Analyst de IA, memória e conhecimento criado como `RESEARCH_REQUIRED`.
- [x] Build pareado criado sem schema, DTO ou implementação inventados.
- [x] Estados enganosos de prontidão rebaixados.
- [x] Decisões de pitch identificadas como `DEMO_DECISION`.
- [x] Warlog, Sprints, MiniSpecs, Specs, Plans, TDD, implementação e QA mantidos bloqueados.
- [ ] Research clínico, regulatório e operacional concluído.
- [ ] Recon técnico dos Builds concluído.
- [ ] Adversarial por domínio concluído.
- [ ] Surface Blueprints e reconstrução cega produzidos durante o fechamento do Build.
- [ ] Marco assinou Taskgen, PRD, Analyst ou Build.

O estado por artefato, o SHA revisado e a próxima ação vivem somente no
[tracker](../.context/review/STATUS.md).

## Fluxo obrigatório

```text
Taskgen assinado
→ PRD assinado
→ Analyst pesquisado, revisado e assinado
→ BUILD + Critic assinados
→ Warlog assinado
→ Sprints assinadas
→ para cada MiniSpec:
   Spec assinada → Plan assinado → TDD RED → implementação → QA assinado
→ QA final assinado
```

## Próxima ação permitida

Concluir as lacunas de pesquisa de `ANALYST-anamnese-e-catalogos.md` e executar review
adversarial multiprofissional sobre o SHA corrigido: semântica de ausência, competência do
enfermeiro/técnico, campos clínicos, licenças e correção pós-publicação. O Build pareado está
invalidado e não pode ser refeito antes de Analyst assinado.

---

## Contrato de encerramento deste arquivo

- Artefato: `progress.md`
- Próxima fase autorizada: nenhuma
- Estado: `EM_REVISÃO`
- Assinatura de Marco: `PENDENTE`
- Data: `PENDENTE`
- Revisão Git examinada: `PENDENTE`
- Declaração: `PENDENTE`

Sem assinatura válida, este registro permanece aberto.
