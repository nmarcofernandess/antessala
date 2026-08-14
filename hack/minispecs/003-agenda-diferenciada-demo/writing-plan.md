# Writing plan — MiniSpec 003 · Agenda diferenciada e demo

**Status:** `BLOCKED`

**Este arquivo não escolhe agenda nem biblioteca.**

---

## Passo 0 · Checar o gate e parar sem `PASS`

1. Ler o veredito vigente do [`../../ANALYST.md`](../../ANALYST.md).
2. Exigir a frase `PASS MINISPEC 003` e o contrato completo no formato obrigatório de
   `PASS`.
3. Confirmar as provas finais da MiniSpec 002 no SHA registrado.
4. Confirmar caminho A, B ou C, recursos, restrições, concorrência, mocks, papéis,
   fixtures e oráculo.

Sem qualquer item, **PARAR**. Não instalar calendário, criar tabela de slot, desenhar
grade ou implementar adaptador especulativo.

## Passo 1 · Congelar o contrato de capacidade

1. Traduzir o `PASS` em entradas, saídas, estados, transições, regra temporal e erros.
2. Registrar quais eixos do requisito participam da compatibilidade.
3. Definir o mínimo clínico visível ao agendamento.
4. Confirmar tratamento de falta de capacidade, conflito e indisponibilidade externa.

**Saída:** contrato executável do caminho aprovado. Lacuna devolve o sprint ao Analyst.

## Passo 2 · Materializar fixtures e oráculo

1. Implementar somente as fixtures sintéticas aprovadas.
2. Cobrir um par de contraste controlado, um controle negativo, mudança de procedimento,
   caso não pronto, vaga incompatível e falta de capacidade.
3. Cobrir concorrência e dupla reserva apenas no caminho B.
4. Marcar em dado e interface todo valor fictício ou adaptador mockado.

**Saída:** cenário determinístico que falha antes da implementação.

## Passo 3 · Implementar compatibilidade como domínio

1. Escrever testes de aceitação/rejeição antes da implementação.
2. Implementar comparação entre requisito revisado e capacidade sem dependência de UI.
3. Retornar razões estruturadas para compatibilidade, recusa e falta de capacidade.
4. Preservar a decisão humana e a versão de regra que originaram o requisito.

**Saída:** motor operacional puro; nenhuma decisão clínica nova.

## Passo 4 · Implementar somente o caminho aprovado

### Se A

1. Implementar o adaptador de saída ou o handoff manual definido.
2. Registrar entrega, rejeição e motivo sem fingir reserva.

### Se B

1. Implementar migrations de recurso, disponibilidade, slot e agendamento aprovados.
2. Garantir atomicidade/idempotência e impedir dupla reserva.
3. Implementar a visualização com a biblioteca já aprovada, sem mover regra para o
   calendário.

### Se C

1. Implementar o adaptador pelo contrato real da TI.
2. Usar sandbox autorizado; se indisponível, usar mock fiel e ostensivamente marcado.
3. Tratar timeout, rejeição, repetição e indisponibilidade conforme contrato.

Executar apenas um caminho. Mudança de caminho exige novo veredito do Analyst.

## Passo 5 · Conectar as superfícies mínimas

1. Consumir a saída revisada da MiniSpec 002 pelo contrato, sem ler detalhe clínico
   desnecessário.
2. Exibir opções compatíveis, razões, restrições e falta de capacidade ao papel correto.
3. Permitir a ação humana aprovada e registrar autoria/instante.
4. Garantir que fixture, mock e integração futura sejam distinguíveis na interface.

**Saída:** fluxo do requisito à recomendação/alocação, sem superfície extra inventada.

## Passo 6 · Montar a demonstração end-to-end

1. Executar os casos aprovados da solicitação ao resultado operacional.
2. Provar pelo oráculo que o par de contraste recebe requisitos/tratamentos distintos e
   que o controle negativo permanece igual.
3. Mostrar mudança de procedimento, pendência e ausência de capacidade.
4. Comparar fluxo indiferenciado e diferenciado apenas pelo oráculo contratado.
5. Não apresentar KPI clínico ou operacional sem baseline.

**Saída:** roteiro reproduzível e explicável da demo.

## Passo 7 · Provar fronteiras e qualidade

1. Rodar testes de domínio, integração/adaptador, concorrência aplicável, permissões e
   end-to-end.
2. Rodar typecheck, suíte proporcional, build e prova visual no SHA final.
3. Recriar os dados locais e provar primeiro boot sem dependência de rede.
4. Confirmar que nenhuma tela ou texto afirma integração, homologação ou métrica
   inexistente.

**Saída:** recibos vinculados ao SHA entregue.

## Passo 8 · Encerrar sob o Analyst

1. Atualizar o Analyst com caminho implementado, limites e provas.
2. Acrescentar ao Warlog decisões, desvios, mocks, métricas indisponíveis e SHA.
3. Solicitar `PASS DEMO`.

Sem `PASS DEMO`, o projeto permanece bloqueado. Não renomear o resultado como piloto,
produção ou solução homologada para contornar o gate.
