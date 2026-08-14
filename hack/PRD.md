# PRD — Antessala

## Agendamento diferenciado da consulta pré-anestésica

**Hacka Health 2026 · Desafio 1 · HCFMRP-USP**
**Versão:** 5.0 · 14/08/2026
**Estado:** `AGUARDANDO ASSINATURA DE MARCO`
**Confiança:** média
**Rota:** Taskgen → PRD → Analyst → Build + Critic → Warlog → Sprints → por minispec:
Spec assinada → Plan assinado → TDD RED → código → QA assinado → QA final assinado
**Próxima fase:** `hack/ANALYST.md`

---

## State

- Source: fluxo decretado por Marco para o hackathon
- Confidence: `medium`
- Route: `analyst_prd`
- Phase budget: `forensic`
- Execution strategy: `per_unit`
- Created: `2026-08-14`
- Status: `gathering`, aguardando assinatura de Marco

## Lei deste documento

Este PRD define o produto. O fluxo abaixo é a decisão canônica do hackathon.

Depois desta revisão, o PRD fica congelado. O Analyst pode esclarecer o domínio e tomar
decisões técnicas, mas não pode mudar o problema, os atores, a fronteira ou a promessa do
produto. Uma mudança desse porte exige reabrir formalmente o PRD.

Este documento não define banco, telas, widgets, algoritmo, classes clínicas ou
arquitetura. Essas respostas pertencem ao Analyst. O acesso do MVP, porém, está decidido:
o administrador cria contas locais com e-mail, senha e uma função. Não haverá cadastro
público, confirmação de e-mail, recuperação por e-mail, SSO ou integração com diretório no
hackathon.

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
| Administrador | cria e desativa contas locais, redefine senha e atribui uma função |

Paciente e médico solicitante não precisam de login no MVP. Os usuários diretos são
recepção, enfermagem, anestesiologista, serviço solicitante e administrador. Cada conta tem
uma função. O Analyst fecha as permissões de cada função e a propriedade de cada campo.

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

- Como administrador da demonstração, quero criar uma conta com e-mail, senha e função,
  para preparar os atores do fluxo sem depender de serviços externos.
- Como administrador, quero desativar contas, trocar sua função e redefinir sua senha, para
  corrigir a demonstração sem editar o banco manualmente.

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
- Como sistema, preciso autenticar contas locais e aplicar a função do usuário em todas as
  leituras e escritas, não apenas esconder botões.
- Como sistema, preciso iniciar a demonstração com contas sintéticas conhecidas e permitir
  que o administrador crie outras contas locais.

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
- login local dos usuários diretos;
- gestão mínima de contas pelo administrador: criar, listar, desativar, reativar, trocar
  função e redefinir senha;
- fixtures sintéticas de usuários, agendas, catálogos e casos para a demonstração.

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
- perfil editável pelo próprio usuário e múltiplas funções simultâneas;
- acesso do paciente ao aplicativo.

## Expected Behavior

O produto deve conduzir o caso por todo o fluxo canônico, manter a responsabilidade de
cada ator e diferenciar as opções de agenda conforme a necessidade produzida pela triagem.
Cada usuário direto entra com uma conta local criada pelo administrador e vê somente as
ações da sua função.

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
contrato do MVP: contas locais administradas dentro do aplicativo, sem dependência externa.

## Data / Contracts

O produto precisa representar encaminhamento, caso, anamnese, necessidade de agenda,
reserva, avaliação, pendência, retorno e resultado. O Analyst definirá identidades,
relacionamentos, DTOs, versões, proveniência, permissões e persistência.

O produto também precisa representar usuário, função, sessão local e evento de auditoria.
As fixtures criam, no mínimo, uma conta por função direta e um administrador. As senhas das
fixtures são dados sintéticos de demonstração; o aplicativo nunca armazena senha em texto
puro.

Nenhum campo pode surgir no Build sem origem, responsável, consumidor e teste futuro.

## UX / States

Cada papel precisa de uma superfície coerente com sua responsabilidade. A interface deve
mostrar o próximo passo, dados ausentes, ausência de vaga, pendência, retorno e conclusão
sem depender apenas de cor.

O produto inclui uma tela de login e uma área administrativa de usuários. Estado sem sessão
leva ao login. Conta inativa ou credencial inválida não abre a casca autenticada. O
administrador recebe feedback claro ao tentar criar e-mail duplicado, senha inválida ou
conta sem função.

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
- Cada função direta possui uma conta fixture capaz de entrar offline.
- O administrador cria uma conta local com e-mail, senha e função, sem confirmação externa.
- Uma conta inativa não autentica e um usuário autenticado não executa ação proibida para
  sua função, mesmo que tente chamar o contrato IPC diretamente.
- E-mails duplicados são rejeitados por comparação normalizada.

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
- [x] Contrato de autenticação do MVP definido.
- [ ] Marco assinou esta revisão e autorizou o Analyst.

O conteúdo do PRD está redigido. O artefato só termina quando Marco assinar esta revisão.
Sem assinatura, o Analyst permanece bloqueado.

## Risks

- Confundir urgência clínica com categoria operacional de agenda.
- Fazer a recepção interpretar dados clínicos.
- Criar uma anamnese que não fornece todos os dados consumidos pela decisão.
- Escolher widgets antes de fechar seus contratos e responsáveis.
- Modelar uma agenda visual antes de definir capacidade, duração e concorrência.
- Encerrar o fluxo na triagem e esquecer consulta, pendências, retorno e handoff.
- Tratar a arquitetura local da demonstração como arquitetura hospitalar.
- Proteger apenas a interface e deixar o IPC clínico sem validação de sessão e função.
- Tratar e-mail como verificado ou conta local como identidade institucional.
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

Depois da assinatura de Marco, o trabalho segue em `hack/ANALYST.md`. Enquanto qualquer
gate obrigatório do Analyst estiver aberto, Build, Warlog, Sprints, Specs, Plans, testes e
código permanecem proibidos.

---

## Contrato de encerramento deste arquivo

- Artefato: `PRD.md`
- Próxima fase autorizada: Analyst forense
- Estado: `AGUARDANDO_ASSINATURA`
- Assinatura de Marco: `PENDENTE`
- Data: `PENDENTE`
- Revisão Git examinada: `PENDENTE`
- Declaração: `PENDENTE`

Declaração exigida: “Aprovo este PRD e autorizo o início do Analyst.”

Sem assinatura válida de Marco, o PRD permanece `gathering` em `status.json`.
