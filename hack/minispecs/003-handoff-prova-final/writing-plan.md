# Writing plan — MiniSpec 003 · Handoff e prova final

**Status:** `BLOCKED`

**Este arquivo não amplia a fronteira do produto.**

## Passo 0 · Checar o gate

Exigir `PASS MINISPEC 003`, provas dos dois sprints anteriores e contrato completo do
handoff, estados finais, papéis, dados, documentos, fixtures, falhas e oráculo. Sem isso,
parar.

## Passo 1 · Congelar o final aprovado

Traduzir o `PASS` em eventos, estados, ator, permissões, entrada/saída, regra temporal,
falhas e rollback. Declarar nominalmente tudo que não será construído.

## Passo 2 · Testes do handoff

Escrever testes para sucesso, rejeição, indisponibilidade, retry/idempotência, reabertura
e acesso negado conforme o contrato. Nenhum teste presume consulta ou laudo não
confirmado.

## Passo 3 · Implementar o estado terminal

Conectar o resultado da MiniSpec 002 ao ator/sistema seguinte, registrar auditoria e
tratar falhas recuperáveis. Implementar consulta/retorno apenas quando aprovados.

## Passo 4 · Documentos e superfícies finais

Criar somente as superfícies mínimas e documentos com finalidade, destinatário,
conteúdo, autoria e retenção definidos. Preservar minimização de dados.

## Passo 5 · Montar a demonstração

Executar casos contrastantes e controle negativo; mostrar ausência, conflito, override,
mudança de procedimento, falta de capacidade, conflito e falha. Rotular fixture/mock.

## Passo 6 · Prova adversarial

Testar permissão, dado ausente, regra vencida, protocolo trocado, duas reservas quando
aplicável, retry, perda de rede e vazamento de informação entre papéis.

## Passo 7 · Lacrar o SHA

Rodar testes proporcionais, typecheck, build, E2E e prova visual. Confirmar primeiro boot
e ausência de alegação falsa. Registrar recibos no Warlog e pedir `PASS DEMO`.
