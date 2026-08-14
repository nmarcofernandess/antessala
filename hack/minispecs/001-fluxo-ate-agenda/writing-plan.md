# Writing Plan 001 — fluxo até agenda

## Resultado

Demonstrar, em PGlite local, cinco contas fixture e o caminho recepção → enfermagem →
recepção: criar encaminhamento autônomo, preencher anamnese sem transformar ausência em
negativa, calcular requisito explicável, confirmar/alterar com justificativa e reservar
somente slot compatível.

## Passos TDD

1. RED: schema/seed cria contas, caso, eventos, anamnese, requisito, recursos, slots e
   booking idempotentes sem rede.
2. Implementar migrations incrementais e seed sintético determinístico.
3. RED: login retorna sessão/capabilities; outro papel ou serviço recebe `FORBIDDEN` ou
   `NOT_FOUND` sem conteúdo.
4. Implementar auth local, guards e auditoria sanitizada no main.
5. RED: caso novo aceita homônimo e referência repetida confirmada; replay do mesmo request
   não duplica.
6. Implementar caso, handoff e timeline.
7. RED: anamnese preserva `ANSWERED(false)`, estados de ausência e proveniência; submissão
   produz requisito `CALCULATED` explicável sem inferência clínica.
8. Implementar os 14 widgets do template da PoC sobre o composer existente e confirmação ou
   override humano.
9. RED: reserva aceita somente slot compatível, impede sobreposição e mantém antecedência
   separada da duração.
10. Implementar worklists, grade/lista de agenda e rotas S00–S07.
11. Fechar testes focados, typecheck e E2E da fatia.

## Arquivos previstos

- `src/main/db/migrations/*`, `src/main/db/seed.ts`;
- `src/shared/{auth,clinical,scheduling}/**`;
- `src/main/{auth,audit,clinical,scheduling}/**` e composição em `src/main/tipc.ts`;
- `src/renderer/src/{auth,paginas,componentes}/**`, `App.tsx`, `AppSidebar.tsx`;
- `tests/{shared,main,renderer,e2e}/**`.

## Aceite

- primeiro teste nasce vermelho antes da implementação;
- duas pessoas de mesmo nome viram casos distintos;
- silêncio não vira `false`;
- requisito mostra regra, sinais e autoria humana;
- recepção não lê conteúdo clínico;
- booking incompatível ou concorrente falha sem efeito parcial;
- boot e fluxo não acessam internet.

