# Antessala

**Triagem pré-anestésica offline: anamnese estruturada e fila por urgência e espera.**

App de mesa (Electron) que roda sozinho no computador — sem servidor, sem banco online,
sem login. Feito para o HackaHelpth.

---

## O que ele faz

Quatro telas, e nada além disso:

| # | Tela | Faz | **Não** faz |
|---|---|---|---|
| 1 | **Entrada** | Nome, sexo, idade, plano. Botão adicionar. | Não busca paciente existente. |
| 2 | **Anamnese** | Widgets padrão carregados + possibilidade de puxar outros. | Não mostra histórico nem evolução. |
| 3 | **Fila** | Ordem real de quem é o próximo, com tempo de espera. | Não decide a especialidade de destino. |
| 4 | **Resumo** | Dados prontos para o especialista + botão de jornada. | Não edita a anamnese. |

### A regra que define tudo

**O paciente não é cadastrado — é um identificador descartável.** Cada entrada é um
registro novo e independente, como o cadastro de exames do DietFlow, onde existem várias
"glicose" e nenhuma reclama de duplicata.

Consequência: sem busca de paciente, sem deduplicação, **sem evolução**. O mesmo nome
pode aparecer duas vezes na fila — isso é aceito, não é erro.

---

## Documentos

| Arquivo | Para quem |
|---|---|
| [`docs/PLANO.html`](docs/PLANO.html) | **Comece aqui.** Plano de trabalho: tarefas, passos e quem faz o quê. Abre no navegador com dois cliques. |
| [`docs/INVENTARIO.html`](docs/INVENTARIO.html) | O arsenal: tudo que o kit base tem, o que a branch Studio já resolveu, o que roubamos do DietFlow/EscalaFlow — e a proposta de preparo do repo. |
| [`specs/000-produto-antessala/analysis.md`](specs/000-produto-antessala/analysis.md) | O analyst: a decisão do ID descartável, as quatro telas, a jornada, os invariantes. |
| [`specs/001-preparar-ambiente/spec.md`](specs/001-preparar-ambiente/spec.md) | O que fica e o que sai do casco herdado. |

---

## Como rodar

Precisa de **Node.js 20 ou mais novo**. Nada além disso.

```bash
git clone https://github.com/nmarcofernandess/antessala.git
cd antessala
npm install
npm run dev
```

A janela abre sozinha. Para empacotar no fim: `npm run dist:mac`.

| Comando | O que faz |
|---|---|
| `npm run dev` | Dev com hot reload |
| `npm test` | Testes unitários (Vitest) |
| `npm run typecheck` | Checagem de tipos |
| `npm run build` | Build de produção |

---

## Divisão do trabalho

| Frente | Quem | Escopo |
|---|---|---|
| Ambiente e telas 1, 2, 4 | Claude | Casco limpo, entrada, anamnese, resumo |
| **Motor da fila** | **Codex** | Ordenação por urgência + espera, estados da jornada, contador do hub. Função pura, testada, isolada. |
| **Catálogo de widgets** | **Zan** | Quais widgets a triagem precisa e quais o DietFlow já tem prontos |

---

## Base técnica

Fork do [FlowKit](https://github.com/nmarcofernandess/flowkit) — casco Electron + React
com banco embarcado. O que sobrou e o que foi removido está em
[`specs/001-preparar-ambiente/spec.md`](specs/001-preparar-ambiente/spec.md).

| Camada | Tecnologia |
|---|---|
| Runtime | Electron + React 19 |
| Build | electron-vite + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| Banco | PGlite (Postgres embarcado, local) |
| IPC | @egoist/tipc (tipado) |
| Testes | Vitest |

---

## Privacidade

Nenhum dado de paciente sai do computador. Não há servidor, telemetria nem sincronização.
O banco vive num arquivo local da máquina que rodou o app.
