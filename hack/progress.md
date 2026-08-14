# Progresso — Antessala

## Estado atual

- PRD: `APPROVED_PRODUCT_BASELINE` por decisão explícita de Marco em `2026-08-14`.
- Analyst: `CONSOLIDATED_FOR_BUILD` em [analysis.md](analysis.md).
- BUILD: `ADJUSTED_AFTER_EXTERNAL_REVIEW` em [BUILD.md](BUILD.md).
- Fase atual: publicar as correções e verificar no novo SHA somente os bloqueadores
  confirmados pelo review final.
- Código de produto: ainda não autorizado; primeiro o Warlog corta as minispecs.

Os oito Analysts e oito Builds de domínio foram absorvidos pelas sínteses principais. Eles
permanecem como anexos de detalhe, sem assinatura ou gate individual. Em conflito,
`analysis.md` e `BUILD.md` prevalecem.

## O que foi fechado

- [x] Problema, goal, atores, fluxo e fronteiras do PRD.
- [x] Semântica ponta a ponta de caso, acesso, anamnese, requisito, agenda, avaliação,
      handoff, superfícies, arquitetura offline e IA/memória.
- [x] Arquitetura integrada com ownership, persistência, DTOs, IPC, transações, rotas e
      estratégia de prova.
- [x] Gemini único e sintético; IA assistiva; memória somente após aprovação e ativação.
- [x] Produção institucional, dados reais e protocolo do HC declarados fora do escopo.
- [x] Gates individuais, Spec duplicada e Plan assinado removidos.
- [x] Matriz literal `demo-workload-v1` fechada, com `desiredBy` em eixo separado.
- [x] Perfil `PITCH_CRITICAL` separa a demonstração ponta a ponta do hardening posterior.
- [x] Placeholders antigos de Critic, Warlog, Sprints e minispecs descartados.
- [x] Review final de congruência executado no SHA publicado e bloqueadores confirmados
      incorporados.
- [ ] Correções verificadas no novo SHA publicado, sem P0 material restante.
- [ ] Warlog criado e minispecs cortadas.
- [ ] Writing Plans, TDD, implementação e QA executados.

## Fluxo operacional

```text
PRD aprovado
→ analysis.md integrado
→ BUILD.md integrado
→ review final de congruência
→ WARLOG.md corta minispecs
→ writing-plan.md da fatia
→ primeiro teste TDD em RED
→ implementação
→ QA da fatia
→ próxima fatia
→ QA final ponta a ponta
```

Não existe `spec.md` por minispec. PRD + Analyst + BUILD são a especificação. O Writing
Plan traduz a fatia em arquivos, passos, testes e provas; não redecide produto ou arquitetura.

## Próxima ação exata

Publicar esta correção e pedir ao GPT Pro para verificar, no novo SHA, somente se os P0
confirmados foram fechados e se surgiu alguma contradição material. Sem P0, mudar o BUILD
para `READY_FOR_WARLOG`, criar `WARLOG.md`, cortar as minispecs e produzir o primeiro
Writing Plan.
