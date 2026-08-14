# Writing plan — MiniSpec 002 · Capacidade, agenda e booking

**Status:** `BLOCKED`

**Este arquivo não escolhe calendário nem arquitetura.**

## Passo 0 · Checar o gate

Exigir `PASS MINISPEC 002`, provas da MiniSpec 001 e contrato completo de caminho,
capacidade, concorrência, mocks, papéis, fixtures e oráculo. Sem qualquer item, parar.

## Passo 1 · Congelar o contrato de capacidade

Traduzir o `PASS` em entradas, saídas, estados, transições, regras temporais, permissões e
erros. Definir o mínimo clínico visível e a resposta a conflito/indisponibilidade.

## Passo 2 · Materializar fixtures e oráculo

Implementar par de contraste, controle negativo, mudança de procedimento, caso não
pronto, vaga incompatível, falta de capacidade e concorrência aplicável. Marcar todo
valor fictício e adaptador mockado.

## Passo 3 · Compatibilidade como domínio

Escrever testes antes da implementação. Comparar requisito e capacidade fora da UI e
retornar razões estruturadas para compatibilidade, recusa e ausência de vaga.

## Passo 4 · Implementar somente A, B ou C

- **A:** handoff/entrega e rejeição, sem reserva fictícia.
- **B:** migrations, atomicidade/idempotência, booking e projeção aprovada.
- **C:** adaptador real ou mock fiel; timeout, retry, rejeição e indisponibilidade.

Mudança de caminho exige novo veredito.

## Passo 5 · Conectar superfícies mínimas

Consumir somente a saída da MiniSpec 001, exibir opções/razões ao papel correto, executar
a ação humana aprovada e registrar autoria/instante.

## Passo 6 · Provar e fechar

Rodar domínio, integração/adaptador, concorrência, RBAC, typecheck, suíte proporcional,
build e prova visual no SHA final. Atualizar Analyst/Warlog e pedir `PASS MINISPEC 003`.
