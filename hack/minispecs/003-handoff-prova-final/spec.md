# MiniSpec 003 — Avaliação, handoff e prova final

**Status:** `READY AFTER MINISPEC 002`
**Dependência externa:** nenhuma

## Objetivo

Entregar:

```text
anestesiologista abre agenda
→ avalia paciente
→ conclui ou cria pendência/retorno
→ conclui avaliação
→ serviço solicitante recebe resumo
```

## Escopo

- agenda do anestesiologista;
- início da avaliação;
- resultado concluído, pendente ou retorno;
- nova data de retorno usando agenda sintética;
- resumo final;
- confirmação de entrega ao serviço solicitante;
- linha do tempo completa;
- roteiro e prints da demo.

## Fora

- laudo hospitalar oficial;
- assinatura digital;
- marcação da cirurgia;
- PEP/agenda/API real;
- app do paciente.

## Aceite

- [ ] Caso agendado entra em avaliação.
- [ ] Caso simples conclui diretamente.
- [ ] Caso pendente registra motivo e retorno.
- [ ] Retorno pode concluir depois.
- [ ] Serviço solicitante recebe resumo final.
- [ ] Handoff muda para `ENTREGUE_AO_SOLICITANTE`.
- [ ] Linha do tempo conta o fluxo completo.
- [ ] Demo usa somente dados sintéticos.
- [ ] Testes, typecheck, build e prints finais verdes.
