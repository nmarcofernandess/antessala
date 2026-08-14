# Progresso — Antessala

## Estado atual

- Rota: `analyst_prd` com orçamento `forensic`.
- Fase atual: `human_approval_contract_and_prd`.
- Taskgen: pacote durável organizado com PRD, `status.json` e este `progress.md`.
- Próxima transição pedida: PRD → Analyst.
- Gate: bloqueado até Marco assinar o contrato de aprovação e o PRD.

## Fluxo obrigatório

```text
Taskgen
→ PRD + assinatura Marco
→ Analyst forense + assinatura Marco
→ Build + Critic + assinatura Marco
→ Warlog-base + assinatura Marco
→ Sprints + assinatura Marco
→ para cada minispec:
   Spec + assinatura Marco
   → Plan + assinatura Marco
   → primeiro teste TDD em RED
   → implementação
   → QA + assinatura Marco
→ QA final + assinatura Marco
→ concluído
```

## Registro

- [x] PRD redigido.
- [x] Analyst e dossiês criados como rascunhos.
- [x] Build, Warlog e minispecs marcados como bloqueados.
- [x] Código prematuro removido.
- [x] Contrato de aprovação humana definido.
- [x] Gate mecânico registrado em `status.json`.
- [ ] Marco assinou o contrato de aprovação.
- [ ] Marco assinou o PRD.
- [ ] Analyst autorizado.

## Próxima ação permitida

Marco revisa e assina `CONTRATO-DE-APROVACAO.md` e `PRD.md`. Até isso ocorrer, nenhum
dossiê do Analyst pode ser promovido de rascunho para trabalho ativo.

---

## Contrato de encerramento deste arquivo

- Artefato: `progress.md`
- Próxima fase autorizada: nenhuma; este arquivo apenas registra o gate
- Estado: `AGUARDANDO_ASSINATURA`
- Assinatura de Marco: `PENDENTE`
- Data: `PENDENTE`
- Revisão Git examinada: `PENDENTE`
- Declaração: `PENDENTE`

Sem assinatura válida, este registro permanece aberto.
