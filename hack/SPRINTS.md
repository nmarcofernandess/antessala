# Sprints e minispecs — Antessala

> **RASCUNHO BLOQUEADO — A ORDEM AINDA NÃO FOI APROVADA**

**Estado:** `BLOCKED BY WARLOG`

O Build definirá as fatias verticais. O Warlog registrará a decisão. Só então este arquivo
congelará a ordem das minispecs.

Hoje existem três reservas de espaço, ainda não autorizadas:

1. `001-caso-triagem-classificacao`;
2. `002-capacidade-agenda-booking`;
3. `003-handoff-prova-final`.

O número, o nome, a dependência e o escopo podem mudar antes da assinatura de Marco.

## Contrato de cada minispec

Cada minispec seguirá seu próprio ciclo:

```text
spec.md
→ assinatura Marco
→ plan.md
→ assinatura Marco
→ primeiro teste TDD em RED
→ implementação
→ qa_report.md
→ assinatura Marco
→ próxima minispec
```

O Plan deve produzir a fonte executável `implementation_plan.json`. O arquivo `plan.md`
serve como contrato humano e permanece rascunho até essa fase.

---

## Contrato de encerramento deste arquivo

- Artefato: `SPRINTS.md`
- Próxima fase autorizada: Spec da primeira minispec
- Estado: `AGUARDANDO_WARLOG_E_ASSINATURA`
- Assinatura de Marco: `PENDENTE`
- Data: `PENDENTE`
- Revisão Git examinada: `PENDENTE`
- Declaração: `PENDENTE`

Sem assinatura válida, nenhuma Spec de minispec pode começar.
