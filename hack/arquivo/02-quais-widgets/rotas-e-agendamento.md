# Rotas de agendamento e regra de suspensão — triagem pré-anestésica

## State

- Source: Desafio 1 oficial do Hacka Health 2026 + pesquisa clínica/operacional + revisão do fluxo atual do Antessala
- Branch: `zan/widgets`
- Escopo: somente especificação; sem código, tela ou alteração de `analysis.md`
- Confidence: **high** na separação conceitual das rotas; **média** nos limiares locais até validação com a Anestesiologia do HCFMRP-USP

---

## 0. O que o desafio realmente pede

O desafio oficial não diz que o problema é a ordem de chamada na cadeira. Diz que **pacientes com diferentes níveis de risco e complexidade são agendados de forma semelhante**, sobrecarregando equipes e infraestrutura, e pede classificação de risco baseada em dados, priorização pela complexidade e conexão entre triagem, agendamento da consulta e planejamento cirúrgico.

Portanto, a pergunta do Antessala é:

> **Que tipo de avaliação pré-anestésica este paciente precisa, com que antecedência e com que nível de aprofundamento?**

Não é:

> “Qual cirurgia é mais urgente?”

A urgência/prioridade cirúrgica vem do processo cirúrgico de montante. O Antessala a recebe como contexto; não a inventa a partir da anamnese.

### Três hipóteses que precisam ser tratadas como hipóteses até validação no HC

1. “Todos recebem exatamente o mesmo tempo de consulta” — o desafio fala em **agendamento semelhante**, não prova duração idêntica de slot.
2. “O enfermeiro é sempre quem coleta” — é uma arquitetura plausível e comum em pré-avaliação, mas o ator local deve ser confirmado.
3. “Todo caso complexo descoberto tarde vira cirurgia suspensa” — há evidência local de suspensões por causas clínicas e preparo inadequado, mas não é correto atribuir toda suspensão ao fluxo pré-anestésico.

---

# 1. Rotas de avaliação pré-anestésica

A recomendação é **quatro rotas operacionais**, sendo três para eletivos e uma de bypass para urgência/emergência.

## Rota A — FAST TRACK / consulta simplificada

**Objetivo:** reservar menos tempo assistencial para paciente de baixa complexidade, sem eliminar a avaliação médica exigida pelo protocolo institucional.

Candidato somente quando **todos** os critérios de baixo risco estiverem presentes:

- procedimento eletivo de baixo risco/porte conforme tabela institucional;
- nenhuma condição clínica ativa importante;
- nenhuma comorbidade descompensada;
- boa capacidade funcional;
- sem medicação que exija plano perioperatório complexo;
- sem história de complicação anestésica relevante ou via aérea difícil conhecida;
- sem doença aguda recente importante;
- dados essenciais completos.

`ASA provável I–II` pode reforçar a candidatura, mas **não decide a rota sozinho**. ASA final pertence ao anestesiologista.

Saída sugerida:

```text
ROTA: FAST TRACK
ANTECEDÊNCIA: rotina / menor antecedência entre os eletivos
DURAÇÃO: slot curto conforme protocolo local
MOTIVO: baixa complexidade + ausência de red flags
```

---

## Rota B — PADRÃO / consulta completa

**Objetivo:** paciente eletivo estável que exige avaliação convencional, mas não apresenta achado que justifique otimização antecipada.

Exemplos:

- hipertensão/diabetes controlados;
- obesidade sem outra descompensação importante;
- apneia do sono conhecida e estável;
- comorbidade crônica estável;
- procedimento intermediário;
- capacidade funcional aceitável;
- ausência de red flags.

Saída sugerida:

```text
ROTA: PADRÃO
ANTECEDÊNCIA: agenda convencional
DURAÇÃO: slot completo
MOTIVO: comorbidade estável / complexidade intermediária
```

---

## Rota C — ANTECIPADA / OTIMIZAÇÃO

**Objetivo:** dar tempo para o anestesiologista avaliar cedo, pedir exames/avaliações adicionais quando indicados e permitir correção de problemas antes da data cirúrgica.

**Importante:** não modelar como “só consulta depois do cardiologista”. O fluxo mais seguro é o contrário: **avaliação anestésica precoce → identifica o que precisa de otimização/referral → cirurgia só segue quando a pendência estiver resolvida**.

Entram aqui pacientes com qualquer hard trigger relevante, por exemplo:

- dor torácica/angina, dispneia em repouso ou progressiva, síncope inexplicada;
- doença cardiovascular instável ou evento cardiovascular recente;
- baixa capacidade funcional com cirurgia de risco elevado ou doença cardiovascular relevante;
- DPOC/asma importante, oxigênio domiciliar ou exacerbação respiratória recente;
- insuficiência renal/hepática avançada, coagulopatia ou outra doença sistêmica grave;
- anticoagulante/antiagregante com necessidade de plano individualizado;
- SGLT2 em uso quando a cirurgia está próxima demais para a janela de suspensão recomendada;
- história de intubação/ventilação difícil, anafilaxia perioperatória ou hipertermia maligna;
- infecção ativa/doença aguda recente;
- necessidade prevista de UTI ou cirurgia de grande porte/alta complexidade;
- informação crítica faltante quando a cirurgia está próxima.

Saída sugerida:

```text
ROTA: ANTECIPADA / OTIMIZAÇÃO
ANTECEDÊNCIA: a maior possível antes da cirurgia
DURAÇÃO: slot ampliado
MOTIVO: [achados estruturados]
PENDÊNCIAS: [lista]
```

---

## Rota D — URGÊNCIA / EMERGÊNCIA

Não é uma quarta “classe de risco anestésico”. É um **bypass do agendamento ambulatorial eletivo**.

Se o encaminhamento cirúrgico já informa urgência/emergência, o Antessala não tenta transformar isso em Fast Track/Padrão. O fluxo deve apenas destacar a condição e encaminhar para avaliação compatível com a urgência clínica e o processo institucional.

```text
ROTA: URGÊNCIA/EMERGÊNCIA
ORIGEM: prioridade cirúrgica recebida do encaminhamento
AÇÃO: bypass do agendamento eletivo
```

---

## Modalidade remota não é uma rota de risco

Não criar “teleconsulta” como quarta classe de risco. **Modalidade** deve ser dimensão separada:

```text
modalidade = presencial | teleconsulta | híbrida
```

A telemedicina é permitida no Brasil, mas a consulta presencial permanece referência e o médico pode exigir exame presencial quando necessário. Para pacientes selecionados de baixo risco, o hospital pode adotar pré-screening digital/teleconsulta/híbrido, desde que validado pelo protocolo local e sem fingir que exame físico foi realizado a distância.

---

# 2. Régua de roteamento

A v1 deve usar **regras hierárquicas / hard triggers**, não score arbitrário.

## Regra 1 — urgência cirúrgica vem de montante

```text
encaminhamento.urgenciaCirurgica != ELETIVA
    → ROTA D
```

O Antessala não deriva urgência cirúrgica da anamnese.

## Regra 2 — qualquer hard trigger clínico exclui Fast Track

| Achado estruturado | Rota mínima | Por quê |
|---|---|---|
| dor torácica/angina atual | C | pode exigir investigação/otimização cardiovascular |
| dispneia em repouso ou piora recente | C | possível doença cardiopulmonar descompensada |
| síncope inexplicada | C | exige avaliação etiológica |
| insuficiência cardíaca/valvopatia grave ou instável | C | maior risco perioperatório |
| evento cardiovascular recente / stent recente | C | timing e manejo dependem de avaliação especializada |
| capacidade funcional baixa + cirurgia de maior risco | C | pode justificar avaliação cardiovascular adicional |
| DPOC/asma descompensada, oxigênio domiciliar, exacerbação recente | C | risco respiratório aumentado |
| anticoagulante/antiagregante com necessidade de interrupção | C | plano depende de fármaco, rim, sangramento e trombose |
| SGLT2 com cirurgia em <3–4 dias | C | janela perioperatória pode estar inadequada |
| complicação anestésica grave prévia / via aérea difícil conhecida | C | exige planejamento anestésico antecipado |
| infecção/doença aguda ativa | C | pode exigir adiamento/otimização |
| doença renal/hepática avançada/coagulopatia | C | planejamento e exames individualizados |
| cirurgia grande/complexa ou UTI prevista | B ou C por protocolo | maior demanda de planejamento |
| dado crítico faltante perto da cirurgia | C | evita descoberta tardia no dia do procedimento |

## Regra 3 — Fast Track exige combinação de baixo risco

Fast Track só é recomendado se **todos** forem verdadeiros:

- cirurgia eletiva;
- procedimento baixo risco/porte segundo protocolo local;
- sem hard trigger;
- comorbidades ausentes ou leves e controladas;
- boa capacidade funcional;
- sem plano medicamentoso complexo;
- sem complicação anestésica prévia importante;
- sem doença aguda recente;
- informação essencial completa.

## Regra 4 — se não é Fast Track nem C, é B

Paciente estável com comorbidades controladas ou complexidade intermediária → Rota B.

---

# 3. O que pode suspender/adiar cirurgia se descoberto tarde

## Dado local do HCFMRP-USP

O hospital reportou, em 2023, taxa de suspensão de 22,48%. Entre os motivos registrados estavam:

- causas clínicas do paciente: deterioração do estado geral que impede o procedimento;
- jejum inadequado, atraso/falta e outras causas não clínicas do paciente;
- erro de agendamento, inclusive ausência de solicitação/reserva de materiais;
- ausência de leito, equipamento ou material;
- troca por urgência.

No levantamento da Central de Agendamentos, causas clínicas representaram 18,62% das suspensões; erros de agenda 19,35%; desistência/falta 24,03%. Os autores ainda agruparam erros de agenda + orientação ineficaz em 43,38% das suspensões. Isso **não significa que o Antessala eliminará esses percentuais**, mas prova que detectar/preparar cedo tem valor operacional real.

## Lista clínica/medicamentosa para o Antessala

A saída do sistema deve ser “**risco de adiamento se não resolvido**”, e não “cirurgia automaticamente cancelada”.

| Achado | Antecedência útil | Regra segura para o produto |
|---|---:|---|
| **SGLT2** (dapagliflozina, empagliflozina etc.) | **3–4 dias** | guideline AHA/ACC recomenda suspensão 3–4 dias antes de cirurgia planejada; se descoberto dentro da janela, escalar para avaliação |
| **Varfarina**, quando interrupção for indicada | geralmente **5 dias** | não auto-suspender; plano depende de INR e risco trombótico/hemorrágico |
| **DOAC** (apixabana, rivaroxabana, dabigatrana, edoxabana) | tipicamente **1–4 dias**, dependendo do fármaco, função renal e risco hemorrágico | não usar um único “X dias”; gerar pendência de plano individualizado |
| **Antiagregante / stent coronariano recente** | pode exigir planejamento com muita antecedência | nunca auto-suspender; timing da cirurgia e terapia antiplaquetária dependem do tipo/data de PCI e risco |
| **GLP-1** (semaglutida, tirzepatida etc.) | **não há regra universal de suspender** | orientação atual: maioria pode continuar; alto risco gastrointestinal pode exigir dieta líquida 24 h e/ou adiamento até resolução de sintomas/fase de escalada |
| **infecção respiratória ativa / exacerbação pulmonar** | variável | sem número universal; avaliar resolução clínica e risco do procedimento |
| **dor torácica, IC descompensada, arritmia instável, síncope** | quanto antes | pode justificar pausa de cirurgia eletiva para avaliação/otimização; sem prazo universal |
| **hipertensão/diabetes muito descompensados, cetoacidose, anemia/coagulopatia relevante** | variável | otimização clínica; limiares e prazo devem ser locais |
| **exame “vencido”** | depende do exame/procedimento | não hardcodar validade universal; protocolo do HC decide se precisa repetir |
| **jejum inadequado** | confirmação próxima ao procedimento | prevenção operacional: orientação antecipada + confirmação/rechecagem perto da cirurgia |

### Regra de produto

Nunca gerar instrução do tipo:

```text
“Suspenda apixabana por 2 dias.”
```

Gerar:

```text
PENDÊNCIA: manejo perioperatório de anticoagulante
MOTIVO: apixabana em uso
ANTECEDÊNCIA: necessita plano antes da cirurgia
AÇÃO: revisão por anestesiologia/protocolo institucional
```

A única exceção útil para uma régua de antecedência explícita no MVP é quando há consenso atual claro e simples, como **SGLT2 = 3–4 dias**. Mesmo assim, a conduta final é clínica.

---

# 4. Sinais vitais no básico

## Decisão

**Não remover todos. Mudar o papel deles.**

Se a triagem for presencial e conduzida por enfermagem/profissional de saúde:

- **Pressão arterial:** manter no básico. Ajuda a identificar hipertensão/descompensação e é um dado objetivo barato.
- **Frequência cardíaca:** manter como baseline quando aferida.
- **SpO₂:** recomendada como condicional ou padrão em paciente respiratório/alta complexidade.
- **Temperatura:** não precisa ser obrigatória universalmente; usar quando houver febre, infecção/doença aguda ou triagem próxima da cirurgia.

Se o formulário for preenchido remotamente pelo paciente:

- não obrigar sinais vitais sem fonte confiável;
- `ausente` é diferente de `normal`;
- a rota deve continuar baseada principalmente em história, comorbidades, medicações, sintomas, capacidade funcional e procedimento.

**Sinais vitais ajudam a confirmar risco; não devem ser o motor único do roteamento.**

---

# 5. Quem usa o sistema

A proposta operacional pode ser:

1. **Paciente / profissional de triagem** completa os dados estruturados.
2. **Antessala** gera: rota recomendada, fatores que justificam a rota, pendências e antecedência necessária.
3. **Equipe de agendamento/pré-anestesia** usa a recomendação no sistema institucional existente.
4. **Anestesiologista** recebe o caso estruturado e mantém decisão clínica final.
5. **Cirurgião/equipe cirúrgica** pode visualizar pendências relevantes para planejamento, mas não depende de integração com agenda/sala no MVP.

Não prometer integração com CAC, PSI, agenda, reserva de sala ou prontuário no hackathon. O produto entrega **recomendação operacional explicável**.

---

# 6. As duas perguntas que valem mais que nossa suposição

Perguntar diretamente à Anestesiologia / Pré-Anestésico do HCFMRP-USP:

1. **Hoje, como é decidido o tipo, a duração e a antecedência da consulta pré-anestésica de cada paciente? Existem slots/rotas diferentes ou pacientes de risco e complexidade distintos entram essencialmente na mesma agenda?**
2. **Para pacientes eletivos de baixo risco, o serviço aceitaria um fluxo simplificado — presencial curto, híbrido ou telemedicina — desde que a avaliação médica e os requisitos de segurança permaneçam atendidos?**

Pergunta bônus, se houver 30 segundos:

3. **Quais são hoje os três achados mais frequentes descobertos tarde na avaliação pré-anestésica que obrigam adiar, complementar ou cancelar uma cirurgia?**

Essa resposta local deve substituir nossas hipóteses no pitch sempre que possível.

---

# 7. Frase de produto revisada

> **A Antessala transforma a anamnese estruturada em uma recomendação explicável de rota e antecedência pré-anestésica: Fast Track, Padrão ou Avaliação Antecipada/Otimização. A urgência cirúrgica vem do processo assistencial; a decisão anestésica continua com o anestesiologista.**

---

# 8. Fontes de referência usadas nesta análise

- Hacka Health 2026 — Desafio 1 oficial: triagem digital e classificação de risco em consulta pré-anestésica.
- CFM, Resolução nº 2.174/2017 — consulta/avaliação pré-anestésica e responsabilidade do anestesiologista.
- CFM, Resolução nº 2.314/2022 — telemedicina, teleconsulta e necessidade de presencial quando clinicamente indicada.
- NHS England, *Early screening, triaging, risk assessment and health optimisation in perioperative pathways* (atualizado em 2025) — triagem precoce, rotas low/intermediate/high risk, digital pre-assessment e prevenção de cancelamentos evitáveis.
- NICE NG45 — testes pré-operatórios conforme ASA, comorbidade e porte cirúrgico; planos individualizados para anticoagulantes.
- AHA/ACC 2024 — avaliação cardiovascular perioperatória e suspensão de SGLT2 3–4 dias antes de cirurgia planejada.
- ACC/AHA/HRS 2023 — interrupção perioperatória de anticoagulantes conforme fármaco, função renal e risco de sangramento.
- ASA/multissociedades 2024 — manejo perioperatório de GLP-1; maioria continua tratamento, com estratégia individualizada para maior risco gastrointestinal.
- HCFMRP-USP, Revista Qualidade HC — Central de Agendamentos Cirúrgicos: causas de suspensão/cancelamento e impacto da antecipação/centralização.
