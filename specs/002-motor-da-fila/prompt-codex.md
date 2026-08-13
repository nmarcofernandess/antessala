# Prompt para o Codex — motor da fila

> Cole isto no Codex, dentro do repo `nmarcofernandess/antessala`.

---

## Contexto

O Antessala é um app de mesa offline de **triagem pré-anestésica**. Quatro telas:
entrada → anamnese → **fila** → resumo do especialista.

Leia antes de codar:

- `specs/000-produto-antessala/analysis.md` — o produto e seus invariantes
- `README.md` — visão geral

Duas leis do produto que te afetam diretamente:

1. **O paciente é um id descartável.** Não existe histórico, deduplicação nem evolução.
   Nada no teu código pode consultar um registro anterior da mesma pessoa.
2. **O sistema não decide a especialidade de destino.** Anestesista, cardiologista ou
   terceiro — não é problema teu. Tu só ordenas.

## Tua frente, e só ela

Tu constróis **o motor da fila**: a lógica pura que responde *quem é o próximo*.

Não tocas em: telas, componentes React, schema do banco, IPC, Electron, estilo.
Outra frente cuida disso e vai importar o teu módulo.

---

## Onde escrever

```
src/shared/fila/
├── tipos.ts        # os tipos do contrato abaixo
├── jornada.ts      # transições de estado e cálculo de espera
├── ordenacao.ts    # o score e a ordenação
└── index.ts        # re-export

tests/shared/fila/
├── jornada.test.ts
└── ordenacao.test.ts
```

Vitest já está configurado (`npm test`). TypeScript estrito.

---

## Contrato

Estes tipos são o acordo com a outra frente. Podes **acrescentar** campos; não podes
renomear nem remover os que estão aqui sem avisar.

```ts
/** 1 é o mais urgente. null = ainda não classificado. */
export type Prioridade = 1 | 2 | 3 | 4 | null

export type EstadoJornada =
  | 'aguardando_triagem'
  | 'anamnese_em_andamento'
  | 'na_fila'
  | 'analisado_pelo_especialista'
  | 'no_hub'
  | 'encerrado'

export interface Marco {
  estado: EstadoJornada
  /** epoch ms — quando o registro ENTROU neste estado */
  entrouEm: number
}

export interface RegistroFila {
  id: string
  prioridade: Prioridade
  /** append-only, ordem cronológica, nunca vazio */
  jornada: Marco[]
}

export interface ItemOrdenado {
  id: string
  posicao: number          // 1 = próximo a ser chamado
  esperaMs: number         // no estado atual
  score: number
  /** frase curta e humana do porquê da posição. Ex.: "prioridade alta · 38 min de espera" */
  motivo: string
}
```

Funções exportadas:

```ts
// jornada.ts
export function estadoAtual(r: RegistroFila): Marco
export function avancar(r: RegistroFila, para: EstadoJornada, agora: number): RegistroFila
export function esperaNoEstadoAtual(r: RegistroFila, agora: number): number

// ordenacao.ts
export function ordenarFila(registros: RegistroFila[], agora: number): ItemOrdenado[]
export function ordenarHub(registros: RegistroFila[], agora: number): ItemOrdenado[]
```

---

## Regras não negociáveis

- **Função pura.** Nenhuma chamada a `Date.now()`, `Math.random()`, banco, rede ou
  `console` dentro do módulo. O tempo entra **sempre** pelo parâmetro `agora`. É isso que
  torna o comportamento testável e a demonstração reproduzível.
- **Imutável.** `avancar` devolve um registro novo; não muta a entrada.
- **Toda transição carimba o horário.** Um `Marco` sem `entrouEm` é estado inválido.
- **`ordenarFila` só considera** registros em `na_fila`. **`ordenarHub` só considera**
  registros em `no_hub`. Os demais são ignorados, não são erro.
- Uma transição inválida (ex.: `encerrado` → `na_fila`) lança erro com mensagem legível.

## Propriedades que os testes precisam provar

A fórmula do score é tua. Estas propriedades não são:

| Propriedade | O que provar |
|---|---|
| **Determinismo** | Mesma entrada e mesmo `agora` produzem exatamente a mesma saída. |
| **Prioridade manda** | Com esperas iguais, prioridade 1 vem antes de 2, que vem antes de 3. |
| **A espera pesa** | Um registro de prioridade baixa, esperando tempo suficiente, **ultrapassa** um de prioridade alta que acabou de chegar. Prove com um caso concreto e diga em quanto tempo isso acontece. |
| **Sem inanição** | Nenhum registro fica preso para sempre: dado tempo suficiente, qualquer um chega à posição 1. |
| **Monotonicidade** | Esperar mais nunca piora a posição de um registro em relação a um conjunto parado. |
| **Desempate estável** | Empate de score resolve por quem entrou na fila primeiro. Nunca pela ordem do array. |
| **Não classificado** | `prioridade: null` entra e é ordenado — não some, não quebra, não vai para o fim eternamente. |

Escreve o **teste antes** da implementação.

## Decisões que são tuas

- A fórmula do score e as constantes de envelhecimento (documenta os números escolhidos e
  o raciocínio em comentário no topo de `ordenacao.ts`).
- Se o hub usa a mesma fórmula com constantes diferentes, ou uma própria. O hub tende a
  envelhecer mais rápido, porque lá o caso leve é justamente o que não pode ficar parado.
- O texto do `motivo` — desde que caiba numa linha e um leigo entenda.

Se as constantes forem ajustáveis, exporta-as como um objeto nomeado em vez de espalhar
números mágicos.

## Fora do teu escopo

Telas, persistência, IPC, decisão de especialidade, derivação da prioridade a partir da
anamnese. A prioridade **chega pronta** para ti.

---

## Aceite

- [ ] `npm test` verde, com as sete propriedades acima cobertas.
- [ ] `npm run typecheck` sem erro.
- [ ] Zero `Date.now()` dentro de `src/shared/fila/`.
- [ ] Um comentário no topo de `ordenacao.ts` explicando a fórmula em linguagem de gente.
- [ ] Branch própria e PR contra `main`.
