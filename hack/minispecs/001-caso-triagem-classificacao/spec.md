# MiniSpec 001 — Caso, triagem e classificação

**Status:** `READY FOR BUILD`
**Dependência externa:** nenhuma
**Agenda:** fora desta fatia

## Objetivo

Entregar:

```text
recepção cria caso sintético
→ enfermagem realiza anamnese
→ sistema sugere RAPIDO, NORMAL ou ESTENDIDO
→ enfermagem confirma ou altera
→ caso fica PRONTO_PARA_AGENDAR
```

## Escopo

- modelo/migration do caso e eventos;
- handlers IPC;
- entrada do encaminhamento pela recepção;
- fila de casos aguardando triagem;
- composer com widgets necessários;
- classificador puro com razões e pendências;
- confirmação/override com motivo;
- linha do tempo mínima;
- fixtures Carlos, Marina, Joana e Paulo.

## Fora

- agenda e booking;
- avaliação do anestesiologista;
- login real;
- integração externa;
- protocolo clínico oficial.

## Aceite

- [ ] Recepção cria caso e envia à triagem.
- [ ] Enfermagem preenche e salva anamnese.
- [ ] Três fixtures produzem as três categorias.
- [ ] Razões da recomendação aparecem.
- [ ] Dado mínimo ausente gera pendência.
- [ ] Override preserva sugestão e motivo.
- [ ] Caso confirmado chega a `PRONTO_PARA_AGENDAR`.
- [ ] Testes, typecheck e build verdes.
