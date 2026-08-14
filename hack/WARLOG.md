# WARLOG — Antessala

**Regra:** append-only. Decisão errada não é apagada; ganha uma entrada posterior que a
invalida. Evidência histórica é marcada com SHA e não vale automaticamente para código
novo.

Este é o único diário de decisões, divergências, provas e cicatrizes do projeto.

---

## Formato de entrada

```text
W-XXX · data · título
Estado: observado | hipótese | decidido | invalidado | bloqueado | provado
Contexto:
Evidência:
Decisão:
Impacto:
Pendência:
```

---

## W-001 · 13/08/2026 · O briefing não descreve o trabalho real

**Estado:** observado

### Contexto

O Desafio 1 informa apenas que a consulta pré-anestésica é obrigatória, que pacientes
possuem risco/complexidade diferentes e que são agendados de forma semelhante.

### Evidência

Briefing Hacka Health 2026, Desafio 1, página 5.

### Decisão

O briefing não autoriza inventar atores, telas, cores, scores, slots, integrações,
responsável pela classificação ou momento da agenda.

### Impacto

Qualquer detalhe adicional precisa ser classificado como evidência institucional,
hipótese ou decisão posterior.

---

## W-002 · 13/08/2026 · Produto inicial invalidado

**Estado:** invalidado

### Contexto

O primeiro Analyst interpretou o problema como fluxo presencial no mesmo dia:

```text
pessoa descartável
→ anamnese
→ fila por urgência + minutos de espera
→ especialista
→ hub
```

Declarou quatro telas, ausência absoluta de histórico e `ready for build`.

### Evidência contrária

- O desafio fala em pacientes “agendados”, não em ordem de chamada na recepção.
- O HCFMRP possui Ambulatório de Pré-Anestesia.
- O atendimento ambulatorial é previamente agendado.
- O paciente recebe registro institucional no HC.
- A atribuição de anestesiologia inclui priorização de fluxo de agendamento conforme
  gravidade e necessidade.

### Decisão

Paciente descartável, zero história, quatro telas, hub e motor por urgência/espera deixam
de ser leis. A antiga Spec 002 não será integrada.

### Impacto

Schema, tipos, handlers e branches construídos sobre essa hipótese ficam provisórios e
em quarentena até o Sprint 001 decidir migração.

---

## W-003 · 13/08/2026 · Pulseira não é risco pré-anestésico

**Estado:** decidido

### Contexto

A equipe confundiu pulseira de identificação, classificação de urgência e avaliação
pré-anestésica.

### Evidência

- Protocolos de identificação usam pulseira para identidade e alertas locais.
- Classificação por cores organiza portas de urgência e pode mudar após reavaliação.
- Avaliação pré-anestésica combina paciente, procedimento e condições de segurança sob
  responsabilidade médica.

### Decisão

O Antessala não modelará risco anestésico como pulseira/semáforo de pronto atendimento.
Prioridade, risco, complexidade, esforço e recurso permanecem eixos separados.

---

## W-004 · 13/08/2026 · A pista do edital é forte, mas não é smoking gun

**Estado:** observado

### Contexto

O Edital HCRP nº 11/2026 reúne, no mesmo perfil, atuação no Ambulatório de
Pré-Anestesia e priorização do fluxo de agendamento por gravidade/intensidade da doença.

### Controle adversarial

Texto semelhante aparece em seleções de ortopedia, oncologia, psiquiatria e outras
especialidades, algumas com a expressão “solicitação eletrônica de vagas”.

### Decisão

O edital confirma o ambulatório e uma competência institucional de priorização. Não
prova sozinho que o desafio seja slot fixo, fila única, um anestesiologista por turno ou
agenda controlada pelo novo produto.

### Impacto

A hipótese ambulatorial multidiária ganha peso; o fluxo específico continua bloqueado
pelo Analyst.

---

## W-005 · 13/08/2026 · Hipótese canônica adotada

**Estado:** hipótese

### Formulação

Solicitações de CPA representam casos diferentes, mas chegam à alocação sem informação
operacional suficiente — ou sem regra que use essa informação — para diferenciar
prioridade, esforço, recurso e pendência.

### Decisão

O Antessala investigará e demonstrará triagem aplicada ao agendamento ambulatorial.

### Limite

Ainda não estão aprovados:

- ator de triagem;
- canal de coleta;
- campos;
- motor clínico;
- modalidades;
- tempos;
- agenda própria;
- integração;
- cirurgia antes/depois da CPA;
- número ou escala de anestesiologistas.

### Próximo passo

MiniSpec 001 e gates G1–G8 do Analyst.

---

## W-006 · 13/08/2026 · PRD PRÉ-VIA reclassificado

**Estado:** invalidado como PRD; preservado como banco de hipóteses

### Contexto

O documento PRÉ-VIA descreveu atores, FHIR, quatro trilhas, ASA presumido, RCRI, DASI,
STOP-BANG, slots de 15/30/60 minutos, 21 dias, WhatsApp, liberação assíncrona, métricas e
integrações.

### Decisão

O documento não é fonte de requisitos. Seus conceitos passam por auditoria individual.

### O que sobreviveu no PRD canônico

- caso relaciona paciente e procedimento;
- coleta estruturada;
- dados ausentes como pendência;
- regras explicáveis e versionadas;
- revisão humana;
- tradução da decisão para necessidade operacional;
- auditoria;
- integrações futuras claramente mockadas.

### O que voltou para hipótese

Todos os atores não confirmados, canais, scores, rotas, cores, tempos, integrações,
status, metas e causalidade sobre suspensão cirúrgica.

---

## W-007 · 13/08/2026 · Fundação técnica preservada

**Estado:** provado historicamente

### Contexto

A preparação do repositório foi concluída antes da correção do produto.

### Evidência lacrada

- cadeia final da preparação: commit `bc98182`;
- último commit da branch de preparação: `4f9e529`;
- merge em `main`: `a8597ab`;
- 51 arquivos de teste, 216 testes, typecheck, build e E2E verdes na cadeia registrada;
- primeiro boot/seed local sem download de modelo;
- `node_modules` medido em 1.038.844 KiB após a poda;
- CID-10, medicamentos, MET, widgets, PGlite, IPC e PDF presentes.

### Decisão

A prova vale para a fundação técnica naquele SHA, não para a hipótese clínica nova.

### Impacto

Não reconstruir a casca. Reutilizar infraestrutura depois do contrato; tratar schema,
jornada, classificador e widgets ativos como provisórios.

---

## W-008 · 13/08/2026 · Branches paralelas colocadas em quarentena

**Estado:** decidido

### Branches

- `codex/motor-fila-logica-v2`;
- `codex/motor-da-fila-resume`;
- `origin/hack/02-quais-widgets`;
- `origin/zan/widgets`.

### Motivo

As duas primeiras implementam o problema invalidado. As duas últimas misturam material
clínico aproveitável com identidade descartável, fila física, templates, rotas e tempos
não confirmados.

### Decisão

Não mergear ou cherry-pickar em bloco. O Analyst pode minerar perguntas, referências,
schemas ou testes individualmente, registrando a decisão aqui.

---

## W-009 · 13/08/2026 · Uma única arquitetura documental

**Estado:** decidido

### Artefatos removidos

- antigo Analyst de produto;
- specs e prompts 001/002;
- mapa e relatório separados da preparação;
- README da antiga frente de widgets;
- PLANO e INVENTARIO em HTML.

Todos permanecem recuperáveis no histórico Git.

### Nova fonte de verdade

```text
hack/PRD.md
hack/ANALYST.md
hack/BUILD.md
hack/WARLOG.md
hack/minispecs/<sprint>/spec.md
hack/minispecs/<sprint>/writing-plan.md
```

### Regra

- PRD: problema e promessa;
- Analyst: evidência, contratos e veto;
- Build: execução mestre;
- Warlog: decisões e provas;
- minispec: sprint executável.

Não criar novos PRDs, analyses, planos gerais ou relatórios paralelos.

---

## W-010 · 13/08/2026 · Três sprints, não uma catedral de specs

**Estado:** decidido

1. Fechar contrato operacional.
2. Construir triagem e decisão humana aprovadas.
3. Construir tradução para agenda e demo end-to-end.

Se o Sprint 001 revelar que o produto apenas qualifica solicitações para uma agenda
externa, o Sprint 003 encolhe e nenhum calendário será criado. Se revelar um domínio de
agenda próprio e comprovado, o Build será refinado sem abrir uma quarta minispec por
conveniência.

---

## W-011 · 13/08/2026 · Prontuário e agenda cirúrgica têm limites de evidência

**Estado:** observado

### Evidência consultada em 13/08/2026

- A Carta de Serviços do HCFMRP descreve setor de Registro e acesso ambulatorial
  institucional.
- O portal oficial Nosso HC Ribeirão se identifica como acesso aos dados do prontuário
  do paciente.
- O artigo institucional 514 descreve a Central Única de Agendamentos Cirúrgicos e suas
  métricas de cirurgia.
- Uma notícia institucional indexada sobre a transição Athos → Iris retornava HTTP 404
  no locator vivo; por isso, essa transição não sustenta fato confirmado neste projeto.

### Decisão

Paciente institucional, prontuário eletrônico e Central Cirúrgica existem como contexto.
Isso não prova qual sistema cria a solicitação de CPA, quem acessa seus dados ou como a
agenda do Ambulatório de Pré-Anestesia se relaciona à Central.

### Impacto

- paciente descartável continua invalidado;
- números da Central Cirúrgica não viram baseline da CPA;
- Athos, Iris, SIRESP e integrações permanecem perguntas do gate G4;
- qualquer fluxo entre esses sistemas exige demonstração local e validação do dono.

### Locators

- [Carta de Serviços HCFMRP](https://cartaservicos.hcrp.usp.br/)
- [Nosso HC Ribeirão](https://appiris.hcrp.usp.br/apex/r/iris/nossohcribeirao/login)
- [Central Única de Agendamentos Cirúrgicos](https://www.hcrp.usp.br/revistaqualidade/uploads/Artigos/514/514.pdf)

---

## W-012 · 13/08/2026 · Hipótese não substitui evidência e demo precisa diferenciar

**Estado:** decidido

### Contexto

A primeira redação do gate aceitava “evidência ou hipótese isolada” de forma universal e
permitia que três casos iguais satisfizessem a demo mediante justificativa.

### Decisão

- Fato operacional local, integração, protocolo e regra clínica exigem evidência primária
  verificável; hipótese aceita só orienta escolha delimitada, reversível e visivelmente
  sintética da demo.
- A demo exige um par de contraste que produza requisitos/tratamentos distintos pelo
  oráculo aprovado e um controle negativo que permaneça igual.

### Impacto

O Analyst não pode liberar build hospitalar por plausibilidade, e a demo não pode esconder
indiferenciação atrás de uma explicação textual.

---

## W-013 · 14/08/2026 · Analyst expandido e discovery retirada dos sprints

**Estado:** decidido

### Contexto

O material “Gates do Analyst — Antessala” consolidou perguntas de RBAC, ownership por
campo, widgets, documentos, protocolos, régua, agenda, arquitetura, sincronização,
concorrência, segurança, reaproveitamento e prova que não cabiam nos oito gates
resumidos. Também revelou uma falha na arquitetura documental vigente: a MiniSpec 001
era chamada de sprint, mas executava descoberta — exatamente o trabalho que precisa
acontecer antes do Build receber autorização.

### Decisão

- O Analyst passa a possuir 22 gates P0, matriz mestra de rastreabilidade, dívida P1 e
  checklist final.
- Descoberta permanece autorizada, porém dentro do Analyst; nenhuma minispec está
  liberada.
- Os três sprints posteriores ao `PASS` passam a ser:
  1. caso, triagem e classificação;
  2. capacidade, agenda e booking;
  3. handoff e prova final.
- Três logins, 23 widgets, classes `SIMPLE/STANDARD/COMPLEX`, slots `S/M/L`, FullCalendar,
  web compartilhada, consulta pós-agendamento e retorno cirúrgico permanecem candidatos,
  não requisitos.

### Impacto

O Build e as seis peças das minispecs foram realinhados. O Sprint 003 termina onde a
evidência disser que a promessa termina; não cria consulta, laudo ou planejamento
cirúrgico por sugestão do material.

### Pendência

Executar a descoberta dos gates P0 com representantes, artefatos e fontes primárias do
HC. Somente o Analyst pode converter candidato em contrato de build.

---

## W-014 · 14/08/2026 · Fluxo decretado e burocracia pré-hack removida

**Estado:** decidido; invalida o bloqueio de W-013 para o MVP

### Contexto

A entrega ocorre hoje. Exigir screen-share hospitalar, representantes de setores, agenda
anonimizada e documentação de API antes do build tornaria o plano terminalmente
impossível: três sprints bloqueados e nenhum produto para apresentar.

### Lei de produto

```text
médico indica procedimento e encaminha para pré-anestesia
→ recepção recebe encaminhamento
→ enfermagem realiza anamnese
→ confirma RAPIDO, NORMAL ou ESTENDIDO
→ recepção agenda slot compatível
→ anestesiologista conclui ou cria pendência/retorno
→ resultado volta ao serviço solicitante
```

A triagem geral do SUS e a marcação da cirurgia ficam fora.

### Decisão

- O MVP é Electron + PGlite no Mac.
- Dados, agenda e regras são sintéticos e declarados como demonstração.
- Nenhuma integração, autenticação hospitalar ou validação externa bloqueia o hack.
- Os quatro papéis são modos da interface, não logins reais.
- O Analyst muda para `READY FOR BUILD`.
- MiniSpec 001 está liberada; 002 e 003 seguem automaticamente em sequência.
- Next.js, Supabase, Stripe, integrações e homologação pertencem ao pós-vitória.

### Impacto

PRD, Analyst, Build e minispecs foram reduzidos a contratos executáveis. Os 22 gates da
versão anterior deixam de bloquear a demo e podem ser recuperados no histórico quando
existir prêmio, investimento e intenção de piloto.

### Risco aceito

O protótipo não comprova o fluxo real do HC nem validade clínica institucional. Ele prova
coerência, utilidade e execução de uma solução possível para o desafio, com dados
sintéticos e revisão humana.

---

## Pendências pós-vitória — não bloqueiam o MVP

| ID | Pergunta futura | Quando volta |
|---|---|---|
| P-01 | o que exatamente é semelhante no agendamento real? | discovery de piloto |
| P-02 | quais cargos executam cada papel no HC? | discovery de piloto |
| P-03 | como a anestesiologia organiza capacidade real? | desenho operacional |
| P-04 | quando a data cirúrgica nasce? | integração com planejamento |
| P-05 | quais sistemas contêm solicitação e agenda? | integração hospitalar |
| P-06 | qual protocolo e catálogo de procedimentos oficiais? | validação clínica |
| P-07 | quais dados/catálogos locais são suficientes? | validação clínica |
| P-08 | qual agenda institucional será integrada? | arquitetura de piloto |
| P-09 | web, LAN ou outra arquitetura multiusuário? | arquitetura pós-prêmio |
| P-10 | qual handoff institucional encerra o caso? | discovery de piloto |
| P-11 | autenticação e RBAC reais por campo? | segurança de produção |
| P-12 | quais documentos possuem obrigação legal? | jurídico/compliance |
