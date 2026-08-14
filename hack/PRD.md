# PRD canônico — Antessala

## Triagem aplicada ao agendamento da consulta pré-anestésica

**Hacka Health 2026 · Desafio 1 · HCFMRP-USP**
**Versão:** 2.0 · 13/08/2026
**Estado:** hipótese operacional mais provável, ainda dependente de validação com o HC
**Dono da verdade de produto:** este arquivo

---

## 0. Contrato deste documento

Este é o único PRD do repositório. Ele define **qual problema acreditamos estar
resolvendo**, os limites dessa crença e o valor a demonstrar. Ele não escolhe tabela,
biblioteca, algoritmo, score clínico, widget, integração ou desenho de agenda.

Essas decisões só podem avançar depois do veredito do [`ANALYST.md`](ANALYST.md). O
Analyst pode reduzir, corrigir ou bloquear este PRD quando a evidência operacional
contrariar a hipótese. Código existente não prevalece sobre este documento.

Palavras obrigatórias:

- **confirmado**: está literalmente numa fonte primária;
- **hipótese**: interpretação coerente, mas ainda não confirmada pelo HC;
- **decisão**: escolha deliberada depois da evidência;
- **desconhecido**: não será preenchido por imaginação.

---

## 1. Resumo executivo

O HCFMRP informa que pacientes com diferentes níveis de risco e complexidade são
agendados de forma semelhante para a consulta pré-anestésica, com possível sobrecarga
assistencial e uso inadequado da infraestrutura.

A hipótese mais provável é que exista uma fila multidiária de solicitações para o
Ambulatório de Pré-Anestesia e que, antes da alocação da vaga, a informação disponível
não diferencie suficientemente:

1. **prioridade de acesso** — quão cedo o caso precisa ser avaliado;
2. **esforço esperado** — quanto tempo de consulta o caso provavelmente consumirá;
3. **recurso necessário** — modalidade, profissional, ambiente ou preparo necessário;
4. **pendências prévias** — o que precisa ser resolvido antes de consumir uma vaga.

O Antessala deve transformar uma solicitação ainda pouco qualificada em um **perfil
operacional revisado por humano**, que permita alocar a vaga adequada. O sistema não
substitui a consulta, não determina sozinho aptidão cirúrgica e não cria capacidade
médica do nada.

> **Promessa:** fazer casos diferentes entrarem de forma diferente na agenda certa,
> preservando a decisão clínica humana e tornando explícita a capacidade necessária.

---

## 2. O que sabemos

### 2.1 Confirmado pelo desafio

- A consulta pré-anestésica é uma etapa obrigatória antes de procedimentos cirúrgicos.
- Os pacientes têm riscos e complexidades diferentes.
- Atualmente eles são agendados de forma semelhante.
- Isso pode sobrecarregar equipes e comprometer o uso da infraestrutura.
- O desafio aceita soluções que classifiquem risco com dados, priorizem por complexidade
  e conectem triagem ao agendamento da consulta ou ao planejamento cirúrgico.

O desafio **não informa** o fluxo atual, o ator que agenda, o sistema usado, o momento da
classificação, o conteúdo da solicitação nem qual propriedade do agendamento é igual.

### 2.2 Confirmado por fontes institucionais

- O HCFMRP possui um **Ambulatório de Pré-Anestesia**.
- O atendimento ambulatorial do HCFMRP ocorre mediante agendamento prévio.
- O perfil do cargo de anestesiologia inclui avaliação nesse ambulatório e competência
  gerencial para priorizar fluxo de agendamento conforme gravidade, intensidade da
  doença e necessidades do paciente.
- A consulta pré-anestésica pode ser feita por anestesiologista diferente daquele que
  administrará a anestesia no procedimento.
- A frase institucional sobre priorização também aparece em editais de outras
  especialidades; por isso, ela comprova uma prática geral de gestão de solicitações,
  mas não descreve sozinha o gargalo específico deste desafio.

### 2.3 Hipótese operacional adotada

```text
serviço solicitante indica procedimento
→ nasce solicitação de avaliação pré-anestésica
→ solicitação ainda aguarda qualificação e/ou vaga
→ dados clínicos + perfil do procedimento são triados
→ humano revisa risco, complexidade, pendências e necessidade operacional
→ agenda recebe prioridade, esforço e recurso compatíveis
→ consulta pré-anestésica acontece em data futura
→ resultado alimenta o planejamento do procedimento
```

Essa é a melhor hipótese disponível. Ainda não sabemos:

- se a cirurgia já possui data provisória;
- se a solicitação chega pelo PEP, SIRESP, sistema interno ou papel;
- se a classificação acontece antes ou depois de uma primeira marcação;
- quem coleta, quem classifica e quem efetivamente aloca a vaga;
- se existe um anestesiologista por turno, um revisor central ou outra escala;
- se a dor é prioridade, duração, modalidade, recurso, pendência ou uma combinação;
- se há vagas protegidas ou política de encaixe;
- qual é o baseline de fila, falta, remarcação, suspensão ou tempo ocioso.

---

## 3. O que este problema não é

O escopo não é:

- pulseira de identificação do paciente;
- classificação por cores de uma porta de urgência;
- fila física de pessoas esperando para serem chamadas no mesmo dia;
- ordenação por tempo sentado na recepção;
- gestão do giro de salas do centro cirúrgico;
- substituição do anestesiologista;
- liberação automática para anestesia ou cirurgia;
- escolha autônoma de exames, condutas ou suspensão de medicamentos;
- remarcação compulsória de pacientes já confirmados;
- promessa de que todo paciente simples deixará de ter consulta.

Emergência, identificação por pulseira, risco anestésico, prioridade de acesso e carga de
trabalho da consulta são eixos diferentes. O produto não os colapsará numa única cor.

---

## 4. Problema de produto

### 4.1 Formulação

> Solicitações de consulta pré-anestésica representam casos com necessidades diferentes,
> mas chegam ao agendamento sem informação operacional suficiente — ou sem uma regra que
> use essa informação — para reservar prioridade, tempo e recurso proporcionais.

### 4.2 Consequência provável

Quando todas as solicitações recebem tratamento semelhante, pode ocorrer uma combinação
de:

- caso complexo ocupando vaga insuficiente;
- caso simples consumindo capacidade maior que a necessária;
- caso prioritário descoberto tarde;
- pendência sendo descoberta depois de ocupar a agenda;
- anestesiologista usando tempo para reconstruir informação que poderia chegar antes;
- agenda escondendo falta estrutural de capacidade.

Essas consequências são **hipóteses a medir**, não fatos do HC ainda demonstrados.

### 4.3 Unidade do produto

A unidade central não é “pessoa na fila”. É o **caso pré-anestésico**:

```text
paciente institucional
+ procedimento proposto
+ solicitação
+ dados válidos naquele momento
+ avaliação/revisão humana
+ decisão operacional de agendamento
```

Um mesmo paciente pode possuir mais de um caso em momentos diferentes. O protótipo usa
identidades sintéticas, mas não declara que pacientes reais são descartáveis ou sem
histórico.

---

## 5. Atores provisórios

Os nomes abaixo são papéis funcionais. O Analyst precisa confirmar os cargos e descobrir
se algum papel é acumulado pela mesma pessoa.

| Papel provisório | Decisão que precisa tomar | Informação mínima esperada |
|---|---|---|
| Serviço solicitante | pedir avaliação para determinado procedimento | paciente, procedimento, indicação e contexto temporal |
| Triagem operacional/clínica | completar informação e identificar exceções | respostas, prontuário disponível, pendências e perfil do procedimento |
| Anestesiologia | revisar a avaliação e definir a conduta médica aplicável | dados clínicos, procedimento, justificativas e incertezas |
| Regulação/agendamento | alocar capacidade compatível | prioridade, esforço, recurso, restrições e disponibilidade |
| Gestão do ambulatório | ajustar capacidade e acompanhar gargalos | demanda, oferta, espera, ocupação e exceções agregadas |
| Paciente | fornecer ou confirmar informação quando fizer parte do fluxo | perguntas adequadas ao canal e ao letramento |

Não está decidido se paciente, enfermeiro, recepcionista, secretário ou médico preenche
cada campo. Isso será descoberto antes da interface.

---

## 6. A decisão que o produto deve sustentar

O produto não devolve apenas “grave” ou “leve”. Ele deve permitir que o responsável
humano determine, separadamente:

| Eixo | Pergunta operacional | Exemplos de saída, não decisões fechadas |
|---|---|---|
| Prioridade de acesso | até quando este caso deve ser avaliado? | habitual, antecipado, revisão imediata |
| Esforço esperado | quanto trabalho a avaliação tende a exigir? | curto, padrão, ampliado |
| Recurso/modalidade | qual capacidade precisa ser reservada? | remoto, presencial, profissional/recurso específico |
| Prontidão da solicitação | pode ocupar vaga agora? | pronta, dado faltante, pendência clínica/administrativa |
| Confiança | o que sabemos e o que permanece incerto? | dado confirmado, autorrelato, divergência, ausente |

Os nomes finais, quantidades de classes, tempos e regras pertencem ao Analyst e ao dono
clínico. Nenhuma combinação será codificada apenas porque apareceu num PRD anterior.

### 6.1 Risco não é duração

Risco clínico e tempo provável de consulta podem se correlacionar, mas não são
sinônimos. A classificação ASA, por exemplo, não será usada como estimador único de
duração. O sistema deve preservar múltiplos eixos até que dados do HC justifiquem outra
decisão.

### 6.2 A decisão final é humana

O software pode organizar dados, apontar regras aprovadas, detectar ausências e sugerir
um perfil. A confirmação clínica, a aptidão anestésica e a conduta permanecem com o
profissional habilitado. Divergência humana deve ser possível, motivada e auditável.

---

## 7. Promessa por ator

| Papel | Valor a demonstrar |
|---|---|
| Solicitante | pedir avaliação sem reconstruir um prontuário inteiro e acompanhar pendências |
| Triagem | trabalhar casos incompletos e exceções, não transcrever tudo repetidamente |
| Anestesiologia | receber contexto organizado e dedicar atenção proporcional à necessidade |
| Agendamento | saber qual vaga procurar sem acessar detalhes clínicos desnecessários |
| Gestão | enxergar demanda por perfil e separar má alocação de falta real de capacidade |
| Paciente | ser encaminhado no momento e canal adequados, sem promessa clínica automática |

---

## 8. Escopo do hack

O hack entrega uma demonstração local, com dados exclusivamente sintéticos, de um fluxo
fechado:

1. criar ou importar uma solicitação sintética;
2. coletar os dados mínimos definidos pelo contrato aprovado;
3. mostrar risco, complexidade, pendências e incerteza sem esconder a origem;
4. permitir revisão humana;
5. traduzir a decisão revisada em requisito de vaga;
6. alocar ou propor uma vaga compatível numa agenda demonstrativa;
7. explicar por que o caso recebeu aquele tratamento;
8. mostrar quando nenhuma vaga compatível existe, sem fabricar capacidade.

### 8.1 O protótipo pode

- simular atores diferentes localmente;
- usar fixtures clínicas sintéticas;
- manter o primeiro boot offline;
- mostrar integrações futuras por contratos/mock declarados;
- reutilizar componentes e catálogos já existentes após auditoria.

### 8.2 O protótipo não pode fingir

- conexão real com PEP, SIRESP, agenda ou mapa cirúrgico;
- acesso ao cadastro real do HC;
- protocolo clínico aprovado pelo HCFMRP;
- tempos de slot ou classes de risco validados;
- redução de suspensão, fila ou exames sem baseline;
- produção hospitalar, segurança assistencial ou conformidade homologada;
- que o modo offline é a arquitetura final desejada pelo hospital.

---

## 9. Capacidades funcionais, sem prescrever telas

### C1 · Solicitação do caso

Representar paciente, procedimento proposto, origem, indicação e contexto temporal. O
contrato final depende do fluxo real e do identificador institucional disponível.

### C2 · Coleta estruturada

Coletar apenas os dados necessários às decisões aprovadas. Deve suportar origem do dado,
ausência, dúvida, contradição, recusa e preenchimento assistido.

### C3 · Perfil do procedimento

Relacionar o procedimento às condições específicas relevantes para triagem e agenda.
CID-10 e medicamentos não substituem um catálogo de procedimentos nem protocolos
pré-anestésicos por procedimento.

### C4 · Avaliação explicável

Aplicar regras clínicas somente quando houver fonte, versão, dono e teste. Toda sugestão
deve citar a entrada e a regra; dados ausentes devem virar pendência, nunca normalidade.

### C5 · Revisão humana

Permitir confirmar, corrigir ou rejeitar sugestões. O sistema precisa registrar ator,
momento, decisão, motivo e versão da regra.

### C6 · Tradução operacional

Converter a decisão revisada em propriedades que o agendamento consegue usar. Essa
tradução depende do que a agenda real suporta e não será inventada pelo frontend.

### C7 · Capacidade e agenda

Representar disponibilidade, duração, recurso, restrição e status suficientes para a
demonstração. A agenda deve recusar alocação incompatível e expor falta de capacidade.

### C8 · Auditoria

Preservar origem dos dados, decisões humanas e alterações. Informação clínica deve ser
visível apenas ao papel que realmente precisa dela.

---

## 10. Métricas honestas

### 10.1 Aceite do protótipo

- O conjunto de fixtures contém ao menos um **par de contraste controlado**: variar um
  eixo relevante aprovado produz obrigatoriamente `SchedulingRequirement` e tratamento
  operacional/capacidade distintos, conforme o oráculo.
- O conjunto contém também um **controle negativo**: casos operacionalmente equivalentes
  produzem o mesmo requisito, provando que a diferenciação não é arbitrária.
- Alterar o procedimento numa fixture cujo protocolo aprovado declare necessidades
  diferentes muda obrigatoriamente o requisito de vaga.
- Dados insuficientes produzem pendência, não uma classe otimista.
- O humano consegue divergir da sugestão e a divergência fica registrada.
- A agenda não coloca caso numa vaga incompatível.
- Quando não existe capacidade adequada, o sistema informa o gargalo.
- A demonstração distingue claramente dado real, fixture, regra aprovada e mock.

### 10.2 Métricas de piloto, bloqueadas por baseline

Tempo até CPA, espera por perfil, duração real, ocupação, remarcação, falta, pendências
descobertas tarde e suspensão cirúrgica só ganharão metas depois de definição e medição
com o HC. Este PRD proíbe metas percentuais inventadas.

---

## 11. Questões que bloqueiam o build

O [`ANALYST.md`](ANALYST.md) mantém a lista completa. As perguntas mínimas são:

1. Qual evento cria a solicitação e em qual sistema?
2. Quem vê a solicitação primeiro e quais campos estão disponíveis?
3. O que “agendado de forma semelhante” significa no trabalho real?
4. Em que momento risco e complexidade são conhecidos hoje?
5. Quem pode classificar, revisar e alocar?
6. “Um anestesiologista” significa um por ambulatório, turno, revisão ou outra coisa?
7. A cirurgia já tem data, janela ou nenhuma marcação?
8. Quais recursos e tipos de vaga existem de fato?
9. Quais regras clínicas e de procedimento já são institucionais?
10. Quais dados podem entrar num protótipo e quais integrações são apenas simuladas?

Sem isso, o Analyst deve manter o veredito **NO-GO** para as minispecs de construção.

---

## 12. Decisões anteriores invalidadas

Não são mais leis do produto:

- paciente como identificador descartável;
- ausência obrigatória de histórico;
- quatro telas fixas;
- fila por urgência mais minutos de espera;
- jornada de recepção com hub;
- offline como requisito institucional;
- classificação em quatro cores;
- liberação assíncrona, teleconsulta e ambulatório de alto risco como rotas presumidas;
- ASA presumido ou qualquer score como motor já aprovado;
- paciente preenchendo por WhatsApp;
- enfermeiro como triador obrigatório;
- integração FHIR como fato.

O código que implementa ou prepara essas ideias é material provisório. Pode ser
reaproveitado depois da análise, mas não prova requisito.

---

## 13. Fontes e peso da evidência

| Fonte | O que sustenta | Peso |
|---|---|---|
| Briefing Hacka Health 2026, Desafio 1, p. 5 | problema declarado e possibilidades de solução | primária, insuficiente para fluxo |
| [Edital HCRP nº 11/2026, p. 26](https://extranet.hcrp.usp.br/novorh/arquivos/3432/E34322332026104736.pdf) | existência do ambulatório e atribuições do cargo | primária institucional |
| [Carta de Serviços do HCFMRP](https://cartaservicos.hcrp.usp.br/) | natureza agendada do atendimento ambulatorial e registro institucional | primária institucional |
| [Resolução CFM nº 2.174/2017](https://sistemas.cfm.org.br/normas/visualizar/resolucoes/BR/2017/2174) | responsabilidade e momento da avaliação pré-anestésica | normativa |
| [Seleção de Ortopedia FAEPA 130/2025](https://extranet2.hcrp.usp.br/novorh/arquivos/3126/E31264720251047.pdf) | mostra que a frase de priorização é institucional e não exclusiva da anestesia | controle contra sobreinterpretação |
| [Dexter et al., 2012](https://pubmed.ncbi.nlm.nih.gov/22190552/) | duração pode ser prevista por dados anteriores; ASA isolado não basta | literatura externa, não prova local |

---

## 14. Estrutura de execução

O trabalho está limitado a três minispecs:

1. [`001-contrato-operacional`](minispecs/001-contrato-operacional/spec.md) — fechar a
   verdade do fluxo, atores, dados e decisão;
2. [`002-triagem-decisao-humana`](minispecs/002-triagem-decisao-humana/spec.md) — construir
   coleta, avaliação explicável e revisão humana aprovadas;
3. [`003-agenda-diferenciada-demo`](minispecs/003-agenda-diferenciada-demo/spec.md) —
   traduzir a decisão para capacidade e provar o fluxo end-to-end.

O plano mestre está em [`BUILD.md`](BUILD.md), e cada minispec possui exatamente um
`spec.md` e um `writing-plan.md`.
