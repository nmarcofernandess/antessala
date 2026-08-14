# MiniSpec 002 — Capacidade, agenda e booking

**Status:** `READY AFTER MINISPEC 001`
**Dependência externa:** nenhuma

## Objetivo

Entregar:

```text
recepção abre caso pronto
→ vê slots sintéticos compatíveis
→ reserva uma vaga
→ caso fica AGENDADO
```

## Escopo

- modelo/migration e seed de slots;
- tipos `RAPIDO`, `NORMAL` e `ESTENDIDO`;
- lista ou grade de agenda;
- filtro automático por categoria confirmada;
- booking transacional;
- conflito de slot ocupado;
- resposta para ausência de vaga;
- linha do tempo.

## Fora

- FullCalendar obrigatório;
- agenda hospitalar real;
- sync/multiusuário real;
- centro cirúrgico;
- comunicação externa.

## Aceite

- [ ] Cada categoria encontra somente slots compatíveis.
- [ ] Recepção agenda um caso pronto.
- [ ] Booking associa caso/slot e muda estado atomicamente.
- [ ] Slot ocupado não aceita segunda reserva.
- [ ] Falta de vaga tem resposta clara.
- [ ] Caso não pronto não agenda.
- [ ] Testes, typecheck e build verdes.
