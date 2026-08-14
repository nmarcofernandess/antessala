# MiniSpec 003 — Handoff e prova final

**Status:** `BLOCKED BY ANALYST`

**Execução:** proibida até `PASS MINISPEC 003` explícito

**Dependências:** MiniSpecs 001 e 002 concluídas e provadas

**Último sprint:** encerra somente a promessa validada

---

## 1. Objetivo

Fechar o estado terminal real do Antessala e provar a jornada end-to-end. Se a evidência
mostrar que a promessa termina no requisito entregue ou no agendamento, o sprint termina
ali. Consulta, documento pós-consulta e retorno ao planejamento cirúrgico entram apenas
se o Analyst confirmar que fazem parte da fronteira do produto.

## 2. Dependências que bloqueiam a entrada

O Analyst precisa registrar:

- evento terminal e handoff ao ator/sistema seguinte;
- estados finais, reabertura, cancelamento e falhas aplicáveis;
- se consulta, conclusão, pendência e retorno cirúrgico pertencem ao produto;
- dados mínimos e permissões de cada superfície;
- documento/exportação, assinatura e destino, quando aplicáveis;
- política de auditoria, retenção e proteção da prova;
- fronteiras reais/mockadas;
- fixtures end-to-end e oráculo;
- critérios de prova visual e narrativa da demo.

## 3. Dentro do escopo, depois do `PASS`

1. Implementar o handoff e o estado terminal aprovados.
2. Implementar consulta/conclusão/pendência somente se confirmadas no escopo.
3. Preservar autoria, motivo, instante, versões e correlação entre as fatias.
4. Mostrar reabertura, cancelamento ou retorno apenas conforme contrato.
5. Gerar documento/exportação somente quando houver finalidade e destino.
6. Montar cenários end-to-end sintéticos e distinguíveis.
7. Provar segurança, RBAC, falhas, mocks e ausência de capacidade.
8. Comparar tratamento indiferenciado e diferenciado pelo oráculo aprovado.

## 4. Fora do escopo

- gerir centro cirúrgico ou horas de sala;
- criar prontuário paralelo;
- inventar laudo, assinatura ou status de liberação;
- app de paciente, WhatsApp ou notificações não aprovadas;
- integração real sem contrato;
- KPI clínico/operacional sem baseline;
- chamar a demo de piloto, produção ou solução homologada.

## 5. Entregáveis

- handoff/estado terminal executável;
- superfícies mínimas confirmadas;
- documento/exportação apenas se aprovado;
- auditoria ponta a ponta;
- fixtures simples, complexas, ausentes, conflitantes e sem capacidade;
- cenários de falha de rede/integração e conflito concorrente aplicável;
- testes de domínio, integração, RBAC, E2E e segurança;
- atlas/prova visual no SHA final;
- roteiro reproduzível da demo;
- Analyst e Warlog atualizados.

## 6. Critérios de aceite

- [ ] A jornada começa e termina nos eventos confirmados.
- [ ] Nenhuma tela pós-agendamento existe sem ator e finalidade comprovados.
- [ ] Par de contraste e controle negativo satisfazem o oráculo.
- [ ] Ausência, conflito, override, mudança de procedimento e falta de capacidade são
      demonstrados.
- [ ] Handoff rejeitado/indisponível produz resposta explícita e recuperável.
- [ ] Dados clínicos são mínimos para cada papel.
- [ ] Mocks, fixtures e integrações reais são distinguíveis.
- [ ] Documento/exportação não afirma decisão clínica inexistente.
- [ ] Nenhum dado real entra na demo ou nos artefatos de prova.
- [ ] Primeiro boot e fluxo prometido obedecem a arquitetura aprovada.
- [ ] Testes, typecheck, build, E2E e prova visual estão verdes no SHA final.

## 7. Gate de saída

O Analyst encerra com `PASS DEMO` ou `BLOCKED`. O veredito registra fronteira entregue,
caminho de agenda, mocks, limitações, baseline indisponível e recibos do SHA final.
