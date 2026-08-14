# ANALYST — guardião do Antessala

**Estado:** `NO-GO PARA BUILD`
**Hipótese de produto:** aprovada para investigação
**Minispec liberada:** nenhuma
**Última revisão:** 14/08/2026

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

### 0.1 Estrutura canônica interna

Este único arquivo contém, sem abrir analyses paralelos:

| Bloco obrigatório | Onde vive |
|---|---|
| A · verdade operacional | matriz da verdade + G1, G2 e G9 |
| B · atores e permissões | G3 e G11 |
| C · domínio, estados e invariantes | G5, G10, G14 e G16 |
| D · widgets e proveniência | G12 e auditoria de catálogos |
| E · régua e override | G7 e G14 |
| F · agenda e concorrência | G6, G15 e G16 |
| G · arquitetura, source of truth e offline | G17 e G18 |
| H · reaproveitamento | G21 + auditoria do código |
| I · segurança e auditoria | G19 |
| J · testes, prova e métricas | G8 e G22 |
| K · escopo das minispecs | porta de saída por minispec |

Entregáveis de descoberta são consolidados nessas seções e no Warlog. Não criar um novo
PRD, analysis, relatório ou plano geral para preencher um gate.

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

Pesquisa é trabalho do Analyst, não uma minispec de build. As três minispecs permanecem
bloqueadas até que os gates P0 tenham decisão, evidência e contrato suficientes para a
fatia correspondente.

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

### 2.5 Matriz mestra de rastreabilidade

Antes de liberar build, toda jornada crítica precisa caber nesta matriz:

| Ator | Evento inicial | Superfície | Campo/widget | Fonte | Regra consumidora | Saída | Estado resultante | Permissão | Persistência | Exportação | Teste |
|---|---|---|---|---|---|---|---|---|---|---|---|

Um exemplo serve apenas para testar o formato; não cria ator, campo ou regra do HC. Se
existir tela, ação, dado, entidade ou transição sem linha equivalente, o gate continua
aberto.

Cada linha precisa responder também:

- qual decisão está sendo tomada;
- se a alegação é fato, hipótese, decisão ou pendência;
- quem pode visualizar, criar, corrigir, confirmar e reabrir;
- o que acontece quando a entrada falta, contradiz outra fonte ou chega atrasada;
- se o item pode ser adiado e qual dívida nasce desse adiamento.

---

## 3. Gates P0 obrigatórios

Qualquer gate P0 aberto significa `NO-GO` para a fatia que depende dele. “Configurável”,
“o sistema alerta”, “integra depois”, “offline-first”, “três perfis” e “usar o componente
existente” não são respostas sem dono, default, contrato, falha e teste.

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

### G9 · Fronteira exata do produto

Fechar explicitamente o início e o fim do Antessala:

- qual evento cria o caso;
- se o produto qualifica, agenda, acompanha consulta ou apenas entrega um requisito;
- o que pertence ao serviço solicitante, ambulatório, agendamento e planejamento
  cirúrgico;
- se há qualquer relação com horas de sala cirúrgica — fora do escopo por padrão;
- qual estado terminal e qual handoff provam que o valor foi entregue.

O produto não ganha centro cirúrgico, prontuário paralelo, comunicação com paciente ou
gestão documental por infiltração de tela.

### G10 · Identidade, caso e solicitação

Decidir com fonte real:

- identificador institucional de paciente e de atendimento;
- chave da solicitação de CPA e do procedimento proposto;
- se o protótipo guarda referência, snapshot mínimo, réplica ou apenas fixture;
- política para correção cadastral, duplicidade, múltiplos procedimentos e nova
  solicitação da mesma pessoa;
- fronteira de dados pessoais e clínicos que o Antessala precisa persistir.

O antigo identificador descartável não pode voltar por conveniência da demo. Tampouco o
protótipo pode virar um cadastro hospitalar fictício sem decisão explícita.

### G11 · Atores, autenticação, RBAC e ownership

O Analyst precisa distinguir cargo, papel funcional e usuário. Deve existir matriz por
ação e dado, não apenas por página, cobrindo no mínimo os papéis realmente observados no
fluxo.

Para cada campo: quem origina, transcreve, confirma, corrige, sobrescreve, visualiza e
audita. O número de logins da demo será consequência da separação real de autoridade;
“três usuários” é candidato de demonstração, não fato operacional.

Invariantes de segurança:

- nenhum papel administrativo altera dado clínico sem autoridade confirmada;
- nenhum papel de coleta toma decisão reservada ao anestesiologista;
- override exige ator, motivo, instante e preservação da sugestão anterior;
- acumular papéis precisa ser explícito e testado.

### G12 · Catálogo de widgets, formulários e documentos

Auditar os oito widgets portados e todos os candidatos do material de pesquisa. Para
cada item, registrar:

```text
nome e finalidade
→ decisão que consome o dado
→ ator que responde e confirma
→ fonte e temporalidade
→ schema, unidade e cardinalidade
→ ausente/desconhecido/não aplicável/recusado/conflitante
→ condição de exibição
→ regra ou pendência produzida
→ resumo/exportação
→ versão, migração e teste
```

O inventário sugerido de 23 blocos é uma lista de auditoria, não um backlog aprovado. Um
widget sem consumidor ou justificativa não entra. Formulários, PDF, assinatura e
exportação só existem quando houver ator, finalidade, destino e obrigação comprovados.

### G13 · Procedimentos e condições específicas

Confirmar catálogo local, SIGTAP ou outra fonte; especialidade, abordagem, porte e
combinações; dono clínico e ciclo de publicação. Condições por procedimento vivem em
protocolos versionados que compõem fatos reutilizáveis, perguntas condicionais,
pendências e requisitos operacionais. Não criar mega-widget por cirurgia.

Auditar cobertura e licença de CID, medicamentos, exames, procedimentos e terminologias.
CID não representa estado clínico; lista de medicamentos não autoriza conduta; exame sem
unidade, método, data e contexto não sustenta regra.

### G14 · Régua clínico-operacional

Fechar separadamente:

- complexidade da avaliação;
- prioridade/antecedência de acesso;
- prontidão e pendências;
- recurso, modalidade e esforço esperado;
- decisão médica, que não é reduzida aos eixos acima.

Classes como `SIMPLE/STANDARD/COMPLEX`, templates `S/M/L`, pontos ou cores são apenas
candidatos. Antes de qualquer código: entradas disponíveis, função consumidora, regra
aprovada, versão, explicação, confiança, override, recálculo e cenários-limite.

Informação ausente nunca vale “não”. Uma recomendação não pode se apresentar como ASA
final, aptidão, solicitação de exame, suspensão de medicamento ou conduta anestésica.

### G15 · Agenda, capacidade e unidade temporal

Descobrir se a saída é recomendação, booking demonstrativo ou integração. Se houver
domínio de agenda, definir:

- recurso agendável, local, profissional, modalidade e restrições;
- disponibilidade, bloqueio, turno, duração e granularidade;
- tipos/templates de vaga e quem os configura;
- prioridade, espera e capacidade protegida, se existirem de fato;
- reserva, confirmação, remarcação, cancelamento, ausência e encaixe;
- resposta quando não há capacidade compatível.

`FullCalendar` é somente projeção visual. Não é banco, motor de compatibilidade nem
garantia de atomicidade. A biblioteca só pode ser escolhida depois do contrato de
domínio, acessibilidade, licença, bundle e testabilidade.

### G16 · Concorrência, estados e reclassificação

Qualquer escrita que disputa capacidade exige contrato de atomicidade, idempotência,
versão esperada e resposta estruturada para conflito. A prova deve simular dois usuários
tentando a mesma vaga, reclassificação durante booking, cancelamento concorrente e retry.

O Analyst precisa fechar a máquina de estados do caso e, se aplicável, do agendamento.
Para cada estado: quem entra, pré-condições, ações permitidas, saídas, reversão,
notificação e auditoria. Estados sugeridos no material são candidatos, não enum pronta.

Definir quais mudanças recalculam o requisito, se uma decisão anterior é preservada e
quem pode reabrir ou sobrescrever.

### G17 · Arquitetura, fonte de verdade e offline

Separar arquitetura de hack, piloto e produção. Comparar explicitamente:

- web com banco compartilhado;
- Electron/PGlite local;
- web em servidor local do hospital;
- híbrido com sincronização.

A demo multiusuário só é honesta se usuários compartilham uma autoridade de dados ou se
a simulação está marcada. O Electron atual é fundação disponível, não decisão final.

Para cada operação, definir source of truth, leitura offline, escrita offline, fila de
sincronização, idempotência, conflito e recuperação. Booking multi-master offline fica
proibido sem autoridade local segura. “Offline” não é uma propriedade única do app.

### G18 · Integrações

Mapear prontuário/PEP, identidade, agenda ambulatorial, agenda cirúrgica, comunicação e
qualquer catálogo externo. Para cada fronteira: dono, protocolo, autenticação, dados,
latência, disponibilidade, idempotência, erro, sandbox e mock.

Nome de sistema, tela parecida ou acesso por portal não prova API. Sem contrato da TI, a
integração permanece mock ostensivo e não entra na promessa.

### G19 · Segurança, LGPD e auditoria

Definir minimização, base legal institucional, retenção, descarte, backup, exportação,
criptografia, sessão, segregação de perfis, incidente e ambiente de demo. Dados reais
não entram no repositório nem na demonstração.

Auditoria mínima para eventos relevantes: ator, papel, ação, entidade, antes/depois
quando permitido, motivo, timestamp, versão do protocolo, origem e correlação. Log
técnico não substitui trilha clínica/operacional.

### G20 · UX por papel e acessibilidade

Só desenhar superfícies depois de fechar tarefa e autoridade. Para cada papel confirmado,
definir o que precisa ver, decidir e corrigir; estados vazio, carregando, erro, conflito,
offline e permissão negada; navegação por teclado; contraste; densidade; texto clínico
completo e linguagem compatível.

Painéis sugeridos para enfermagem, agendamento, anestesiologia, serviço cirúrgico ou
paciente são hipóteses de superfície. Nenhum deles nasce porque o nome parece plausível.

### G21 · Inventário de reaproveitamento

Auditar DietFlow, EscalaFlow e FlowKit por contrato e dependência:

| Decisão | Significado |
|---|---|
| copiar | módulo atravessa com dependências, licença e semântica conhecidas |
| adaptar | contrato serve, domínio/UI/infra não atravessam integralmente |
| extrair | núcleo puro merece pacote ou módulo isolado |
| rejeitar | traz acoplamento, risco ou hipótese incompatível |

Candidatos fortes do DietFlow: contratos de widgets, composer, padrões de agenda,
catálogos e primitivas puras. Candidatos do EscalaFlow: representação de capacidade,
conflito e configuração visual. O FlowKit oferece fundação desktop/IA, mas não substitui
RBAC, source of truth compartilhado nem domínio clínico.

Nenhum reuso passa sem inventário de imports, banco, autenticação, tema, bundle, testes e
licença. “Já existe” não significa “cabe”.

### G22 · Testes, prova e métricas

Antes do build, definir oráculos para domínio, widgets, régua, RBAC, persistência,
concorrência, offline/sync, segurança e E2E. A demo precisa provar:

- par de contraste com requisito e tratamento distintos;
- controle negativo com resultado equivalente;
- mudança de procedimento quando o protocolo determina diferença;
- ausente/conflito como pendência;
- override auditável;
- vaga incompatível recusada e falta de capacidade explícita;
- mocks, fixtures e integrações visualmente distinguíveis.

Métricas institucionais exigem baseline, definição, período e dono. Sem baseline, o
sucesso é apenas determinístico e demonstrativo; nenhum percentual será prometido.

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

Não reescrever esses contratos por impulso nesta reorganização documental. O Analyst
decidirá migração, descarte ou adaptação antes de liberar o Sprint 001.

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

As três minispecs são fatias de build posteriores à descoberta. Nenhuma está liberada
agora.

### MiniSpec 001 · Caso, triagem e classificação

Só recebe `PASS MINISPEC 001` quando:

- início/fim do produto, unidade `Paciente → Solicitação → Caso` e identidade estiverem
  definidos;
- papéis, logins necessários, permissões e ownership por campo estiverem validados;
- widgets e formulários P0 tiverem fonte, consumidor e contrato;
- procedimento, protocolo e limite da régua estiverem fechados;
- estados, reclassificação, auditoria e migração do legado estiverem decididos;
- fixtures cobrirem ausente, conflito, override e mudança de procedimento.

### MiniSpec 002 · Capacidade, agenda e booking

Só recebe `PASS MINISPEC 002` quando:

- significado de “agendamento semelhante” estiver comprovado;
- produto for definido como qualificador, dono de agenda demonstrativa ou integrador;
- `SchedulingRequirement`, recursos, disponibilidade, slots e restrições tiverem
  contrato;
- concorrência, atomicidade, falta de vaga, encaixe, remarcação e cancelamento estiverem
  definidos ou explicitamente fora;
- biblioteca visual tiver sido escolhida por aderência, licença, bundle, acessibilidade e
  testabilidade;
- arquitetura, source of truth, offline e mocks estiverem fechados operação por operação.

### MiniSpec 003 · Handoff e prova final

Só recebe `PASS MINISPEC 003` quando:

- o estado terminal da promessa e o handoff real estiverem validados;
- consulta, retorno ao serviço cirúrgico, documento ou status pós-agendamento estiverem
  confirmados como parte do produto — caso contrário, a fatia fecha apenas a prova do
  agendamento e não inventa continuação;
- superfícies mínimas por papel e dados mínimos de cada handoff estiverem definidos;
- fixtures end-to-end, falha de rede, conflito, falta de capacidade e oráculo
  determinístico estiverem aprovados;
- critérios de segurança, auditoria, exportação e prova visual estiverem fechados.

Essa terceira fatia não autoriza criar consulta, laudo ou status cirúrgico porque o
material sugeriu. Ela contém somente o final do fluxo que a evidência local confirmar.

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

### 8.1 Gates P1 e dívida explícita

Um item P1 só pode ser adiado se registrar:

```text
o que não será feito
como será simulado
qual risco permanece
qual contrato futuro já precisa existir
quem aceita a dívida e até quando
```

P0 não vira P1 para caber no cronograma. Escopo pode encolher; evidência clínica,
autoridade, proteção de dados e integridade do domínio não podem ser simuladas como fato.

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

### 9.1 Checklist final `YOU SHALL NOT PASS`

O Analyst só pode trocar o estado para `READY FOR BUILD` quando:

- [ ] fluxo, fronteira, início e final estão fechados;
- [ ] fatos, hipóteses, decisões e pendências estão separados;
- [ ] paciente, caso, solicitação, procedimento e agendamento possuem identidade;
- [ ] atores, logins, permissões e ownership por campo estão validados;
- [ ] todos os widgets e documentos possuem consumidor, origem e contrato;
- [ ] catálogos e protocolos possuem cobertura, autoria, versão e licença auditadas;
- [ ] régua separa complexidade, prioridade, prontidão, esforço, recurso e decisão médica;
- [ ] informação ausente não é tratada como negativa;
- [ ] override, recálculo, reabertura e histórico de decisão estão definidos;
- [ ] agenda possui recurso, tempo, capacidade, estados e resposta à falta de vaga;
- [ ] reserva e concorrência possuem contrato atômico quando aplicáveis;
- [ ] FullCalendar, se usado, é somente projeção;
- [ ] fronteira com agenda cirúrgica está congelada;
- [ ] arquitetura de demo, piloto e source of truth estão decididas;
- [ ] offline e sync estão definidos operação por operação;
- [ ] integrações reais e mocks estão marcados fronteira por fronteira;
- [ ] segurança, LGPD, retenção, autenticação e auditoria estão descritas;
- [ ] DietFlow, EscalaFlow e FlowKit foram classificados em copiar/adaptar/extrair/rejeitar;
- [ ] máquina de estados e regras temporais estão fechadas;
- [ ] testes adversariais, fixtures e métricas honestas estão definidos;
- [ ] as três minispecs são fatias verticais sem decisão P0 aberta;
- [ ] casos simples, complexos, sem dado, sem vaga, com conflito e falha de rede podem ser
      narrados do início ao fim sem “a gente vê no build”.

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
