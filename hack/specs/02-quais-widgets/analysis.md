# Analyst: catálogo de widgets e templates da triagem pré-anestésica

## State

- Source: levantamento do Zan + contrato atual do Antessala + inventário do DietFlow (13/08/2026)
- Route: `analyst → build → execute`
- Confidence: **high** na arquitetura dos blocos · **média** nos detalhes clínicos até validação com Anestesiologia do HCFMRP-USP
- Verdict: **ready for build** do catálogo e dos templates

---

## TL;DR

A tela de anamnese deve ser um **catálogo de blocos estruturados**, não um formulário fixo. O DietFlow já entrega 8 blocos e, principalmente, o contrato de widget, o drawer de composição e o conceito de templates. Alguns entram quase diretos; outros servem como casco e precisam trocar a semântica. O restante é específico de perioperatório/anestesia.

Duas leis são invariantes:

1. **Não existe cadastro de paciente.** Cada atendimento cria um `Registro` novo, com ID local e descartável. Nome repetido é permitido.
2. **Não existe evolução da anamnese.** Nada procura, compara ou reutiliza anamnese anterior da mesma pessoa. “Histórico cirúrgico/anestésico” significa antecedentes relatados **neste atendimento**.

A saída do formulário também não é “apto / inapto”. O sistema estrutura informação, destaca sinais e pendências e entrega um resumo ao especialista. A decisão anestésica é humana.

---

# 1. Blocos que a triagem pré-anestésica precisa ter

| # | ID sugerido | Bloco | O que captura | Básico? | Origem |
|---|---|---|---|---|---|
| 1 | `preop.contexto-cirurgico` | Cirurgia / procedimento | procedimento, especialidade, porte conforme protocolo, caráter, anestesia prevista se conhecida, internação/UTI se conhecidas | sim | novo |
| 2 | `df.problemas-saude` | Problemas de saúde | doenças conhecidas, diagnóstico codificado, controle atual | sim | DietFlow |
| 3 | `df.medicacoes` | Medicações em uso | nome, dose, frequência, via, motivo e última dose quando relevante | sim | DietFlow |
| 4 | `preop.alergias` | Alergias | medicamento, látex, adesivo, contraste, alimento/outro; reação e gravidade | sim | novo |
| 5 | `preop.cardiovascular` | Coração e circulação | dor torácica, dispneia, ortopneia, palpitação, síncope, infarto, IC, arritmia, valvopatia, stent, bypass, marcapasso/CDI | sim/compacto | novo |
| 6 | `preop.respiratorio` | Respiratório | falta de ar, tosse, chiado, asma/DPOC, infecção respiratória recente, oxigênio | sim/compacto | novo |
| 7 | `df.sono` | Sono | bloco já existente no DietFlow | não sozinho | DietFlow |
| 8 | `preop.apneia-sono` | Apneia / STOP-Bang | ronco, cansaço, apneia observada, hipertensão, diagnóstico conhecido, CPAP/BiPAP | condicional | novo |
| 9 | `preop.capacidade-funcional` | Capacidade funcional | caminhada, escadas, esforço e limitações; usa base de atividades/METs já extraída | sim | novo |
| 10 | `df.rotina-alimentar` | Rotina alimentar | padrão alimentar quando o procedimento justificar | não | DietFlow |
| 11 | `df.hidratacao` | Hidratação | ingestão hídrica | não | DietFlow |
| 12 | `df.bristol` | Bristol / hábito intestinal | padrão intestinal | não | DietFlow |
| 13 | `preop.digestivo-aspiracao` | Digestivo / aspiração | refluxo, regurgitação, disfagia, vômitos, úlcera, gastroparesia | condicional | novo |
| 14 | `preop.historico-anestesico` | Cirurgias/anestesias anteriores | cirurgia/ano, tipo de anestesia, intubação/ventilação difícil, NVPO grave, despertar prolongado, reação, hipertermia maligna, história familiar | sim | novo |
| 15 | `preop.via-aerea-autorreferida` | Via aérea autorreferida | dificuldade de abrir boca/mover pescoço, prótese, dente solto, aparelho, cirurgia/radioterapia de cabeça/pescoço | condicional | novo |
| 16 | `preop.sangramento-trombose` | Sangramento e trombose | sangramento fácil, hematomas, sangramento em cirurgia/dentista, transfusão, TVP/TEP, história familiar | sim/compacto | novo |
| 17 | `preop.habitos-substancias` | Tabaco, álcool e outras substâncias | nunca/ex/atual, quantidade/tempo, álcool, outras substâncias | condicional | novo |
| 18 | `preop.mudanca-clinica-recente` | Mudança recente de saúde | febre, gripe/pneumonia, infecção, PS, internação, antibiótico, nova doença/piora | sim | novo |
| 19 | `preop.condicoes-especiais` | Condições especiais | gestação quando aplicável, tireoide, epilepsia, neuromuscular, cognição/comunicação | condicional | novo |
| 20 | `preop.exames` | Exames existentes | exame, data, resultado estruturado, disponível/ausente/validade a confirmar | por template | novo |
| 21 | `df.adesao` | Adesão ao preparo | reaproveitar o bloco para jejum/orientações/medicações/transporte perto do procedimento | não no básico inicial | DietFlow adaptado |
| 22 | `preop.logistica-comunicacao` | Logística e comunicação | cidade, deslocamento, transporte, curto aviso, acompanhante, contato, barreira de comunicação | sim | novo |
| 23 | `df.observacoes-gerais` | Observações gerais | texto livre final: algo importante não perguntado | sim | DietFlow |

## O que fica fora da auto/triagem

Não pedir ao paciente para autoexaminar o que é avaliação profissional:

- Mallampati;
- abertura bucal medida;
- distância tireomentoniana;
- exame físico cardiovascular/respiratório;
- classificação ASA final;
- estratégia anestésica;
- decisão “apto / inapto”;
- suspensão/liberação de medicamento como decisão automática;
- escolha automática de especialista de destino.

O sistema pode mostrar **sinais de atenção e pendências**, nunca fingir que realizou exame físico ou tomou decisão anestésica.

---

# 2. Os 8 widgets que o DietFlow já tem

| Widget DietFlow | Uso no Antessala | Decisão |
|---|---|---|
| Rotina alimentar | útil em casos/procedimentos selecionados | trazer, opcional por template |
| Hidratação | útil em preparo e casos selecionados | trazer, opcional |
| Sono | boa base, mas não cobre apneia sozinho | trazer + complementar |
| Bristol / hábito intestinal | relevante só em alguns fluxos | trazer, opcional |
| Problemas de saúde | núcleo do produto; já tem código de diagnóstico | trazer quase direto |
| Medicações | núcleo do produto; já tem base de medicamentos | trazer quase direto e ampliar metadados perioperatórios |
| Adesão | casco serve; “adesão à dieta” não | reutilizar como **adesão ao preparo** |
| Observações gerais | campo livre de segurança | trazer direto |

### Regra de migração

O DietFlow usa HeroUI e o Antessala usa shadcn/ui. Portanto, atravessam **tipos, schema, validação, registro, `renderToText`, defaults e lógica**. O visual deve ser refeito em shadcn/ui.

---

# 3. Widgets novos e o que perguntam

## `preop.contexto-cirurgico`
Procedimento, especialidade, porte/complexidade somente se houver protocolo institucional, eletivo/urgência quando essa informação vier do processo, anestesia prevista, internação e UTI se conhecidas.

## `preop.alergias`
Tem alergia? Tipo (medicamento, látex, adesivo, contraste, alimento, outro), agente, reação e gravidade relatada.

## `preop.cardiovascular`
Dor/pressão no peito, dispneia aos esforços/repouso, ortopneia, palpitações, síncope, infarto e data, insuficiência cardíaca, arritmia, valvopatia, stent, revascularização, marcapasso/CDI.

## `preop.respiratorio`
Falta de ar, tosse, chiado, asma/DPOC, infecção respiratória recente, internação pulmonar recente e oxigênio.

## `preop.apneia-sono`
Perguntas estruturadas de rastreio conforme protocolo validado; diagnóstico de apneia, CPAP/BiPAP e adesão.

## `preop.capacidade-funcional`
Banho/vestir-se, caminhada, quarteirões, escadas, esforço moderado, limitação por dor/falta de ar/fadiga e auxílio de marcha. Preferir a base de METs já extraída.

## `preop.digestivo-aspiracao`
Refluxo/azia, regurgitação, disfagia, vômitos, úlcera, gastroparesia e cirurgia digestiva relevante.

## `preop.historico-anestesico`
Cirurgias anteriores, ano, tipo de anestesia se souber, intubação/ventilação difícil, NVPO importante, despertar prolongado, reação, hipertermia maligna e história familiar.

## `preop.via-aerea-autorreferida`
Dificuldade de abrir boca/mover pescoço, dente solto, prótese, aparelho e cirurgia/radioterapia de cabeça/pescoço. Mallampati e medidas ficam fora.

## `preop.sangramento-trombose`
Sangramento fácil, hematomas, sangramento excessivo após cirurgia/dentista, transfusão, TVP, TEP, coagulopatia e história familiar.

## `preop.habitos-substancias`
Tabaco (nunca/ex/atual, quantidade e tempo), álcool por frequência/quantidade e outras substâncias com opção “prefiro não responder”.

## `preop.mudanca-clinica-recente`
Desde a indicação: febre, gripe/pneumonia, infecção, pronto-socorro, internação, antibiótico, nova doença ou piora.

## `preop.condicoes-especiais`
Gestação quando aplicável, tireoide, epilepsia/última crise, doença neuromuscular, cognição, audição/visão e necessidade de cuidador/responsável.

## `preop.exames`
Exames existentes, data, resultado estruturado quando disponível e status `disponivel_atual`, `disponivel_validade_a_confirmar` ou `ausente`. **Não decide sozinho se exame é necessário ou válido.**

## `preop.logistica-comunicacao`
Cidade, tempo de deslocamento, transporte, dependência de transporte municipal, curto aviso, acompanhante, telefone/WhatsApp, videochamada se usada, dificuldade de compreensão/comunicação e contato alternativo deste atendimento.

---

# 4. Templates

## `BÁSICO`

1. `preop.contexto-cirurgico` — required
2. `df.problemas-saude` — required
3. `df.medicacoes` — required
4. `preop.alergias` — required
5. `preop.cardiovascular` — required/compact
6. `preop.respiratorio` — required/compact
7. `preop.capacidade-funcional` — required/compact
8. `preop.historico-anestesico` — required/compact
9. `preop.sangramento-trombose` — required/compact
10. `preop.mudanca-clinica-recente` — required
11. `preop.logistica-comunicacao` — required/compact
12. `df.observacoes-gerais` — required

**Progressive disclosure:** resposta positiva abre detalhes; negativa mantém o bloco curto.

## `PRÉ-OPERATÓRIO X` — simplificado/ambulatorial

Todo o `BÁSICO` + `df.sono`, `preop.apneia-sono` compacto/condicional, `preop.via-aerea-autorreferida`, `preop.exames` compacto e `df.adesao` como preparo se o atendimento ocorrer perto da cirurgia. Opcionais: hidratação, rotina alimentar e Bristol.

Objetivo: reconhecer rapidamente um caso simples **ou perceber que ele não é simples** e precisa de aprofundamento.

## `PRÉ-OPERATÓRIO Y` — ampliado/maior complexidade

Todo o `BÁSICO` + sono, apneia full, via aérea full, digestivo/aspiração, hábitos/substâncias, condições especiais, exames full, hidratação e adesão ao preparo. Rotina alimentar e Bristol entram por procedimento/linha de cuidado.

## `PULSEIRA / ID RÁPIDO`

Não é anamnese completa. Serve para colocar a pessoa no fluxo em segundos e gerar o ID descartável.

Tela 1 já tem: nome, sexo, idade, plano, `registro.id` local e horário automático.

Widgets mínimos:

1. `preop.contexto-cirurgico` compacto;
2. `df.observacoes-gerais` opcional.

**Não carregar o template BÁSICO na recepção.** Se a pessoa seguir para triagem clínica, o mesmo registro muda de estado para `anamnese em andamento` e recebe o template clínico escolhido.

---

# 5. Matriz de templates

Legenda: `R` obrigatório · `O` opcional/condicional · `—` não entra.

| Bloco | Básico | Pré-op X | Pré-op Y | Pulseira/ID |
|---|:---:|:---:|:---:|:---:|
| Contexto cirúrgico | R | R | R | R compacto |
| Problemas de saúde | R | R | R | — |
| Medicações | R | R | R | — |
| Alergias | R | R | R | — |
| Cardiovascular | R compacto | R compacto | R full/cond. | — |
| Respiratório | R compacto | R compacto | R full/cond. | — |
| Sono | — | O | R | — |
| Apneia/STOP-Bang | — | O | R/cond. | — |
| Capacidade funcional | R compacto | R | R | — |
| Rotina alimentar | — | O | O | — |
| Hidratação | — | O | O/R por protocolo | — |
| Bristol | — | O | O | — |
| Digestivo/aspiração | — | O por sinal | R/cond. | — |
| Histórico anestésico | R compacto | R | R full | — |
| Via aérea autorreferida | — | R | R | — |
| Sangramento/trombose | R compacto | R | R | — |
| Hábitos/substâncias | — | O | R/cond. | — |
| Mudança clínica recente | R | R | R | — |
| Condições especiais | — | O | R/cond. | — |
| Exames | — | O compacto | R/cond. | — |
| Adesão ao preparo | — | O | R quando perto da cirurgia | — |
| Logística/comunicação | R compacto | R | R | — |
| Observações gerais | R | R | R | O |

---

# 6. Urgência e contrato com a fila

Para a primeira versão:

- `urgencia` é **campo explícito da triagem**, obrigatório antes de finalizar;
- widgets podem produzir `sinaisDeAtencao[]` e `pendencias[]`;
- sinais pedem revisão, mas não sobrescrevem automaticamente `urgencia`;
- a régua de urgência deve ser validada pelo hospital.

```ts
interface QueueInput {
  registroId: string
  urgencia: Urgencia
  entrouNaFilaEm: string
  estadoAtual: JornadaEstado
}
```

A fila faz somente o que a spec manda: **ordenar urgência + espera**. Não diagnostica e não escolhe especialista.

---

# 7. Saída para o resumo do especialista

Cada widget deve gerar texto curto. O agregador organiza:

```text
SINAIS DE ATENÇÃO
- histórico de dificuldade de intubação relatado
- dor torácica aos esforços relatada

PENDÊNCIAS
- exame informado sem data
- transporte ainda não confirmado

DADOS RELEVANTES
- diabetes tipo 2
- medicações: ...
- capacidade funcional: ...

SEM ALTERAÇÕES RELATADAS
- alergias
- sangramento/trombose
```

**Não exibir “apto”, “inapto” ou “liberado” calculado pelo formulário.**

---

# 8. Jejum e rechecagem perto da cirurgia

Jejum é dado temporal. Numa anamnese feita semanas antes, registrar apenas que as orientações foram recebidas. Se o Antessala for usado no dia/próximo da cirurgia, o template pode acrescentar rechecagem atual: última ingestão sólida, líquido claro, horário, medicações e mudança clínica. Isso continua pertencendo somente ao registro atual, sem evolução longitudinal.

---

# 9. Pendências antes de virar protocolo clínico

1. Nomes/categorias finais dos templates X/Y.
2. Perguntas obrigatórias dos blocos cardiovascular e respiratório.
3. Instrumento oficial de rastreio de apneia e critérios.
4. Atividades/METs da versão curta de capacidade funcional.
5. Regras locais para exames, validade e critérios.
6. Enum/régua de `urgencia` da triagem.
7. Em quais fluxos ocorre rechecagem de preparo/jejum.

---

## Grill Verdict

- **Verdict:** ready for build.
- **Why:** o catálogo separa o que já existe no DietFlow, o que precisa ser criado, o que entra em cada template e o que pertence à decisão profissional. Os invariantes de **ID descartável** e **zero evolução** permanecem intactos.
- **Next stage:** migrar os 8 contratos do DietFlow e construir primeiro os blocos do template `BÁSICO`, deixando X/Y como composição sobre a mesma base.
