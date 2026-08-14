# Writing Plan 002 — consulta e entrega

## Resultado

Levar o booking confirmado a check-in, avaliação anestésica, pendência opcional, retorno,
resultado versionado e recebimento pelo serviço solicitante, sem atribuir ASA ou aptidão.

## Passos TDD

1. RED: check-in explícito habilita encontro; iniciar sem check-in falha.
2. Implementar encontros e rascunho parcial de avaliação.
3. RED: evidência submetida não resolve pendência; somente revisão clínica aceita/reabre e
   somente decisão explícita cria retorno.
4. Implementar pendências discriminadas, documentos metadata/hash e ReturnRequest.
5. RED: retorno usa requisito completo, reserva compatível e novo check-in.
6. Integrar booking RETURN e retomada do encontro.
7. RED: finalizar falha com blocker atual; cria versão 1, correção/adendo cria sucessora e
   preserva histórico.
8. Implementar head de resultado, projeções por papel, PDF e delivery.
9. Implementar rotas S08–S11 e estados de erro/conflito/vazio.
10. Fechar testes focados, typecheck e E2E da fatia.

## Aceite

- recepção vê status, nunca conteúdo ou bytes do PDF;
- solicitante só acessa o próprio serviço;
- evidência não equivale a suficiência;
- retorno não nasce automaticamente;
- resultado corrigido não sobrescreve versão anterior;
- PDF é gerado pelo Electron, sem rede, e não marca entrega sozinho.

