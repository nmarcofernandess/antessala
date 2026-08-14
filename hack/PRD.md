# PRD — Antessala

## Agendamento diferenciado da consulta pré-anestésica

**Hacka Health 2026 · Desafio 1 · HCFMRP-USP**
**Versão:** 4.0 · 14/08/2026
**Estado:** `READY FOR ANALYST`
**Confiança:** média
**Rota:** PRD → Analyst → Build → Warlog → Sprints → Spec → Plan → TDD → código
**Próxima fase:** `hack/ANALYST.md`

---

## 1. Lei deste documento

Este PRD define o produto. O fluxo abaixo é a decisão canônica do hackathon.

Depois desta revisão, o PRD fica congelado. O Analyst pode esclarecer o domínio e tomar
decisões técnicas, mas não pode mudar o problema, os atores, a fronteira ou a promessa do
produto. Uma mudança desse porte exige reabrir formalmente o PRD.

Este documento não define banco, telas, widgets, algoritmo, classes clínicas, permissões,
agenda ou arquitetura. Essas respostas pertencem ao Analyst.

## 2. Problema

Pacientes encaminhados para consulta pré-anestésica têm necessidades diferentes, mas o
agendamento não dispõe de informação estruturada para reservar uma vaga compatível com o
tempo e a antecedência exigidos por cada caso.

Na prática, a recepção recebe o encaminhamento, mas não deve interpretar dados clínicos. A
enfermagem coleta a anamnese, porém essa avaliação precisa chegar ao agendamento como uma
orientação operacional clara. Sem essa ponte, casos diferentes disputam vagas semelhantes.

## 3. Objetivo

Transformar a triagem de enfermagem em uma necessidade de agendamento compreensível pela
recepção, permitindo reservar a consulta pré-anestésica na categoria de vaga adequada.

O produto também deve acompanhar a consulta do anestesiologista até a conclusão ou a
abertura de pendências e devolver o resultado ao serviço que solicitou o procedimento.

## 4. Fluxo canônico

1. O paciente passa pela triagem geral do SUS. Essa etapa já existe e fica fora do produto.
2. O paciente consulta o médico do serviço solicitante.
3. O médico indica um procedimento e entrega um encaminhamento para consulta
   pré-anestésica.
4. O paciente entrega o encaminhamento à recepção.
5. A recepção registra a entrada e direciona o paciente à enfermagem.
6. A enfermagem realiza a anamnese pré-anestésica.
7. A triagem produz uma necessidade operacional de vaga: rápida, normal ou estendida.
8. O paciente retorna à recepção.
9. A recepção reserva uma vaga compatível com a necessidade indicada e com a capacidade
   disponível.
10. Na data marcada, o anestesiologista avalia o paciente.
11. O anestesiologista conclui a avaliação ou solicita exames, informações e retornos.
12. Quando a avaliação termina, o resultado volta ao médico ou à secretaria do serviço
   solicitante.
13. O serviço solicitante conduz a marcação da cirurgia, imediatamente ou depois.

### Exemplo canônico

Dr. João, gastroenterologista, indica uma endoscopia. O paciente leva o encaminhamento à
recepção, passa pela anamnese de enfermagem e recebe uma indicação operacional de vaga. A
recepção agenda a consulta correspondente. O anestesiologista avalia o paciente, resolve
eventuais pendências e devolve o resultado à secretaria do Dr. João. A secretaria conduz a
marcação do procedimento.

## 5. Usuários e atores

| Ator | Responsabilidade no fluxo |
|---|---|
| Paciente | entrega o encaminhamento, responde à anamnese e comparece à consulta |
| Médico solicitante | indica o procedimento e emite o encaminhamento |
| Recepção | recebe o encaminhamento e agenda a vaga indicada |
| Enfermagem | realiza a anamnese e produz a necessidade operacional da vaga |
| Anestesiologista | realiza a avaliação, registra pendências e conclui o parecer |
| Serviço solicitante | recebe o resultado e conduz a marcação da cirurgia |

O Analyst definirá quais atores precisam de login, quais ações cada papel pode executar e
quais dados cada papel pode ver.

## 6. Histórias de usuário

### Paciente

- Como paciente encaminhado, quero passar pela triagem e sair com um próximo passo claro,
  para não depender de interpretações diferentes em cada balcão.
- Como paciente com pendências, quero saber o que falta e como retornar, para não perder o
  caminho até a avaliação concluída.

### Recepção

- Como recepcionista, quero receber uma categoria operacional de vaga, para agendar sem
  interpretar informação clínica.
- Como recepcionista, quero ver apenas horários compatíveis, para não reservar uma consulta
  inadequada.

### Enfermagem

- Como enfermeiro, quero registrar a anamnese completa e transformar os achados em uma
  necessidade de agendamento explicável.
- Como enfermeiro, quero identificar dados ausentes antes do agendamento, para não tratar
  silêncio como ausência de risco.

### Anestesiologista

- Como anestesiologista, quero receber o caso com a origem dos dados e o resumo da triagem,
  para avaliar sem reconstruir a história do paciente.
- Como anestesiologista, quero registrar conclusão, pendências e retornos, para que o caso
  tenha continuidade até o serviço solicitante.

### Serviço solicitante

- Como integrante do serviço solicitante, quero receber o resultado da avaliação, para
  continuar o planejamento do procedimento.

## 7. Histórias técnicas

Estas histórias descrevem obrigações do produto, não soluções de implementação.

- Como sistema, preciso preservar a identidade do caso durante todos os handoffs.
- Como sistema, preciso separar dado clínico de instrução operacional de agenda.
- Como sistema, preciso impedir que um papel altere dados pertencentes a outro.
- Como sistema, preciso representar informação ausente, negativa, desconhecida e não
  aplicável sem confundi-las.
- Como sistema, preciso registrar autoria, horário e motivo das decisões relevantes.
- Como sistema, preciso garantir que uma vaga não seja confirmada para dois casos.
- Como sistema, preciso manter pendências e retornos ligados ao caso original.
- Como sistema, preciso entregar ao serviço solicitante um resultado compreensível e
  rastreável.

## 8. Escopo

### Dentro

- entrada do encaminhamento;
- identificação do caso;
- anamnese pré-anestésica de enfermagem;
- definição da necessidade operacional da vaga;
- agendamento da consulta pré-anestésica;
- avaliação do anestesiologista;
- pendências e retornos ligados à avaliação;
- entrega do resultado ao serviço solicitante.

### Fora

- triagem geral do SUS;
- consulta que indicou o procedimento;
- classificação de emergência;
- fila física e ordem de chamada no mesmo dia;
- decisão automática de aptidão anestésica;
- marcação da cirurgia;
- gestão de sala, equipe ou mapa cirúrgico;
- substituição do prontuário hospitalar;
- integrações institucionais reais no protótipo;
- uso de dados reais de pacientes.

## 9. Comportamento atual

A recepção recebe o encaminhamento, mas não dispõe de uma tradução operacional estruturada
da anamnese. Pacientes com necessidades diferentes podem ser encaminhados a vagas
semelhantes. O problema observado está na ligação entre triagem e agendamento; este PRD não
afirma qual sistema, formulário ou agenda o hospital usa hoje.

## 10. Comportamento desejado

O encaminhamento entra no produto, percorre recepção, enfermagem, agendamento e avaliação
anestésica, e termina com um resultado entregue ao serviço solicitante. Cada ator recebe a
informação necessária para cumprir sua parte sem assumir a responsabilidade de outro.

A triagem diferencia pelo menos três necessidades de agenda: vaga rápida, vaga normal e
vaga estendida. O Analyst definirá os nomes canônicos, os critérios, a duração, a
antecedência e o tratamento de exceções.

## 11. Padrão e contrato do sistema

O produto organiza um caso que atravessa setores. Cada etapa recebe uma entrada, registra
uma ação, produz uma saída e identifica o próximo responsável. Informação clínica permanece
com os papéis clínicos; a recepção recebe somente a consequência operacional necessária
para agendar.

Toda passagem relevante precisa ser rastreável. Pendências mantêm o caso aberto. A conclusão
só ocorre quando o resultado chega ao serviço solicitante.

## 12. Contexto técnico

O repositório atual oferece uma base Electron local, persistência embarcada, widgets de
anamnese e catálogos offline. Esses recursos são candidatos, não decisões do PRD. O Analyst
deve provar o que serve, o que precisa mudar e o que deve ficar fora.

A demonstração deve usar dados sintéticos. O PRD não escolhe schema, biblioteca de agenda,
modelo de autenticação, algoritmo de classificação ou arquitetura de produção.

## 13. Dados e contratos

O produto precisa representar encaminhamento, caso, anamnese, necessidade de agenda,
reserva, avaliação, pendência, retorno e resultado. O Analyst definirá identidades,
relacionamentos, DTOs, versões, proveniência, permissões e persistência.

Nenhum campo pode surgir no Build sem origem, responsável, consumidor e teste futuro.

## 14. UX e estados

Cada papel precisa de uma superfície coerente com sua responsabilidade. A interface deve
mostrar o próximo passo, dados ausentes, ausência de vaga, pendência, retorno e conclusão
sem depender apenas de cor.

O Analyst definirá a máquina de estados. Este PRD exige apenas que o caso continue
identificável do encaminhamento ao handoff final.

## 15. Critérios de aceitação do produto

- Um caso percorre o fluxo completo do encaminhamento ao retorno ao serviço solicitante.
- A recepção agenda sem precisar interpretar comorbidades, medicamentos ou exames.
- A enfermagem registra a anamnese e entrega uma necessidade operacional explicável.
- Casos com necessidades diferentes recebem opções de agenda diferentes.
- Informação obrigatória ausente aparece como pendência; nunca vira resposta negativa.
- O anestesiologista conclui a avaliação ou registra pendência e retorno.
- O serviço solicitante recebe o resultado final do caso.
- A autoria e a sequência dos handoffs podem ser reconstruídas.
- A demonstração usa somente dados sintéticos.

## 16. Definition of Complete do PRD

- [x] Problema definido.
- [x] Objetivo definido.
- [x] Fluxo ponta a ponta definido.
- [x] Atores identificados.
- [x] Histórias de usuário definidas.
- [x] Histórias técnicas definidas.
- [x] Escopo interno e externo definido.
- [x] Critérios de aceitação definidos.
- [x] Próxima fase definida.

O PRD está completo para alimentar o Analyst. Ele não autoriza Build.

## 17. Riscos

- Confundir urgência clínica com categoria operacional de agenda.
- Fazer a recepção interpretar dados clínicos.
- Criar uma anamnese que não fornece todos os dados consumidos pela decisão.
- Escolher widgets antes de fechar seus contratos e responsáveis.
- Modelar uma agenda visual antes de definir capacidade, duração e concorrência.
- Encerrar o fluxo na triagem e esquecer consulta, pendências, retorno e handoff.
- Tratar a arquitetura local da demonstração como arquitetura hospitalar.

## 18. Perguntas abertas delegadas ao Analyst

O Analyst deve fechar, sem alterar este PRD:

- identidade de paciente, encaminhamento, caso e avaliação;
- papéis, logins, permissões e propriedade de cada campo;
- catálogo de widgets, campos, DTOs, validações e proveniência;
- dados do procedimento e perguntas condicionais;
- catálogos clínicos necessários e suas limitações;
- contrato da classificação e da explicação;
- contrato da agenda, capacidade, slots, concorrência e reagendamento;
- estados, eventos, pendências, retornos e handoffs;
- documentos, exportações e assinatura;
- arquitetura da demonstração e fronteira com uma versão futura;
- segurança, auditoria e dados sintéticos;
- estratégia de testes e prova ponta a ponta.

## 19. Próxima fase

O trabalho segue em `hack/ANALYST.md`. Enquanto qualquer gate obrigatório do Analyst
estiver aberto, Build, Warlog, Sprints, Specs, Plans, testes e código permanecem proibidos.
