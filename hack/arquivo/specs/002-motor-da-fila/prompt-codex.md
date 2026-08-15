# Handoff para o Codex — o motor da fila

> Cole isto no Codex, com o repo `nmarcofernandess/antessala` aberto.

---

## A pergunta que você responde

**Quem é o próximo a ser chamado — agora?**

Não "quem chegou primeiro" e não "quem é o mais grave". A ordem real, que combina a
gravidade de cada pessoa com o tempo que ela está parada esperando. E que **muda sozinha
enquanto ninguém mexe**, porque o tempo passa.

Essa última frase é o coração do seu trabalho. Uma lista ordenada é fácil. Uma lista que
se reordena porque o relógio andou, num app de mesa, sem servidor, é o problema real.

---

## Contexto: o Antessala em cinco linhas

App de mesa (Electron) de **triagem pré-anestésica**, offline, sem servidor e sem login.
A pessoa **não é cadastrada** — é um identificador descartável (nome, sexo, idade, plano).
Ela entra, preenche uma anamnese, e aparece numa fila que diz quem chamar. O especialista
abre, lê o resumo pronto e marca a jornada.

Leia antes de codar, nesta ordem:

1. `specs/000-produto-antessala/analysis.md` — o produto, as quatro telas, os invariantes
2. `docs/PLANO.html` — abra no navegador; a divisão de frentes
3. `specs/001-preparar-ambiente/spec.md` — o estado do terreno onde você vai plantar
4. `CLAUDE.md` — o aviso no topo importa: o corpo do arquivo ainda descreve o FlowKit
   original, não este produto

## O que NÃO é seu

| Não é seu | Quem faz |
|---|---|
| **A regra clínica que diz se alguém é leve ou urgente** | vem da anamnese e do catálogo de widgets, outra frente |
| **As telas** (entrada, anamnese, resumo) | outra frente |
| **A limpeza do repositório** | outro Codex, executando a spec 001, em paralelo com você |

**A prioridade chega pronta para você.** Você não a calcula, não a deriva de comorbidade,
não abre tabela de ASA. Você recebe um número e o tempo, e devolve uma ordem.

---

# Parte A · Fechar a jornada de ponta a ponta

O analyst tem um esboço. Ele está incompleto de propósito — **fechar isso é seu**.

## O que já sabemos que acontece

```
alguém começa o cadastro  →  pode parar no meio
        ↓
preenche a anamnese       →  pode parar no meio
        ↓
finaliza                  →  agora está esperando, com o risco já triado
        ↓
é chamado                 →  vai para o hub: já entrou, mas ainda aguarda o médico
        ↓                     (o anestesista já leu a anamnese antes disso)
        ↓
atendido ... ou foi embora
```

## As três coisas que essa jornada obriga

**1. A espera começa antes da fila.** Um cadastro iniciado e não terminado é uma pessoa
parada num corredor. Alguém que chegou na tela de anamnese e não finalizou também. Esses
estados incompletos **contam tempo** e precisam aparecer em algum lugar — senão a pessoa
some do sistema estando fisicamente no hospital. Decida como: uma fila separada, um alerta,
uma seção "pendentes". Justifique.

**2. O hub tem seu próprio relógio.** Depois de chamado, a pessoa não terminou — ela entrou
numa sala e voltou a esperar, agora por outro profissional. Se o hub usasse a mesma régua
da fila, um caso leve envelheceria lá dentro para sempre. Ele precisa de contagem própria,
e provavelmente de uma régua que envelhece mais rápido.

**3. Existe um fim.** "Atendido" e "foi embora" são desfechos diferentes e ambos encerram.
Um registro encerrado sai das filas mas continua existindo.

**Entregue a máquina de estados completa**: quais estados existem, quais transições são
válidas, quais são proibidas, e **em qual deles o relógio corre**. Nem todo estado espera —
"em atendimento" não é espera, é atendimento.

---

# Parte B · O núcleo, e ele é puro

## O contrato

Tipos podem crescer; não podem ser renomeados sem avisar — outra frente vai importá-los.

```ts
/** 1 é o mais urgente. null = ainda não classificado. Chega pronto de fora. */
export type Prioridade = 1 | 2 | 3 | 4 | null

export type EstadoJornada = /* você fecha isto na Parte A */

export interface Marco {
  estado: EstadoJornada
  /** epoch ms — quando o registro ENTROU neste estado */
  entrouEm: number
}

export interface RegistroFila {
  id: string
  prioridade: Prioridade
  /** append-only, cronológica, nunca vazia */
  jornada: Marco[]
}

export interface ItemOrdenado {
  id: string
  posicao: number      // 1 = próximo a ser chamado
  esperaMs: number     // no estado atual
  score: number
  /** uma linha, em português de gente, dizendo por que está nessa posição */
  motivo: string
}
```

## Regras não negociáveis

- **Função pura.** Nenhum `Date.now()`, `Math.random()`, banco, rede ou `console` dentro do
  núcleo. O tempo entra **sempre** pelo parâmetro `agora`. É isso que torna o
  comportamento testável e a demonstração reproduzível.
- **Imutável.** Avançar de estado devolve um registro novo; não muta a entrada.
- **Toda transição carimba o horário.** Um marco sem `entrouEm` é estado inválido.
- **Transição inválida lança erro** com mensagem legível.

## As propriedades que os testes provam

A fórmula é sua. Estas não são:

| Propriedade | O que provar |
|---|---|
| **Determinismo** | Mesma entrada e mesmo `agora` → exatamente a mesma saída |
| **Prioridade manda** | Com esperas iguais, o mais urgente vem antes |
| **A espera pesa** | Alguém de prioridade baixa, esperando o suficiente, **ultrapassa** um urgente recém-chegado. Prove com um caso concreto e **diga em quantos minutos isso acontece** |
| **O urgente não monopoliza** | Uma chegada urgente **não** empurra para trás, indefinidamente, quem já está esperando há muito. Prove o caso: fila com um leve antigo + urgentes chegando em série |
| **Sem inanição** | Dado tempo suficiente, qualquer registro chega à posição 1 |
| **Monotonicidade** | Esperar mais nunca piora a posição em relação a um conjunto parado |
| **Desempate estável** | Empate resolve por quem entrou primeiro. Nunca pela ordem do array |
| **Não classificado** | `prioridade: null` entra e é ordenado — não some, não quebra, não vai para o fim eternamente |

**Escreva o teste antes da implementação.**

## O freio: simples, e explicável em voz alta

O critério de simplicidade é este: **uma pessoa na recepção precisa conseguir explicar,
para quem está esperando, por que a ordem é aquela.** "A senhora está na frente porque
está esperando há 50 minutos" é uma frase que funciona. "O score composto ponderado dela é
maior" não é.

Portanto: nada de aprendizado de máquina, nada de fila de prioridade exótica, nada de
dezenas de parâmetros configuráveis. Uma fórmula que caiba em poucas linhas, com as
constantes nomeadas e exportadas num objeto — e um comentário no topo do arquivo
explicando-a em português de gente, com os números escolhidos e o porquê.

Se você se pegar desenhando a terceira camada de abstração, parou. É uma ordenação, não um
escalonador de sistema operacional.

---

# Parte C · O backend em tempo real

Aqui está o trabalho de verdade. **A ordem muda porque o tempo passou, não porque alguém
clicou.** Alguém olhando o painel precisa ver a fila se reordenar sozinha e o contador de
espera subindo.

O que você precisa resolver e propor:

- **Onde mora o relógio** — processo principal ou janela? Recalcular a cada tique, ou
  derivar do carimbo no momento de desenhar?
- **Com que frequência** a ordem é recomputada, e como isso não come a bateria de um
  notebook num consultório o dia inteiro.
- **Como a janela é avisada** de que a ordem mudou — o app usa IPC tipado (`src/main/tipc.ts`,
  chamada direta, **nunca** `.invoke()`).
- **O que é persistido e o que é derivado.** Sugestão forte: persista os carimbos de tempo,
  derive tudo o mais. Score gravado no banco envelhece errado.
- **O que acontece quando o app fica fechado a noite toda** e reabre — as pessoas
  "esperaram" doze horas? Provavelmente a resposta é limpar ou encerrar, mas é sua decisão,
  e ela precisa estar no relatório.
- **Duas janelas abertas ao mesmo tempo**, se isso for possível: quem manda?

O terreno onde isso encaixa: `src/main/db/schema.ts` (tabelas), `src/main/db/query.ts`
(helpers), `src/main/tipc.ts` (IPC), `src/renderer/src/paginas/` (telas).

## Entregue em duas camadas — e isto é importante

Outro Codex está limpando o repositório neste momento, na spec 001. Para vocês não
colidirem:

**Camada 1 — o núcleo.** `src/shared/fila/` — tipos, jornada, ordenação, testes. Não
depende de nada do resto do repositório e **pode ser feita agora**. Ninguém mais toca
nessa pasta.

**Camada 2 — a integração em tempo real.** Tabelas, IPC e a atualização da tela. Se o
terreno já estiver pronto quando você chegar aqui, implemente. Se ainda não estiver,
**escreva o contrato e o desenho** — que tabela, que canal, que frequência — e deixe
pronto para plugar.

---

## Sobre o greenfield

Se você tiver a ferramenta de especificação greenfield disponível, use-a como **modelo de
rigor**: obrigar o desenho a fechar antes do código, cobrir estados e transições, não
deixar buraco entre a regra e o teste.

Ignore a parte de análise de mercado e comparação com concorrentes. Aqui não há
concorrente — há uma fila de hospital e um relógio. Se a ferramenta não estiver disponível,
nada muda: o que importa é o rigor, não o carimbo.

---

## Prova

- [ ] `npm test` verde, com as **oito** propriedades da Parte B cobertas.
- [ ] `npm run typecheck` sem erro.
- [ ] **Zero `Date.now()`** dentro de `src/shared/fila/`.
- [ ] Um comentário no topo do arquivo de ordenação explicando a fórmula em linguagem de
      gente, com as constantes e o motivo de cada número.
- [ ] Uma simulação: dez registros, prioridades variadas, seis horas de relógio simulado —
      mostrando a ordem mudando ao longo do tempo e **provando que ninguém ficou para trás**.
- [ ] Branch própria, PR contra `main`. Nada de push direto.

## O relatório

`specs/002-motor-da-fila/relatorio.md`: a máquina de estados que você fechou e por quê, a
fórmula e as constantes com a justificativa, o desenho do tempo real com as decisões da
Parte C, e o que você decidiu diferente deste documento — com o motivo. Divergência
fundamentada é bem-vinda; divergência silenciosa não.

---

## Resumo em uma frase

Feche a jornada de ponta a ponta, entregue um núcleo puro e testado que responde *quem é o
próximo*, e um backend que faz essa resposta mudar sozinha na tela conforme o relógio anda
— simples o bastante para a recepção explicar a ordem em voz alta.
