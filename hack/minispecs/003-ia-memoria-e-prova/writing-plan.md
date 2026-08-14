# Writing Plan 003 — IA, memória e prova

## Resultado

Demonstrar uma proposta Gemini sobre transcript sintético digitado, decisão humana por
campo e recuperação textual de uma relação de conhecimento aprovada e ativada, sem tornar
IA ou rede dependência do caso.

## Passos TDD

1. RED: transcript aceita apenas fixture sintética e proposta nasce `DRAFT` com origem,
   evidência, modelo e versão da instrução.
2. Implementar persistência, gateway Gemini único e validação estrita do lote.
3. RED: aceitar/corrigir aplica uma operação do draft atomicamente; rejeitar não cria
   negativa; revisão stale invalida proposta.
4. Implementar review por campo na triagem.
5. RED: relação sugerida não aparece na busca; aprovada continua inativa; somente ativada é
   recuperada; retirada some da busca sem apagar histórico.
6. Implementar `/conhecimento` e configuração Gemini com segredo protegido pelo main.
7. Provar falha/rede ausente com fallback manual.
8. Executar suíte completa, typecheck, build, E2E e prova do primeiro boot offline.

## Aceite

- nenhum chat genérico participa do fluxo;
- IA não decide duração, prioridade, urgência, ASA, aptidão ou conduta;
- caso individual nunca vira conhecimento global automaticamente;
- busca vazia não inventa resposta;
- segredo e conteúdo sintético não aparecem em logs/auditoria;
- fluxo completo continua funcional sem Gemini.

