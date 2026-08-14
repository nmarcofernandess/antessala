# Writing plan — MiniSpec 001 · Caso, triagem e classificação

**Status:** `BLOCKED`

**Este arquivo não é autorização de build.**

## Passo 0 · Checar o gate

1. Exigir `PASS MINISPEC 001` no [`../../ANALYST.md`](../../ANALYST.md).
2. Conferir evidência, responsável, contrato, fixture, impacto no legado e rollback.
3. Parar se qualquer P0 da fatia estiver aberto.

## Passo 1 · Congelar o corte aprovado

Transformar cada decisão em ator, entrada, saída, estado, regra temporal, permissão,
falha, fixture e aceite. Listar os arquivos legados afetados e a ação aprovada. Qualquer
lacuna devolve o trabalho ao Analyst.

## Passo 2 · Contratos e testes de domínio

Materializar schemas de identidade, caso, fatos, protocolo, avaliação, revisão,
`SchedulingRequirement` e auditoria. Escrever primeiro os testes de estados impossíveis,
ausência, conflito, versionamento, mudança de procedimento e RBAC.

## Passo 3 · Persistência, autenticação e migração

Criar migrations determinísticas, autorização no limite confiável e persistência
append-only onde o contrato exigir. Aplicar manter/adaptar/migrar/desativar/remover sem
remendar a antiga jornada.

## Passo 4 · Catálogos, protocolos e coleta

Versionar somente conteúdo aprovado. Compor widgets P0 pelo protocolo, implementar
proveniência/temporalidade/ausência/conflito e refazer apenas o JSX necessário com os
componentes do app.

## Passo 5 · Avaliação explicável

Implementar regras puras e versionadas. Associar toda saída a entradas e regra; converter
ausência/conflito em pendência; impedir qualquer aparência de aptidão ou conduta não
aprovada.

## Passo 6 · Revisão humana e auditoria

Exibir somente o necessário ao papel autorizado. Permitir confirmar/corrigir/rejeitar,
exigir motivo conforme contrato e preservar sugestão, decisão, ator, instante e versão.

## Passo 7 · Integrar a fatia sem agenda

Conectar intake, coleta, avaliação, revisão e requisito operacional. Mocks e fixtures
ficam visivelmente marcados. Nenhum slot, calendário ou reserva entra.

## Passo 8 · Provar e fechar

Rodar testes de contrato, migração, regras, RBAC e fluxo; typecheck, suíte proporcional,
build e prova visual no SHA final. Atualizar Analyst/Warlog e pedir revisão da MiniSpec
002. Sem novo `PASS`, parar.
