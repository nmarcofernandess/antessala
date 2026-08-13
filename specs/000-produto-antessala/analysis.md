# Analyst: Antessala — triagem pré-anestésica

## State

- Source: definição do Marco (13/08/2026), HackaHelpth
- Route: `analyst → build → execute`
- Confidence: **high** no produto · **aberto** no motor de fila (vai para o Codex)
- Verdict: ready for build

---

## TL;DR

App de mesa **autocontido**: sem servidor, sem banco online, sem login. O paciente **não
é cadastrado** — é um identificador descartável (nome, sexo, idade, plano). Passa por
uma anamnese de widgets, entra numa **fila ordenada por urgência e tempo de espera**, e
o especialista abre o resumo e marca a jornada. **Quatro telas. Zero evolução.**

---

## A decisão que define tudo: o paciente é um ID descartável

Não existe prontuário, histórico nem "paciente já cadastrado". Cada entrada é um
registro novo e independente — exatamente como o cadastro de exames do DietFlow, onde
existem várias "glicose" e cada uma é um id próprio, sem o sistema reclamar de duplicata.

**Consequências diretas:**

- Não há busca de paciente existente, nem merge, nem deduplicação.
- Não há evolução, série temporal nem comparação entre atendimentos. **De forma alguma.**
- O mesmo nome pode aparecer duas vezes na fila. Isso é aceito, não é erro.
- O que dá identidade ao registro é o **momento em que ele entrou na fila**.

---

## Story de Usuário

A recepção cria a entrada com quatro campos e clica em adicionar. A triagem preenche a
anamnese com os widgets que o hospital usa. Ao finalizar, o registro entra na fila.

O especialista olha o painel e vê **quem é o próximo** — não uma lista alfabética, e sim
a ordem real, combinando urgência clínica com o tempo que a pessoa está esperando. Ele
abre o registro, lê o resumo pronto, atende e marca a jornada.

## Story Técnica

Persistir cada registro localmente (banco embarcado que já vem no casco), com estado de
jornada e carimbo de tempo em cada transição. A ordenação da fila é uma **função pura**
sobre `(urgência, entrada na fila, estado atual)` — isolada do resto, porque é a peça
que o Codex vai construir e ajustar sozinha.

---

## As quatro telas

| # | Tela | O que faz | O que **não** faz |
|---|---|---|---|
| 1 | **Entrada** | Nome, sexo, idade, plano de saúde. Botão adicionar → abre a anamnese. | Não busca paciente existente. Não valida duplicata. |
| 2 | **Anamnese** | Widgets já carregados por padrão + possibilidade de puxar outros. Finalizar → manda para a fila. | Não mostra histórico. Não compara com registro anterior. |
| 3 | **Fila** | Ordem real de quem é o próximo a ser chamado, com tempo de espera visível. | **Não decide para quem vai** (anestesista, cardio ou terceiro). Só ordena. |
| 4 | **Resumo do especialista** | Dados que o especialista precisa, prontos e resumidos. Botão de jornada. | Não edita a anamnese. |

---

## Jornada do registro

Estados mínimos — o Codex pode ampliar, desde que cada transição carimbe o horário:

```text
aguardando triagem → anamnese em andamento → na fila
   → analisado pelo especialista → (hub / sala de espera) → encerrado
```

- Cada transição grava `entrouEm`, para que **qualquer etapa possa ter seu próprio
  contador de espera**.
- O hub existe porque, mesmo depois do especialista, a pessoa costuma voltar a esperar —
  e um caso leve não pode envelhecer lá dentro.

---

## Entidades

```text
ENTITY: Registro
- id: gerado localmente, descartável
- pessoa: { nome, sexo, idade, plano }        // sem vínculo com nada
- anamnese: { blocos: [] }                    // JSON de widgets, versionado
- urgencia: definida na triagem
- jornada: [ { estado, entrouEm } ]           // append-only
- Source of truth: banco local do app
- Invalid states:
    · registro na fila sem anamnese finalizada
    · transição de jornada sem carimbo de horário
    · qualquer leitura que dependa de um registro anterior da mesma pessoa
```

---

## Divisão de trabalho

| Frente | Quem | Escopo |
|---|---|---|
| **Ambiente e casca** | Claude | Fork limpo, o que fica e o que sai, app abrindo (spec 001) |
| **Telas 1, 2 e 4** | Claude | Entrada, anamnese com widgets, resumo do especialista |
| **Motor da fila** | **Codex** | Ordenação por urgência + espera, estados da jornada, contador do hub. Função pura, testada, isolada. |
| **Catálogo de widgets** | **Pai do Marco** | Quais widgets a triagem precisa, e quais o DietFlow já tem prontos para trazer |

---

## Regras e Invariantes

**MUST**
- Rodar sem internet e sem instalação de servidor.
- Cada registro é independente; nada é buscado de atendimentos anteriores.
- Toda transição de jornada grava o horário.
- A fila mostra o tempo de espera de cada registro.

**MUST NOT**
- Cadastrar paciente, deduplicar, ou avisar "já existe".
- Exibir evolução, gráfico temporal ou comparação entre registros.
- Decidir a especialidade de destino.

---

## Open Questions

1. **Urgência**: entra como campo manual na triagem, ou é derivada da anamnese? (afeta o
   contrato que o Codex recebe)
2. **Plano de saúde**: é lista fixa ou texto livre?
3. Widgets padrão da primeira versão — aguardando o levantamento.

---

## Grill Verdict

- **Verdict:** ready for build.
- **Why:** o produto está fechado em quatro telas com fronteiras claras, e a única peça
  de lógica não trivial (ordenação) está isolada e delegada.
- **Next stage:** spec 001 — preparar o ambiente.
