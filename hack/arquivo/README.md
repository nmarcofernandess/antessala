# Arquivo

História, não contrato. Nada aqui manda no produto.

Estes documentos viviam em cinco branches que foram deletadas em 15/08/2026. Cada uma
segurava sozinha um material que ninguém queria perder e ninguém ia procurar — trazidos
para a `main` porque branch órfã é a forma mais fácil de perder trabalho sem perceber.

Quem manda continua sendo `hack/PRD.md` e os pares `ANALYST-*`/`BUILD-*` em
`hack/domains/`. Onde este arquivo divergir deles, eles ganham.

## O que tem aqui

| Pasta | O quê | Veio de |
|---|---|---|
| `02-quais-widgets/` | Catálogo de widgets da anamnese, rotas de agendamento e o protótipo HTML — a frente que o Zan tocou no hackathon | `zan/widgets` |
| `specs/` | A era anterior ao `hack/`: análise do produto, spec do ambiente, mapa de esquemas e os prompts de Codex | `codex/preparar-ambiente` |
| `motor-da-fila/` | Cinco arquivos de motor e três de teste, escritos e nunca integrados | `codex/motor-da-fila-resume` |

## Sobre `motor-da-fila/`

O código está **fora do build de propósito**. Ele nunca entrou em `src/`, nunca passou
por review e não compila contra o estado atual — `tsconfig` e `vitest` não o enxergam
aqui. Se um dia a fila for construída de verdade, este é ponto de partida para ler, não
para copiar.

## O que foi descartado junto

`RagPlayground.tsx` (477 linhas, de `codex/warlog-exaustivo`) e todo o casco herdado do
FlowKit que essas branches ainda carregavam: `docs/`, `knowledge/`, `llama.cpp/`, os
ícones de logo e os scripts de `llama-server`. A `main` já os substituiu — o Playground
por `MemoriaPagina`, o resto por nada, que era o certo.

O Warlog dessas branches não está aqui: virou [`hack/WARLOG.md`](../WARLOG.md), com nota
de contexto no topo.
