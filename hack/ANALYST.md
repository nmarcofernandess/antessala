# ANALYST — guardião do Antessala

**Estado:** `NO-GO PARA BUILD`
**Hipótese de produto:** aprovada para investigação
**Minispec liberada:** somente `001-contrato-operacional`
**Última revisão:** 13/08/2026

---

## 0. Mandato

Este é o único Analyst do repositório. Sua função não é deixar o PRD bonito: é impedir
que hipótese vire tabela, tela ou algoritmo sem contrato.

O Analyst é dono do portão entre descoberta e construção:

```text
PRD formula a hipótese
→ Analyst exige evidência e fecha contratos
→ BUILD organiza a execução aprovada
→ minispec escreve e executa um sprint
→ WARLOG registra o que realmente aconteceu
```

Se faltar ator, dono do dado, origem, regra clínica, regra temporal, transição, catálogo,
permissão ou critério de aceite, o veredito é:

> **YOU SHALL NOT PASS.** Não existe writing plan executável e não existe build.

O Analyst não pode ser contornado por código já existente, urgência do hackathon,
diagrama convincente, literatura externa ou “parece que funciona assim”.

---

## 1. Veredito atual

### O que fechou

A família do problema está suficientemente identificada:

> Triagem aplicada ao agendamento ambulatorial da consulta pré-anestésica — não fila de
> recepção, pulseira ou pronto atendimento.

### O que não fechou

Ainda não sabemos qual decisão operacional precisa mudar, quem a executa, quais dados
existem no momento da solicitação nem como a agenda real representa capacidade.

Consequência:

| Superfície | Veredito |
|---|---|
| Pesquisa e consolidação do fluxo atual | **PASS** |
| Refatoração documental | **PASS** |
| Fixtures sintéticas para investigação | **PASS com rastreabilidade** |
| Schema clínico definitivo | **BLOCKED** |
| Formulário/widgets finais | **BLOCKED** |
| Motor de risco/complexidade | **BLOCKED** |
| Papéis e telas finais | **BLOCKED** |
| Agenda própria ou integração | **BLOCKED** |
| Ordenação, slots, rotas ou tempos | **BLOCKED** |

---

## 2. Matriz da verdade

### 2.1 Confirmado

| Fato | Fonte |
|---|---|
| O desafio trata da CPA e diz que riscos/complexidades diferentes são agendados de forma semelhante | briefing oficial, Desafio 1 |
| Existe Ambulatório de Pré-Anestesia no HCFMRP | Edital HCRP nº 11/2026 |
| Atendimento ambulatorial institucional é previamente agendado | Carta de Serviços HCFMRP |
| O anestesiologista realiza a avaliação e atribui classificação clínica na APA | material institucional do HCFMRP e CFM |
| O profissional da consulta pode ser diferente daquele da anestesia | Resolução CFM nº 2.174/2017 |
| O paciente possui registro institucional e acesso oficial a dados do prontuário | Carta de Serviços e portal Nosso HC Ribeirão |
| A Central de Agendamento Cirúrgico é uma superfície distinta do ambulatório | publicação institucional sobre agendamento cirúrgico |

### 2.2 Hipótese forte

- O alvo principal é uma agenda multidiária de consulta ambulatorial.
- A oportunidade está antes ou durante a alocação da vaga.
- Risco, complexidade e pendências precisam produzir uma recomendação operacional.
- Capacidade do ambulatório/anestesiologia é recurso escasso.
- O caso pré-anestésico deve relacionar paciente e procedimento, e não ser uma pessoa
  descartável esperando presencialmente.

### 2.3 Não provado

- fila única de solicitações;
- um anestesiologista por turno;
- slot fixo atual;
- triagem executada por enfermagem;
- preenchimento pelo paciente;
- WhatsApp, SMS ou telefone;
- API FHIR/HL7;
- agenda acessível por integração;
- cirurgia com data anterior à CPA;
- vagas protegidas, encaixes ou overbooking;
- teleconsulta ou análise assíncrona;
- ambulatório de alto risco separado;
- tempos de 15, 30, 45 ou 60 minutos;
- trilhas coloridas;
- redução de suspensão cirúrgica causada por esta intervenção.

### 2.4 Derrubado como fonte canônica

- paciente descartável;
- proibição de histórico/evolução;
- quatro telas antigas;
- prioridade derivada da anamnese;
- fila por urgência mais minutos de espera;
- hub de recepção;
- score de envelhecimento;
- pulseira/cor como modelo de risco anestésico;
- offline como requisito do hospital;
- ASA presumido como motor suficiente;
- integração com PEP/agenda/mapa como fato.

---

## 3. Oito gates obrigatórios de descoberta

### G1 · Fluxo real e sequência

Responder com uma demonstração de caso anonimizado:

1. Qual evento dispara a necessidade de CPA?
2. Quem cria a solicitação?
3. Em qual sistema e tela?
4. Quais campos existem naquele momento?
5. A cirurgia está sem data, com janela, data provisória ou confirmada?
6. A CPA libera entrada na lista, definição da data ou apenas confirmação?
7. Quais estados existem até a consulta acontecer?

**Prova mínima:** screen-share de um caso do pedido ao resultado da CPA, mais formulário
ou captura das telas sem dados identificáveis.

### G2 · Significado de “agendado de forma semelhante”

Identificar exatamente o que permanece igual hoje:

- ordem;
- data/antecedência;
- duração;
- modalidade;
- agenda/profissional;
- sala ou recurso;
- preparação/pêndencia;
- apenas a visibilidade dada ao agendador.

**Prova mínima:** agenda anonimizada de uma semana, configuração dos tipos de vaga e
explicação de dois casos que deveriam receber tratamento diferente.

### G3 · Atores e autoridade

Construir matriz ação × dado para:

- serviço/cirurgião solicitante;
- paciente;
- enfermagem;
- anestesiologista;
- secretária;
- recepcionista;
- regulação/agendamento;
- gestor.

Perguntas críticas:

- secretária, recepcionista e regulação são funções diferentes?
- quem coleta, confirma, corrige e reabre dado?
- quem atribui classificação médica?
- quem traduz a classificação em requisito operacional?
- quem escolhe o slot?
- “um anestesiologista” significa um por turno, ambulatório, revisão ou escopo do relato?

**Prova mínima:** swimlane validado por representantes reais dos setores.

### G4 · Sistemas, identidade e integração

Mapear:

- o que vive no Iris, Athos, SIRESP e sistema cirúrgico;
- identificador canônico de paciente, solicitação, procedimento e agendamento;
- API, exportação, fila, arquivo ou somente interface humana;
- relação entre agenda ambulatorial e Central de Agendamento Cirúrgico;
- origem e destino de cada dado;
- estratégia da demo quando a integração não existir.

**Prova mínima:** mapa aprovado pela TI ou pelo dono operacional. Sem documentação de
API, integração será mock declarada.

### G5 · Contrato clínico e procedimento

Responder antes de criar schema ou widget:

1. “Risco” e “complexidade” são quais conceitos locais?
2. ASA é resultado da CPA ou insumo anterior disponível?
3. Qual protocolo institucional define perguntas, flags e pendências?
4. A urgência cirúrgica vem do serviço solicitante?
5. Qual catálogo representa procedimento: código local, SIGTAP, ambos ou outro?
6. Onde se cadastram condições específicas por cirurgia?
7. Quem aprova e versiona esse conteúdo?

O contrato esperado, se confirmado, deve separar:

```text
Procedimento
→ versão de protocolo
→ perguntas obrigatórias e condicionais
→ flags e pendências
→ exames/preparo com regras contextuais
→ requisito operacional de avaliação
→ dono clínico, vigência e rollback
```

Não criar um mega-widget por cirurgia. Widgets capturam fatos reutilizáveis; protocolos
versionados compõem perguntas e regras por procedimento.

### G6 · Agenda e capacidade

Antes de escolher FullCalendar, DietFlow ou componente próprio, descobrir:

- o produto apenas recomenda um tipo de vaga ou será dono da agenda?
- quantas agendas, profissionais, locais e turnos existem?
- como disponibilidade e bloqueios são criados?
- quais durações/tipos realmente existem?
- um slot limita modalidade, profissional, local, protocolo ou capacidade?
- há reservas, encaixes, overbooking, remarcação, falta e cancelamento?
- como concorrência de alocação é resolvida?
- o que acontece quando não existe vaga compatível?

**Lei:** FullCalendar é renderizador, não domínio. A escolha da biblioteca ocorre depois
do contrato. Se o produto somente exporta uma recomendação à agenda institucional, talvez
nem exista calendário próprio.

### G7 · Regras, segurança e decisão humana

Toda regra candidata precisa de:

- fonte científica e protocolo local;
- versão imutável;
- responsável clínico nominal;
- entradas e unidades explícitas;
- tratamento de ausente, desconhecido e contraditório;
- explicação item a item;
- override humano com motivo;
- testes de fronteira e fixtures sintéticas;
- política de recálculo sem apagar decisão anterior;
- vigência, aposentadoria e rollback.

ASA final, aptidão, estratégia anestésica, solicitação de exame e manejo medicamentoso
não podem sair automaticamente sem contrato institucional explícito.

### G8 · Baseline e aceite

Medir ou declarar indisponível:

- quantidade de solicitações e capacidade oferecida;
- tempo de acesso à CPA;
- duração agendada e duração real;
- ocupação, faltas e remarcações;
- distribuição dos perfis relevantes;
- pendências descobertas tarde;
- suspensões atribuíveis a condição identificável na CPA;
- dimensão que o hospital pretende melhorar.

Números da Central de Agendamento Cirúrgico não são baseline automático do Ambulatório
de Pré-Anestesia. Sem baseline, o hack usa critérios determinísticos de demonstração e
não promete percentuais.

---

## 4. Auditoria de dados e catálogos

### 4.1 O que já existe no repositório

| Ativo | Cobertura atual | Veredito |
|---|---:|---|
| CID-10 | 14.793 itens hierárquicos | útil para codificação; insuficiente para estado clínico |
| Medicamentos | 382 itens, 35 classes e aliases | recorte curado; não é base ANVISA completa |
| MET | 94 atividades | candidato; instrumento e uso precisam de validação |
| Comorbidades | 14 grupos curados | insuficiente como universo clínico |
| Widgets portados | 8 contratos do DietFlow | infraestrutura reutilizável; catálogo clínico não definido |
| Classificador/parecer | funções puras portadas | hipótese antiga; proibido tratá-las como protocolo aprovado |

### 4.2 Por que CID e medicamentos não bastam

CID identifica diagnóstico, mas não representa controle, gravidade, atividade, data,
proveniência ou impacto funcional.

Medicamento exige, conforme o uso aprovado: produto/princípio ativo, dose, via,
frequência, indicação, última tomada, função renal e contexto. A existência de uma classe
terapêutica não autoriza sugerir suspensão.

Exames exigem código local/LOINC quando aplicável, unidade, método, data, fonte e validade
dependente de protocolo. Procedimentos exigem código local/SIGTAP, especialidade,
abordagem, combinação e atributos clínicos aprovados.

### 4.3 Contrato mínimo de widget

Cada widget/pergunta aprovada precisa declarar:

- schema e cardinalidade;
- condição de exibição;
- obrigatório, desconhecido, não se aplica e recusado;
- quem responde, confirma e corrige;
- origem e timestamp;
- consistência e conflito;
- saída estruturada, resumo, sinal e pendência;
- versão e compatibilidade com respostas anteriores.

O widget captura fato. Protocolo e regra clínica interpretam o fato.

---

## 5. Auditoria do código atual

### 5.1 Fundação reaproveitável

- Electron + React + shadcn/ui;
- PGlite e migrations locais;
- IPC tipado;
- primeiro boot sem download de modelo;
- composer e contratos versionados de anamnese;
- catálogos locais e seed reprodutível;
- exportação PDF;
- IA opcional e memória/RAG dormentes;
- testes Vitest/Playwright.

### 5.2 Contratos provisórios que não podem comandar o produto

- tabela `registros` com pessoa embutida;
- `registro_jornada` e seus seis estados físicos;
- campo `prioridade` 1–4;
- `src/shared/clinical/registro.ts`;
- `src/shared/extensions/motor-fila.ts`;
- classificador/parecer portados;
- marca e textos associados à fila de espera;
- rotas atuais da casca.

Não reescrever esses contratos por impulso nesta reorganização documental. O Sprint 001
decidirá migração, descarte ou adaptação depois do contrato real.

### 5.3 Branches em quarentena

Não mergear integralmente:

- `codex/motor-fila-logica-v2`;
- `codex/motor-da-fila-resume`;
- `origin/hack/02-quais-widgets`;
- `origin/zan/widgets`.

Elas foram construídas sobre hipóteses antigas ou misturam pesquisa válida com decisões
não aprovadas. Podem ser mineradas arquivo a arquivo somente depois de auditoria.

---

## 6. Decisões técnicas que o Analyst precisa fechar

| ADR necessária | Pergunta de decisão | Bloqueia |
|---|---|---|
| Identidade e caso | referenciar registro HC, snapshot, réplica ou fixture? | schema inteiro |
| Fonte clínica | manual, paciente, PEP, importação ou combinação? | coleta e confiança |
| Catálogo de procedimentos | qual fonte, autoria, versão e fallback? | regras específicas |
| Autoria de protocolo | onde cadastrar e publicar condições por procedimento? | widgets e motor |
| Limite do motor | sinaliza, recomenda ou decide quais eixos? | segurança e UI |
| Agenda | recomendação externa ou agenda própria? | FullCalendar e persistência |
| Recursos | profissional, local, modalidade, duração e restrições | alocação |
| Papéis | quais superfícies e permissões existem? | navegação e IPC |
| Deploy | demo offline versus integração institucional | arquitetura e segurança |
| Auditoria | eventos, retenção, acesso e autoria | produção/piloto |

Cada ADR é consolidada neste arquivo; não criar uma floresta de documentos paralelos.
O racional e a evidência entram no [`WARLOG.md`](WARLOG.md).

---

## 7. Porta de saída por minispec

### MiniSpec 001 · Contrato operacional

**Pode iniciar agora.** Sai apenas quando G1–G8 tiverem resposta e decisão explícita;
lacuna ainda bloqueante mantém o `NO-GO`. Entrega contratos, não funcionalidade clínica.

### MiniSpec 002 · Triagem e decisão humana

Só recebe `PASS` quando:

- unidade `Paciente → Solicitação → Caso` estiver definida;
- papéis e permissões estiverem validados;
- campos e widgets P0 tiverem dono e fonte;
- catálogo de procedimentos/protocolos tiver estratégia;
- limite do motor e autoridade humana estiverem fechados;
- fixtures cobrirem ausente, conflito e mudança de procedimento;
- migration do legado estiver decidida.

### MiniSpec 003 · Agenda diferenciada e demo

Só recebe `PASS` quando:

- significado de “agendamento semelhante” estiver comprovado;
- produto for definido como recomendador ou dono da agenda;
- recursos, slots, restrições e concorrência tiverem contrato;
- política de encaixe/remarcação estiver explícita ou fora do escopo;
- biblioteca visual tiver sido escolhida por aderência, licença e bundle;
- integração versus mock estiver marcada em cada fronteira;
- critérios end-to-end tiverem fixtures e oráculo determinístico.

---

## 8. Formato obrigatório de um `PASS`

O Analyst só libera um item quando existir:

```text
DECISÃO
+ classe da alegação
+ evidência exigida para essa classe
+ responsável humano
+ contrato de dados
+ ator autorizado
+ regra temporal
+ estados válidos e inválidos
+ critério de aceite verificável
+ impacto no legado
```

Para **fato operacional local, integração, protocolo ou regra clínica**, a evidência é
obrigatoriamente primária e verificável: fonte/artefato, locator ou trecho, data da
observação, responsável pela validação e limite do que ela comprova. Entrevista indireta,
literatura geral e código existente não liberam esse tipo de decisão.

Uma **hipótese aceita** só pode orientar escolha delimitada da demonstração — fixture,
mock ou mecanismo reversível de UI — quando estiver ostensivamente marcada e não alterar
regra clínica, autoridade, dado institucional, integração ou alegação sobre o hospital.
Ausência de evidência local em qualquer gate P0 mantém o build bloqueado.

“A biblioteca faz”, “a IA consegue”, “a literatura usa” e “já existe código” não são
substitutos.

---

## 9. Grill obrigatório antes do build

O Analyst deve conseguir responder sem improvisar:

1. Marina, no papel real dela, abre qual sistema e enxerga o quê?
2. Qual botão ou evento cria o caso?
3. Qual informação ela não possui e precisa obter?
4. Qual decisão concreta muda na agenda depois da triagem?
5. Quem tem autoridade para essa decisão?
6. Onde o perfil do procedimento é cadastrado e versionado?
7. O que acontece quando um dado está ausente ou contradiz o PEP?
8. O que acontece quando o paciente ou o procedimento muda?
9. O que acontece quando não existe vaga compatível?
10. Qual parte da demo é dado real, regra aprovada, fixture ou mock?

Se qualquer resposta usar “provavelmente” sem estar marcada como hipótese aceita, o
cajado continua no chão.

---

## 10. Fontes primárias de controle

- [Edital HCRP nº 11/2026](https://extranet.hcrp.usp.br/novorh/arquivos/3432/E34322332026104736.pdf)
- [Carta de Serviços do HCFMRP](https://cartaservicos.hcrp.usp.br/)
- [Avaliação pré-anestésica e ASA no HCFMRP](https://hcrp.usp.br/revistaqualidadehc/uploads/Artigos/477/477.pdf)
- [Central de Agendamento Cirúrgico do HCFMRP](https://www.hcrp.usp.br/revistaqualidade/uploads/Artigos/514/514.pdf)
- [Nosso HC Ribeirão — portal oficial de acesso ao prontuário](https://appiris.hcrp.usp.br/apex/r/iris/nossohcribeirao/login)
- [Resolução CFM nº 2.174/2017](https://sistemas.cfm.org.br/normas/visualizar/resolucoes/BR/2017/2174)
- [LGPD compilada](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)

Fontes externas demonstram possibilidade, nunca realidade local. Qualquer nova fonte e
sua interpretação devem entrar primeiro no WARLOG.
