# Spec 001 — Preparar o ambiente

Base: fork do FlowKit (`nmarcofernandess/flowkit`), clonado e renomeado para Antessala.
Objetivo: **sobrar só o que a triagem usa**, e o app abrir limpo — sem internet.

Leitura de apoio: [`docs/INVENTARIO.html`](../../docs/INVENTARIO.html) — o levantamento
completo do que existe em cada base.

---

## Princípio

Não apagar por apagar. Cada peça sai por um motivo declarado, e o que fica precisa
justificar a própria presença no dia da entrega.

## Estado atual (13/08/2026)

O fork roda: `npm install` em 53 s, `npm run dev` abre a janela, 409 testes verdes,
typecheck limpo. **Mas o que roda é o FlowKit com o nome do Antessala** — nenhuma das
quatro telas existe, e o primeiro boot baixa 278 MB de modelo de embeddings da internet.

---

## Caminho adotado

**A — trazer a branch Studio por cima do fork e remover o editorial.**

A branch `codex/editorial-ux-simplification` (Studio + 4 commits) já resolveu, com 293
arquivos e +46 mil linhas: o editor rich text (TipTap v3), o contexto da IA reescrito, a
navegação enxuta, as configurações magras e uma home que é coleção + fila. Refazer isso à
mão é desperdício.

**Plano B, se a remoção do editorial emperrar:** podar o kit base à mão e copiar do Studio
apenas o rich text, o contexto da IA e as configurações. Mais lento, sem surpresa.

---

## Três regras que governam o corte

1. **Esconder é tirar da rota, não apagar o arquivo.** Memória, RAG, grafo, importadores e
   galeria saem do menu e continuam no repositório. Voltar é acrescentar uma linha.
2. **Remover é remover mesmo.** Terminal, CLI, MCP, tool-server, cron, ditado e modelo
   local saem do código e do `package.json`. São eles que carregam o peso, as permissões
   de sistema e boa parte das 51 vulnerabilidades herdadas.
3. **Nada de baixar modelo no primeiro boot.** Enquanto a busca semântica estiver
   escondida, os 278 MB não acontecem — e o app volta a merecer a palavra offline.

---

## O que FICA

| Peça | Por quê |
|---|---|
| Casca Electron + electron-vite | é o que faz rodar sem servidor |
| React + roteador + componentes de interface | as quatro telas nascem daqui |
| Banco embarcado (PGlite) | persistência local, sem nada online |
| Camada de IPC tipada | comunicação entre a janela e o processo principal |
| Configurações (versão magra do Studio) | provedor de IA e pouco mais |
| IA — **simplificada** | um provedor, chamada direta, sem orquestração |
| Contexto da IA do Studio | modos, escopo e orçamento de caracteres |
| Editor rich text (TipTap) do Studio | base do bloco de notas da Memória, depois |
| Testes (Vitest) | o motor de fila precisa nascer testado |

## O que ESCONDE (sai da rota, fica no repo)

| Peça | Volta quando |
|---|---|
| Memória | for guardar conteúdo científico para a IA opinar sobre risco |
| RAG / busca híbrida | a Memória voltar — é o que a torna pesquisável |
| Knowledge Graph | houver volume que justifique |
| Importadores de documento | for alimentar a Memória |

## O que SAI

| Peça | Por quê |
|---|---|
| Editorial do Studio (gravar, transcrever, traduzir, glossário, montador, cadernos) | é outro produto |
| Captura de voz (STT / Parakeet / Whisper / Rust) | a triagem digita |
| Modelo local (llama.cpp / servidor local) | tira GB de disco e tempo de boot |
| Assistente Maiá | é outro produto, e pede permissões de sistema |
| Terminal embutido + CLI | não tem função clínica |
| Servidor MCP e tool-server | superfície de integração que não usamos |
| Galeria | não tem função clínica |
| Tarefas agendadas (cron) | nada roda no relógio nesta versão |
| Painel "configure seu tema" e passo de tema no wizard | ruído na primeira tela |

---

## Roadmap

| # | Passo | Detalhe |
|---|---|---|
| 1 | **Trazer o Studio por cima do fork** | Poda, rich text, contexto da IA, navegação e configurações magras entram de uma vez |
| 2 | **Remover o editorial** | Gravação, transcrição, tradução, glossário, montador, cadernos e aulas. Testes servem de rede |
| 3 | **Remover as superfícies extras** | Terminal, CLI, MCP, tool-server, cron, ditado, modelo local, galeria |
| 4 | **Esconder o que volta depois** | Memória, RAG, grafo e importadores saem do menu; o boot para de semear docs do FlowKit e de baixar modelo |
| 5 | **Trocar o supérfluo pelo essencial** | Fora o painel de tema; dentro um seletor claro / escuro / sistema no canto — **que não existe em nenhuma das duas bases e precisa ser construído** |
| 6 | **Plantar os nossos dados** | 382 medicamentos, 12 grupos de risco, 94 equivalentes metabólicos, 14 comorbidades com CID e o classificador com 16 testes |
| 7 | **Trazer as peças de fora** | Contrato de widget e drawer (DietFlow), templates para os "salvos", export em PDF (EscalaFlow) |
| 8 | **Provar** | Instalação limpa, app abrindo sem internet, testes verdes, nenhuma rota morta, `node_modules` medido antes e depois |

---

## Critérios de aceite

- [ ] `npm install` conclui sem baixar modelo de IA.
- [ ] **O primeiro boot não acessa a internet** e não baixa os 278 MB de embeddings.
- [ ] `npm run dev` abre a janela do app com o nome Antessala.
- [ ] Nenhuma rota morta no menu.
- [ ] Seletor de tema claro / escuro / sistema funcionando.
- [ ] `npm test` e `npm run typecheck` verdes.
- [ ] O repositório clonado do zero sobe em menos de cinco minutos numa máquina limpa.
- [ ] README diz o que ficou, o que escondeu, o que saiu e por quê.

---

## Riscos

| Risco | Direção |
|---|---|
| Engolir +46 mil linhas e a remoção emperrar | Cair no plano B; o corte do editorial é subtração, não engenharia |
| Remover módulo que outro ainda importa | Cortar de folha para raiz, rodando `typecheck` a cada remoção |
| A IA depender do que foi removido | Isolar a chamada antes de remover a orquestração |
| Migração do banco quebrar ao remover tabela | Recriar o banco local do zero é aceitável — não há dado de produção |

---

## Dependências de outras frentes

| Precisa de | Quem | Entrega |
|---|---|---|
| Catálogo de widgets e templates | Zan | `hack/specs/02-quais-widgets/` |
| Motor de ordenação da fila | Codex | `specs/002-motor-da-fila/` |

## Fora desta spec

As quatro telas e o motor de fila. Aqui só se prepara o terreno.
