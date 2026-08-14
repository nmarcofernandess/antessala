# MiniSpec 003 — Agenda diferenciada e demo

**Status:** `BLOCKED BY ANALYST`

**Execução:** proibida até `PASS MINISPEC 003` explícito

**Dependências:** MiniSpecs 001 e 002 concluídas e provadas

**Último sprint:** fecha a demonstração end-to-end

---

## 1. Objetivo

Traduzir a decisão humana revisada em uso de capacidade compatível e demonstrar que casos
com necessidades diferentes recebem tratamento operacional diferente e explicável.

O sprint implementa somente um dos caminhos aprovados:

- **A — qualificação:** entregar requisito a uma agenda externa ou operação manual, sem
  calendário próprio;
- **B — agenda demonstrativa:** persistir capacidade e alocação mínimas;
- **C — integração institucional:** usar contrato real fornecido pela TI; sem contrato,
  apenas adaptador mockado e visível.

---

## 2. Dependências que bloqueiam a entrada

O Analyst precisa registrar `PASS MINISPEC 003` contendo:

- significado comprovado de “agendamento semelhante”;
- escolha explícita entre recomendador, agenda demonstrativa ou integração;
- contrato de `SchedulingRequirement` revisado pela MiniSpec 002;
- recursos, disponibilidade, restrições, duração/modalidade e concorrência definidos;
- política de encaixe, remarcação, cancelamento e falta de vaga aprovada ou fora do
  escopo de forma explícita;
- integração e mocks identificados fronteira por fronteira;
- biblioteca visual escolhida, se necessária, por aderência, licença, bundle,
  acessibilidade e testabilidade;
- fixtures end-to-end e oráculo determinístico aprovados;
- papéis e dados mínimos de cada superfície confirmados.

Sem isso, não existe “agenda neutra” que possa ser construída legitimamente.

---

## 3. Dentro do escopo, depois do `PASS`

1. Consumir somente o requisito operacional revisado, sem expor prontuário inteiro.
2. Representar a capacidade necessária ao caminho A, B ou C aprovado.
3. Verificar compatibilidade de prioridade, esforço, recurso, modalidade, janela e
   prontidão conforme contrato.
4. Recomendar ou realizar alocação compatível, preservando explicação e autoria.
5. Recusar incompatibilidade e responder explicitamente quando não houver capacidade.
6. Implementar concorrência de reserva apenas se o produto for dono da agenda.
7. Construir as superfícies mínimas dos papéis confirmados.
8. Demonstrar casos contrastantes e a diferença entre fluxo indiferenciado e
   diferenciado.
9. Manter integrações, regras e dados sintéticos visivelmente rotulados.

---

## 4. Fora do escopo

- inventar slots, durações, filas, prioridades, cores, recursos ou disponibilidade;
- gerir salas e giro do centro cirúrgico;
- substituir agenda institucional sem decisão do HC;
- integração real sem documentação e ambiente autorizados;
- remarcação compulsória ou repriorização silenciosa de paciente confirmado;
- aptidão anestésica, conduta médica ou liberação cirúrgica automática;
- previsão de redução percentual sem baseline;
- notificações, WhatsApp, teleconsulta ou transcrição, salvo novo `PASS` que reduza outro
  escopo sem criar quarta minispec.

---

## 5. Entregáveis por caminho

### Comuns

- contrato executável de requisito e compatibilidade;
- resposta explícita de falta de capacidade;
- explicação da recomendação/alocação;
- superfícies mínimas por papel;
- fixtures sintéticas e cenário end-to-end reproduzível;
- testes de domínio, integração, permissões e prova visual;
- atualização do Analyst e registro append-only no Warlog.

### Caminho A

- adaptador de saída ou operação manual claramente definida;
- confirmação de entrega/recusa do requisito;
- capacidade fictícia apenas no cenário de prova, marcada como fixture.

### Caminho B

- modelo mínimo de recurso, disponibilidade, slot e agendamento;
- persistência e proteção contra dupla reserva;
- visualização implementada com a biblioteca já aprovada.

### Caminho C

- adaptador conforme contrato real da TI;
- sandbox ou mock com a mesma fronteira e identificação visível;
- tratamento de indisponibilidade, rejeição e idempotência conforme contrato.

---

## 6. Critérios de aceite

- [ ] Ao menos um par de contraste controlado varia um eixo aprovado e produz
      obrigatoriamente requisito e tratamento operacional/capacidade distintos conforme
      o oráculo.
- [ ] Um controle negativo com necessidades operacionalmente equivalentes produz o mesmo
      requisito, provando que a diferenciação não é arbitrária.
- [ ] Alterar o procedimento numa fixture cujo protocolo aprovado declare necessidades
      diferentes muda obrigatoriamente o requisito e a opção de capacidade.
- [ ] Caso não pronto não consome vaga quando essa for a regra aprovada.
- [ ] Vaga incompatível é recusada; o sistema não ajusta silenciosamente requisito ou
      capacidade.
- [ ] Falta de capacidade é resposta explícita e não erro genérico.
- [ ] O agendador recebe apenas os dados necessários à decisão operacional.
- [ ] Explicação liga decisão humana revisada, requisito e capacidade escolhida.
- [ ] No caminho B, concorrência não produz dupla reserva.
- [ ] Nos caminhos A/C, ausência de integração real está visível e não é apresentada
      como conectividade com o HC.
- [ ] A comparação antes/depois usa o oráculo aprovado, não métrica inventada.
- [ ] A demo usa apenas dados sintéticos e o primeiro boot não depende de rede.
- [ ] Testes proporcionais, typecheck, build e prova visual estão verdes no SHA final.

---

## 7. Gate de saída

O Analyst encerra o sprint somente quando o comportamento entregue corresponde ao
contrato aprovado, as fronteiras de mock estão visíveis e as provas pertencem ao SHA
final.

Resultado válido:

- `PASS DEMO`, com caminho A/B/C, limites e evidências registrados; ou
- `BLOCKED`, com contrato faltante, responsável e impacto explícitos.

O hack não será declarado solução hospitalar homologada. Um piloto real exige novo
contrato de segurança, integração, privacidade, operação e métricas.
