# PRD — Antessala

## Agendamento diferenciado da consulta pré-anestésica

**Hacka Health 2026 · Desafio 1 · HCFMRP-USP**
**Versão:** 5.1 · 14/08/2026
**Estado:** `APPROVED_PRODUCT_BASELINE`
**Confiança:** média
**Rota:** PRD → Analysts de domínio → Builds de domínio → hubs de integração → review final
→ Warlog → minispecs → Writing Plans → TDD RED → código → QA
**Próxima fase:** review final de congruência do pacote completo de Analysts e Builds

---

## State

- Source: fluxo decretado por Marco para o hackathon
- Confidence: `medium`
- Route: `analyst_prd`
- Phase budget: `forensic`
- Execution strategy: `per_unit`
- Created: `2026-08-14`
- Status: `approved`; aprovação explícita de Marco registrada em `2026-08-14`

## Lei deste documento

Este PRD define o produto. O fluxo abaixo é a decisão canônica do hackathon.

Depois desta revisão, o PRD fica congelado. O Analyst pode esclarecer o domínio e tomar
decisões técnicas, mas não pode mudar o problema, os atores, a fronteira ou a promessa do
produto. Uma mudança desse porte exige reabrir formalmente o PRD.

Este documento não define banco, campos clínicos, algoritmo ou arquitetura. Essas respostas
pertencem aos Analysts e Builds de domínio.

Para a demonstração, uma única conta sintética abre todas as ferramentas. Ela representa o
operador de desenvolvimento que percorre o fluxo inteiro sem trocar de usuário. Recepção,
enfermagem, anestesiologia, serviço solicitante e administração continuam sendo
responsabilidades distintas, visíveis e auditáveis. A conta integrada não transforma essas
responsabilidades em uma só e não representa o modelo de acesso de um hospital.

## Problem

Pacientes encaminhados para consulta pré-anestésica têm necessidades diferentes, mas o
agendamento não dispõe de informação estruturada para reservar uma vaga compatível com o
tempo e a antecedência exigidos por cada caso.

Na prática, a recepção recebe o encaminhamento, mas não deve interpretar dados clínicos. A
enfermagem coleta a anamnese, porém essa avaliação precisa chegar ao agendamento como uma
orientação operacional clara. Sem essa ponte, casos diferentes disputam vagas semelhantes.

## Goal

Transformar a triagem de enfermagem em uma necessidade de agendamento compreensível pela
recepção, permitindo reservar a consulta pré-anestésica na categoria de vaga adequada.

O produto também deve acompanhar a consulta do anestesiologista até a conclusão ou a
abertura de pendências e devolver o resultado ao serviço que solicitou o procedimento.

## Fluxo canônico

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

## Users / Actors

| Ator | Responsabilidade no fluxo |
|---|---|
| Paciente | entrega o encaminhamento, responde à anamnese e comparece à consulta |
| Médico solicitante | indica o procedimento e emite o encaminhamento |
| Recepção | recebe o encaminhamento e agenda a vaga indicada |
| Enfermagem | realiza a anamnese e produz a necessidade operacional da vaga |
| Anestesiologista | realiza a avaliação, registra pendências e conclui o parecer |
| Serviço solicitante | recebe o resultado e conduz a marcação da cirurgia |
| Administrador | prepara fixtures, capacidade e configurações da demonstração |

Paciente e médico solicitante não entram no aplicativo. A prova usa uma conta local
integrada e sintética. Ela enxerga, na navegação lateral, as ferramentas das cinco
responsabilidades. Cada ação continua identificada por responsabilidade, e o processo
confiável valida qual serviço de domínio pode executá-la.

Os identificadores canônicos dessas funções são `ADMIN`, `RECEPCAO`, `ENFERMAGEM`,
`ANESTESIOLOGISTA` e `SOLICITANTE`.

## Story de Usuario

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

### Administrador

- Como operador da demonstração, quero entrar uma vez e acessar todas as ferramentas pela
  navegação lateral, para apresentar o fluxo completo sem interrompê-lo com trocas de conta.
- Como operador, quero abrir pelo menu de usuário as configurações, o tema e uma amostra de
  uso, para preparar e explicar a demonstração sem editar o banco manualmente.

## Story Tecnica

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
- Como sistema, preciso autenticar a conta sintética integrada e derivar a responsabilidade
  de cada ação pelo contrato confiável do domínio, nunca por um papel enviado pelo renderer.
- Como sistema, preciso registrar a conta da demonstração e a responsabilidade exercida em
  cada mutação auditável.
- Como sistema, preciso usar a identidade do requisito operacional, e não um cadastro de
  paciente, para decidir quais vagas são compatíveis.

## Scope

### Dentro

- entrada do encaminhamento;
- identificação do caso;
- anamnese pré-anestésica de enfermagem;
- definição da necessidade operacional da vaga;
- agendamento da consulta pré-anestésica;
- avaliação do anestesiologista;
- pendências e retornos ligados à avaliação;
- entrega do resultado ao serviço solicitante;
- login local único para a demonstração integrada;
- navegação lateral com todas as ferramentas do fluxo;
- menu do usuário com configurações, tema claro/escuro/sistema, amostra de uso e logout;
- agenda visual completa, com calendário, filtros, busca, reagendamento e tratamento de
  conflitos;
- anamnese em composer de widgets, com reordenação, drawer e protocolos/templates salvos;
- Assistente de IA em rota própria, separado da anamnese e do restante do fluxo;
- fixtures sintéticas de conta, agendas, catálogos, protocolos e casos.

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
- uso de dados reais de pacientes;
- cadastro público, convite, confirmação de e-mail e recuperação de senha por e-mail;
- login social, SSO, LDAP, Active Directory ou identidade institucional;
- gestão institucional de identidades, múltiplas contas e múltiplas funções;
- acesso do paciente ao aplicativo.

## Expected Behavior

O produto deve conduzir o caso por todo o fluxo canônico, manter a responsabilidade de cada
ator e diferenciar as opções de agenda conforme a necessidade produzida pela triagem. Na
prova, uma sessão integrada expõe todas as ferramentas; o sistema registra qual
responsabilidade cada ação exerce.

## Current Behavior / Bug

A recepção recebe o encaminhamento, mas não dispõe de uma tradução operacional estruturada
da anamnese. Pacientes com necessidades diferentes podem ser encaminhados a vagas
semelhantes. O problema observado está na ligação entre triagem e agendamento; este PRD não
afirma qual sistema, formulário ou agenda o hospital usa hoje.

## Desired Behavior

O encaminhamento entra no produto, percorre recepção, enfermagem, agendamento e avaliação
anestésica, e termina com um resultado entregue ao serviço solicitante. Cada ator recebe a
informação necessária para cumprir sua parte sem assumir a responsabilidade de outro.

A triagem diferencia pelo menos três necessidades de agenda: vaga rápida, vaga normal e
vaga estendida. O Analyst definirá os nomes canônicos, os critérios, a duração, a
antecedência e o tratamento de exceções.

## System Pattern / Contract

O produto organiza um caso que atravessa setores. Cada etapa recebe uma entrada, registra
uma ação, produz uma saída e identifica o próximo responsável. Informação clínica permanece
com os papéis clínicos; a recepção recebe somente a consequência operacional necessária
para agendar.

Toda passagem relevante precisa ser rastreável. Pendências mantêm o caso aberto. A conclusão
só ocorre quando o resultado chega ao serviço solicitante. A autorização pertence à
operação, não à aparência: toda ação protegida valida sessão e função no processo principal.

## Technical Context

O repositório atual oferece uma base Electron local, persistência embarcada, widgets de
anamnese e catálogos offline. Esses recursos são candidatos, não decisões do PRD. O Analyst
deve provar o que serve, o que precisa mudar e o que deve ficar fora.

A demonstração deve usar dados sintéticos. O PRD não escolhe schema, biblioteca de agenda,
algoritmo de classificação ou arquitetura de produção. Para autenticação, escolhe apenas o
contrato da prova: uma conta local sintética, sem dependência externa.

## Data / Contracts

O produto precisa representar encaminhamento, caso, anamnese, necessidade de agenda,
reserva, avaliação, pendência, retorno e resultado. O Analyst definirá identidades,
relacionamentos, DTOs, versões, proveniência, permissões e persistência.

O produto também precisa representar conta da demonstração, sessão local, responsabilidade
da ação e evento de auditoria. A fixture cria uma conta integrada. Sua senha é sintética; o
aplicativo nunca a armazena em texto puro.

A agenda recebe uma referência opaca da necessidade agendável. Essa identidade liga o caso
autônomo à classe, duração e recursos exigidos. Ela nunca é `patientId`, ficha de paciente ou
atalho para histórico longitudinal.

Nenhum campo pode surgir no Build sem origem, responsável, consumidor e teste futuro.

## UX / States

Cada responsabilidade precisa de ferramentas próprias e reconhecíveis na mesma casca. A
interface deve mostrar o próximo passo, dados ausentes, ausência de vaga, pendência, retorno
e conclusão sem depender apenas de cor.

O produto inclui uma tela de login. Estado sem sessão leva ao login. Credencial inválida não
abre a casca autenticada. Após entrar, a navegação lateral mostra todas as ferramentas da
prova. A troca entre recepção, enfermagem, agenda, anestesiologia, solicitante e configuração
ocorre por rota, não por troca de identidade.

A anamnese usa uma superfície de composer: widgets empilhados, claros, reordenáveis em
rascunho, drawer de adição e protocolos/templates reutilizáveis. A agenda usa calendário
completo com mês, semana, dia e lista acessível. O Assistente ocupa uma rota própria e nunca
aparece como painel global nem dentro dos widgets.

O Analyst definirá a máquina de estados. Este PRD exige apenas que o caso continue
identificável do encaminhamento ao handoff final.

## Acceptance Criteria

- Um caso percorre o fluxo completo do encaminhamento ao retorno ao serviço solicitante.
- A recepção agenda sem precisar interpretar comorbidades, medicamentos ou exames.
- A enfermagem registra a anamnese e entrega uma necessidade operacional explicável.
- Casos com necessidades diferentes recebem opções de agenda diferentes.
- Informação obrigatória ausente aparece como pendência; nunca vira resposta negativa.
- O anestesiologista conclui a avaliação ou registra pendência e retorno.
- O serviço solicitante recebe o resultado final do caso.
- A autoria e a sequência dos handoffs podem ser reconstruídas.
- A demonstração usa somente dados sintéticos.
- Uma conta fixture integrada entra offline e acessa todas as ferramentas da demonstração.
- Cada mutação registra a mesma conta e a responsabilidade exercida pelo contrato chamado.
- O renderer não escolhe nem envia um papel autoritativo para ampliar permissão.
- A agenda oferece somente vagas compatíveis com a identidade do requisito operacional.
- Reagendamento por arrastar ou redimensionar confirma no backend ou reverte visualmente.
- A anamnese oferece os widgets pré-anestésicos, DnD, drawer e protocolos/templates salvos.
- O Assistente permanece em rota própria; indisponibilidade de IA não afeta o fluxo manual.

## Definition of Complete

- [x] Problema definido.
- [x] Objetivo definido.
- [x] Fluxo ponta a ponta definido.
- [x] Atores identificados.
- [x] Histórias de usuário definidas.
- [x] Histórias técnicas definidas.
- [x] Escopo interno e externo definido.
- [x] Critérios de aceitação definidos.
- [x] Próxima fase definida.
- [x] Contrato de autenticação integrada da demonstração definido.
- [x] Marco aprovou esta revisão como baseline do hackathon.

O conteúdo do PRD está aprovado. Analyst e BUILD podem detalhar sua execução sem alterar
problema, goal, atores ou fronteiras.

## Risks

- Confundir urgência clínica com categoria operacional de agenda.
- Fazer a recepção interpretar dados clínicos.
- Criar uma anamnese que não fornece todos os dados consumidos pela decisão.
- Escolher widgets antes de fechar seus contratos e responsáveis.
- Modelar uma agenda visual antes de definir capacidade, duração e concorrência.
- Encerrar o fluxo na triagem e esquecer consulta, pendências, retorno e handoff.
- Tratar a arquitetura local da demonstração como arquitetura hospitalar.
- Proteger apenas a interface e deixar o IPC clínico sem validação da sessão e da
  responsabilidade exercida.
- Tratar a conta integrada como identidade institucional ou modelo final de RBAC.
- Expor senha em texto puro, log, fixture publicada em tela ou resposta IPC.

## Open Questions

O Analyst deve fechar, sem alterar este PRD:

- identidade de paciente, encaminhamento, caso e avaliação;
- matriz de permissões e propriedade de cada campo para as funções já decididas;
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

## Next Phase

O PRD é a baseline de produto. Cada Analyst e Build de domínio é canônico no próprio
escopo; `analysis.md` e `BUILD.md` são hubs de integração. Depois do review final de
congruência, outra IA cria o Warlog lendo todos os domínios e corta minispecs. Cada fatia
recebe um Writing Plan executável.

---

## Registro de decisão

- Decisão: `APPROVED_BY_MARCO`.
- Data: `2026-08-14`.
- Baseline Git ao registrar a decisão: `452e0e3c6eed4b7504093b7a98c10a5687b89ef7`.
- Escopo: o conteúdo de produto está aprovado e congelado para o hackathon.
- Mudança futura de problema, goal, atores ou fronteiras reabre o PRD; correções técnicas
  seguem em `analysis.md` e `BUILD.md` sem novo gate individual.

### Emenda operacional aprovada por Marco

- Decisão: `INTEGRATED_DEMO_SESSION`.
- Data: `2026-08-14`.
- A prova usa uma conta sintética com todas as ferramentas na barra lateral.
- Os cinco papéis permanecem responsabilidades do fluxo, não cinco logins da prova.
- A agenda reutiliza o padrão FullCalendar do DietFlow, adaptado ao caso autônomo e à
  compatibilidade do requisito operacional.
- A anamnese reutiliza a experiência Composer do DietFlow, com os widgets pré-anestésicos,
  DnD, drawer e protocolos/templates salvos.
- A IA fica isolada em uma rota própria do Assistente.
- Gestão institucional de contas e segregação real por usuário ficam fora desta prova.
