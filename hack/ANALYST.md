# ANALYST — Antessala

## Barreira obrigatória antes do Build

**Estado:** `IN PROGRESS`
**Decisão atual:** `NO-GO PARA BUILD`
**Entrada congelada:** `hack/PRD.md`
**Saída futura:** `hack/BUILD.md`

---

## 1. Mandato

O Analyst fecha o produto de ponta a ponta. Ele não escreve código, não antecipa schema e
não empurra decisões para o Build.

O fluxo do PRD é lei. Não aguardaremos entrevistas, APIs ou documentos do hospital para
produzir o protótipo. Quando faltar uma informação institucional, o Analyst tomará uma
**decisão explícita para a demonstração**, limitará a alegação e preservará a fronteira
futura.

O Build só nasce quando todas as decisões obrigatórias abaixo estiverem fechadas e
rastreáveis.

## 2. Ordem imutável

```text
PRD congelado
→ Analyst completo
→ Build
→ Warlog
→ Sprints
→ Spec de uma sprint
→ Plan dessa spec
→ primeiro teste TDD
→ código
```

Qualquer artefato posterior já presente no repositório é rascunho sem autoridade.

## 3. Como uma decisão passa

Cada decisão do Analyst deve declarar:

| Campo | Obrigatório |
|---|---:|
| Pergunta respondida | sim |
| Decisão | sim |
| Tipo: lei do PRD, decisão da demo ou evidência do repositório | sim |
| Ator responsável | sim |
| Dados de entrada e saída | sim |
| Quem lê e quem altera | sim |
| Estado e falhas | sim |
| Contrato persistido ou DTO | quando houver dado |
| Teste futuro que provará a decisão | sim |
| Limite da alegação | sim |

Não passam expressões como “configurável”, “depois integra”, “o sistema alerta” ou “usa o
componente existente” sem dono, contrato, comportamento e prova.

## 4. Dossiês obrigatórios

O Analyst principal é este índice. Os detalhes vivem em cinco dossiês, todos canônicos e
todos obrigatórios:

| Dossiê | Conteúdo | Estado |
|---|---|---|
| [Fluxo e domínio](analyst/01-fluxo-e-dominio.md) | fronteiras, identidades, estados, handoffs, falhas | `IN PROGRESS` |
| [Atores e permissões](analyst/02-atores-e-permissoes.md) | logins, RBAC, ownership e visibilidade | `IN PROGRESS` |
| [Widgets e dados](analyst/03-widgets-e-dados.md) | catálogo, DTOs, proveniência e terminologias | `IN PROGRESS` |
| [Classificação e agenda](analyst/04-classificacao-e-agenda.md) | saídas, regras, slots, capacidade e concorrência | `IN PROGRESS` |
| [Arquitetura e prova](analyst/05-arquitetura-e-prova.md) | fonte de verdade, segurança, reuso e testes | `IN PROGRESS` |

## 5. Matriz mestra de rastreabilidade

Antes do PASS, cada ação crítica deve ocupar uma linha:

| Ator | Evento | Superfície | Campo/widget | Fonte | Regra | Saída | Estado | Permissão | Persistência | Teste |
|---|---|---|---|---|---|---|---|---|---|---|
| Recepção | encaminhamento entregue | a definir | a definir | documento | a definir | caso aberto | a definir | a definir | a definir | a definir |
| Enfermagem | caso recebido | a definir | anamnese | relato/aferição | a definir | necessidade de vaga | a definir | a definir | a definir | a definir |
| Recepção | triagem concluída | a definir | resumo operacional | triagem | compatibilidade | reserva | a definir | a definir | a definir | a definir |
| Anestesiologista | paciente comparece | a definir | avaliação | caso + consulta | decisão médica | conclusão/pendência | a definir | a definir | a definir | a definir |
| Serviço solicitante | avaliação concluída | a definir | resultado | avaliação | handoff | recebimento | terminal a definir | leitura | a definir | a definir |

As células `a definir` são trabalho ativo, não permissão para o Build.

## 6. Gates de saída

### Produto e domínio

- [ ] O fluxo canônico está descrito por ator, entrada, ação, saída e próximo responsável.
- [ ] Paciente, encaminhamento, caso, anamnese, agendamento e avaliação têm identidades
  inequívocas.
- [ ] A máquina de estados cobre caminho feliz, informação ausente, falta de vaga,
  pendência, retorno, cancelamento e handoff.
- [ ] Cada estado tem owner, entrada, saída, ações permitidas e terminalidade.
- [ ] A fronteira com triagem geral, prontuário e marcação cirúrgica está congelada.

### Atores e permissões

- [ ] Os logins necessários à demonstração estão definidos.
- [ ] Cada campo tem criador, editor, leitor, confirmador e regra de correção.
- [ ] A recepção não interpreta nem altera dados clínicos.
- [ ] A enfermagem não conclui avaliação médica.
- [ ] O anestesiologista não altera silenciosamente a entrevista de enfermagem.
- [ ] O serviço solicitante recebe somente o conteúdo autorizado.
- [ ] A matriz RBAC cobre interface e fronteira de dados.

### Widgets e dados

- [ ] O catálogo de widgets está completo.
- [ ] Cada widget tem ID, versão, DTO, validação, defaults, completude e resumo.
- [ ] Cada campo distingue negativo, desconhecido, não aplicável e não perguntado.
- [ ] Cada campo tem proveniência e owner.
- [ ] Cada dado consumido por uma regra existe em um widget ou no contexto do procedimento.
- [ ] Procedimentos, medicamentos, CID, exames e demais catálogos foram auditados.
- [ ] Perguntas específicas por procedimento têm modelo e fallback definidos.

### Classificação e agenda

- [ ] A saída operacional rápida, normal e estendida tem nome, significado e efeito.
- [ ] Complexidade, antecedência, prontidão e decisão médica não foram misturadas.
- [ ] Regras, explicações, versão, override e reclassificação estão definidos.
- [ ] Informação ausente nunca é tratada como normal.
- [ ] Recurso, capacidade, duração, slot, bloqueio e reserva estão definidos.
- [ ] Falta de capacidade, reagendamento, retorno e falta do paciente têm fluxo.
- [ ] Dupla reserva e demais corridas têm contrato de prevenção e recuperação.
- [ ] O calendário foi tratado como projeção, não como fonte de verdade.

### Arquitetura e prova

- [ ] A arquitetura do protótipo foi escolhida e não se apresenta como arquitetura do HC.
- [ ] A fonte de verdade e o funcionamento offline foram definidos por operação.
- [ ] O reuso de Antessala, DietFlow e EscalaFlow foi classificado em copiar, adaptar ou
  rejeitar.
- [ ] Segurança, dados sintéticos, auditoria, retenção e exportação estão definidos.
- [ ] Testes de domínio, contrato, RBAC, concorrência e ponta a ponta estão enumerados.
- [ ] A prova demonstra casos que exigem tratamentos de agenda diferentes.
- [ ] Métricas da demo medem o que ela realmente executa.

### Entrega documental

- [ ] Nenhuma decisão obrigatória ficou “para o Build”.
- [ ] A matriz mestra não contém `a definir`.
- [ ] Todos os cinco dossiês estão `COMPLETE`.
- [ ] O Analyst narra o fluxo simples, o fluxo com pendência e o fluxo sem vaga.
- [ ] O escopo futuro do Build pode ser escrito sem inventar domínio.

## 7. Veredito atual

O PRD está pronto. O Analyst não está.

Portanto:

- Build: proibido;
- Warlog: não iniciado;
- Sprints: rascunhos;
- Specs: rascunhos;
- Plans: rascunhos;
- testes e código: proibidos.

O próximo trabalho é preencher os cinco dossiês e eliminar cada `a definir`. Só então este
documento pode mudar para `READY FOR BUILD`.
