# Spec 001 — Preparar o ambiente

Base: fork do FlowKit (`nmarcofernandess/flowkit`), clonado e renomeado para Antessala.
Objetivo: **sobrar só o que a triagem usa**, e o app abrir limpo.

---

## Princípio

Não apagar por apagar. Cada peça sai por um motivo declarado, e o que fica precisa
justificar a própria presença no dia da entrega.

---

## O que FICA

| Peça | Por quê |
|---|---|
| Casca Electron + electron-vite | é o que faz rodar sem servidor |
| React + roteador + componentes de interface | as quatro telas nascem daqui |
| Banco embarcado (PGlite) | persistência local, sem nada online |
| Camada de IPC tipada | comunicação entre a janela e o processo principal |
| Configurações | chave de IA e preferências |
| IA — **simplificada** | um provedor, chamada direta, sem orquestração |
| Testes (Vitest) | o motor de fila precisa nascer testado |

## O que SAI

| Peça | Por quê |
|---|---|
| Captura de voz (STT / Whisper / Rust) | a triagem digita |
| Modelo local (llama.cpp / servidor local) | tira centenas de MB e tempo de boot |
| Assistente de leitura (Maiá) | é outro produto |
| Terminal embutido | não tem função clínica |
| Servidor MCP e servidor de ferramentas | superfície de integração que não usamos hoje |
| Galeria | não tem função clínica |
| Importadores de conversa | não tem função clínica |
| Busca semântica / grafo / embeddings | é o que puxa o download pesado; a triagem não depende |
| Tarefas agendadas | nada roda no relógio nesta versão |

---

## Passos

1. **Inventário antes de cortar** — listar as rotas e os módulos do processo principal
   que existem hoje, para saber o que a remoção vai quebrar.
2. **Remover as páginas** que saem e as rotas correspondentes.
3. **Remover os módulos do processo principal** e os canais de IPC órfãos.
4. **Podar as dependências** que ficaram sem uso e as pastas de binário
   (`stt/`, `llama.cpp/`, `resources/` do que saiu).
5. **Simplificar a IA** — manter uma chamada direta a um provedor, remover roteamento,
   ferramentas e avaliações.
6. **Reduzir o banco ao necessário** — deixar só as tabelas que a triagem usa.
7. **Verificar** — `npm install`, `npm run dev` abre a janela; `npm test` verde;
   `npm run typecheck` sem erro.
8. **Registrar** no README o que ficou e o que saiu.

---

## Critérios de aceite

- [ ] `npm install` conclui sem baixar modelo de IA.
- [ ] `npm run dev` abre a janela do app com o nome Antessala.
- [ ] Nenhuma rota morta no menu.
- [ ] `npm test` e `npm run typecheck` verdes.
- [ ] O repositório clonado do zero sobe em menos de cinco minutos numa máquina limpa.
- [ ] README diz o que ficou, o que saiu e por quê.

---

## Riscos

| Risco | Direção |
|---|---|
| Remover módulo que outro ainda importa | cortar de folha para raiz, rodando `typecheck` a cada remoção |
| A IA depender do que foi removido | isolar a chamada antes de remover a orquestração |
| Migração do banco quebrar ao remover tabela | recriar o banco local do zero é aceitável — não há dado de produção |

---

## Fora desta spec

As quatro telas, o motor de fila e o catálogo de widgets. Aqui só se prepara o terreno.
