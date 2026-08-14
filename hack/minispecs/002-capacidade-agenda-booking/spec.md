# MiniSpec 002 — Capacidade, agenda e booking

**Status:** `BLOCKED BY ANALYST`

**Execução:** proibida até `PASS MINISPEC 002` explícito

**Dependência:** MiniSpec 001 concluída e provada

---

## 1. Objetivo

Traduzir o requisito revisado em uso de capacidade compatível. O sprint executa somente
o caminho aprovado:

- **A — qualificação:** handoff a agenda externa/operação manual, sem calendário próprio;
- **B — agenda demonstrativa:** recursos, disponibilidade e booking mínimos;
- **C — integração institucional:** contrato real da TI; sem ele, adaptador mockado.

## 2. Dependências que bloqueiam a entrada

O Analyst precisa registrar:

- significado comprovado de “agendamento semelhante”;
- caminho A, B ou C;
- contrato final de `SchedulingRequirement`;
- recursos, tempo, disponibilidade, restrições e tipos de vaga;
- prioridade/capacidade protegida, se existirem;
- falta de vaga, encaixe, remarcação e cancelamento definidos ou fora;
- concorrência, atomicidade e idempotência aplicáveis;
- arquitetura, source of truth, offline e sync por operação;
- integração/mock fronteira por fronteira;
- biblioteca visual aprovada, se necessária;
- papéis, dados mínimos, fixtures e oráculo.

Sem isso não existe agenda “neutra” que possa ser construída.

## 3. Dentro do escopo, depois do `PASS`

1. Consumir somente o requisito revisado.
2. Representar a capacidade do caminho aprovado.
3. Verificar compatibilidade pelos eixos contratados.
4. Recomendar ou reservar opção compatível.
5. Recusar incompatibilidade e explicitar falta de capacidade.
6. Implementar booking atômico somente no caminho B/C quando autorizado.
7. Construir superfícies mínimas dos papéis confirmados.
8. Registrar autoria, instante, razões e conflitos.
9. Marcar fixtures, mocks e integrações futuras na interface.

## 4. Fora do escopo

- inventar slot, duração, prioridade, recurso ou disponibilidade;
- gerir salas e giro do centro cirúrgico;
- substituir agenda institucional sem decisão;
- integração real sem documentação/ambiente autorizado;
- repriorização silenciosa ou remarcação compulsória;
- decisão clínica nova;
- KPI percentual sem baseline;
- comunicação/paciente não aprovada.

## 5. Entregáveis por caminho

### Comuns

- contrato executável de compatibilidade;
- resposta estruturada de incompatibilidade/falta de capacidade;
- explicação da recomendação/booking;
- superfícies mínimas e testes de permissão;
- fixtures de contraste, controle negativo e falhas;
- Analyst/Warlog atualizados.

### Caminho A

- adaptador ou handoff manual;
- confirmação de entrega/recusa sem fingir reserva.

### Caminho B

- recursos, disponibilidade, slot e agendamento mínimos;
- persistência e proteção contra dupla reserva;
- projeção visual com a biblioteca aprovada.

### Caminho C

- adaptador conforme contrato real;
- sandbox ou mock fiel e visível;
- timeout, retry, rejeição e idempotência.

## 6. Critérios de aceite

- [ ] Par de contraste produz requisito e tratamento/capacidade distintos.
- [ ] Controle negativo equivalente permanece equivalente.
- [ ] Mudança de procedimento altera capacidade quando o protocolo manda.
- [ ] Caso não pronto não consome vaga quando essa for a regra.
- [ ] Vaga incompatível é recusada sem ajuste silencioso.
- [ ] Falta de capacidade é resposta de domínio.
- [ ] Agendamento recebe apenas os dados necessários.
- [ ] Explicação liga decisão, requisito e capacidade.
- [ ] No caminho B/C, concorrência não produz dupla reserva.
- [ ] Mock não se apresenta como conectividade com o HC.
- [ ] Offline/sync obedecem o contrato por operação.
- [ ] Testes proporcionais, typecheck e build estão verdes no SHA final.

## 7. Gate de saída

O sprint só termina com provas no SHA final. A MiniSpec 003 exige um `PASS` separado que
confirme qual handoff e qual estado final pertencem ao produto.
