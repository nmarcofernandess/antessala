# Relatório de execução — Spec 001

## Veredito

A preparação seguiu o **caminho B**: o fork do FlowKit foi podado diretamente e,
do Studio, entraram apenas o editor rich text, o contrato de contexto da IA e as
ideias úteis de navegação/configuração.

O resultado é uma casca Antessala menor, com primeiro boot inteiramente local,
três rotas coerentes, tema claro/escuro/sistema, IA cloud somente por ação
explícita e o esqueleto autônomo da anamnese. A seleção clínica de
widgets/templates e o motor da fila não foram inventados nesta lane.

## Por que o caminho B venceu

A branch Studio e este fork não têm merge-base. Aplicar o Studio inteiro seria
transplantar **46.865 linhas adicionadas** para então remover a maior parte.
Aproximadamente **86,7%** dessas adições eram editoriais ou ligadas a
gravação/transcrição. A branch também continuava instalando `phaser`, Hugging
Face, llama e MCP, portanto não entregava o boot magro/offline.

As três partes genéricas desejáveis somavam cerca de **2.613 linhas** e tinham
fronteiras identificáveis. O porte seletivo reduziu risco, volume e retrabalho.

## O que foi entregue

### Persistência e anamnese autônoma

- `mapa-esquemas.md` documenta o envelope `{ _v: 2, blocos: [...] }`, os oito
  widgets, os catálogos e o corte de `patientId`.
- `registros` guarda nome, sexo, idade, plano e anamnese JSONB na própria linha.
- Não existe tabela de pacientes, FK, busca, deduplicação ou leitura histórica.
- Dois registros com o mesmo nome são independentes e válidos.
- O esqueleto de jornada é append-only, mas seus tipos, campos e handlers são
  **provisórios** até a reconciliação com `codex/motor-fila-logica-v2`.

### Widgets e encaixes

- Os oito widgets do DietFlow foram portados com tipos, defaults, schemas,
  completude, serialização e `renderToText`.
- Composer/drawer e JSX foram refeitos com shadcn/ui, sem HeroUI e sem vínculo
  com paciente ou registro anterior.
- IDs de bloco precisam ser não vazios e únicos; a versão do widget precisa ser
  suportada; itens clínicos vazios não são publicados como completos.
- O registry técnico conhece os oito widgets, mas o catálogo clínico ativo e os
  templates ativos permanecem vazios.
- `src/shared/extensions/catalogo-widgets.ts` aponta para
  `hack/specs/02-quais-widgets/`; `src/shared/extensions/motor-fila.ts` aponta
  para `specs/002-motor-da-fila/`.

### Dados clínicos locais

| Conteúdo | Quantidade | Tamanho do arquivo |
|---|---:|---:|
| CID-10 hierárquico completo | 14.793 | 624.180 bytes, gzip |
| Medicamentos | 382 | 87.883 bytes |
| Classes terapêuticas derivadas | 35 | carregadas dos medicamentos |
| Grupos de risco | 12 | 1.858 bytes |
| Atividades MET | 94 | 9.898 bytes |
| Comorbidades | 14 | 2.147 bytes |

Os cinco assets ocupam **725.966 bytes** e geram **15.330 linhas clínicas**.
O seed confere SHA-256, lê os arquivos do checkout ou de `clinical-data/` no
bundle e carrega o PGlite em transação. Não consulta DietFlow, Postgres remoto,
embeddings ou LLM.

As 14 comorbidades têm ao menos um CID válido (17 referências); os 382
medicamentos preservam 1.447 aliases comerciais, deduplicados dentro de cada
medicamento; os 94 itens MET usam os nomes canônicos do golden. O classificador
e o parecer foram portados para TypeScript como funções puras.

### Casca e integrações

- Rotas ativas: Início, Assistente IA e Configurações.
- Menu sem destino morto e seletor claro/escuro/sistema sempre disponível.
- IA direta por Gemini ou OpenRouter, um ativo por vez, sem tools, streaming,
  RAG automático, anexos, roteamento ou modelo local.
- Editor TipTap genérico e contrato puro de contexto com modos `global`,
  `adaptive` e `pinned`, escopos e orçamento de caracteres.
- HTML → PDF pelo `printToPDF` do Electron, em sessão efêmera, JavaScript
  desligado e rede bloqueada.
- O renderer bloqueia egress remoto automático; imagens remotas em Markdown são
  substituídas; links externos aceitam somente HTTPS e exigem clique.

## Removido versus escondido

| Situação | Peças | Motivo/condição |
|---|---|---|
| **Removido** | terminal, harness de shell e CLI | sem função clínica e com superfície de execução local |
| **Removido** | MCP e tool-server HTTP | integração sem consumidor nesta etapa |
| **Removido** | cron | não há trabalho periódico no produto atual |
| **Removido** | modelo local, llama.cpp, downloader e readiness | eliminam GB, subprocessos e boot dependente de modelo |
| **Removido** | Maiá | outro produto e permissões de sistema desnecessárias |
| **Removido** | galeria | sem função clínica |
| **Removido** | onboarding/wizard herdado | configuração fictícia na primeira abertura |
| **Removido** | orquestração, routing, tool UI e contratos legados da IA | a superfície ativa é cloud direta |
| **Removido** | backup, documentação operacional e seeds de conhecimento do FlowKit | descreviam/restauravam somente o produto herdado, sem contrato clínico válido |
| **Removido** | manual de instalação e propostas de ícone EscalaFlow/FlowKit | recursos sem consumidor e com identidade errada; ficaram apenas os três ícones ativos |
| **Não importado** | editorial do Studio: aulas, cadernos, tradução, glossário e montador | o caminho B evitou introduzir outro produto |
| **Escondido** | Memória, RAG, grafo e importadores | compilam e mantêm IPC, mas não têm rota, menu, job ou boot |
| **Escondido** | gravação/STT | código-fonte preservado para roadmap, sem rota, IPC, boot ou recurso empacotado |

Memória/RAG não dependem mais de Hugging Face ou LLM local. Sem adaptador
explícito, embeddings retornam `null`; metadata/enrichment cloud só executam
após comando do usuário. Reativar a página não exige ressuscitar dependências
removidas nem tirar arquivos da exclusão do TypeScript.

## Números antes e depois

As medidas de `node_modules` usam `du -sk` e contagem de arquivos. A medida final
foi feita imediatamente após `npm ci`, antes de gerar cache do Vite.

| Medida | Antes (`main`) | Depois | Variação |
|---|---:|---:|---:|
| `node_modules` | 2.043.256 KiB | 1.038.844 KiB | −1.004.412 KiB (−49,2%) |
| Arquivos em `node_modules` | 53.040 | 38.260 | −14.780 (−27,9%) |
| Vulnerabilidades `npm audit` | 51 | 40 | −11 |
| Baixas | 4 | 3 | −1 |
| Moderadas | 6 | 3 | −3 |
| Altas | 37 | 31 | −6 |
| Críticas | 4 | 3 | −1 |

O `npm ci` limpo concluiu em **22,44 s**, adicionou 1.050 pacotes e não baixou
modelo de IA. O `npm install` no lock final também concluiu sem download de
modelo. Hugging Face, `node-llama-cpp`, `phaser`, MCP, terminal e as dependências
órfãs de form/chart/prompt não estão instalados.

As 40 vulnerabilidades restantes vêm da árvore ainda necessária. Não foi usado
`npm audit fix --force`, pois isso faria upgrades quebráveis fora do escopo.

## Provas finais

| Critério | Resultado | Evidência |
|---|---|---|
| Instalação limpa sem modelo | **verde** | `npm ci`: 22,44 s; postinstall executou apenas rebuild nativo do Electron |
| Primeiro seed sem internet | **verde** | banco temporário limpo, `globalThis.fetch` substituído por função que falha; zero chamada e 15.330 linhas locais |
| Boot Electron com banco limpo | **verde** | E2E abriu o build com diretório PGlite temporário; `npm run dev` também criou schema/seed local |
| Nome Antessala | **verde** | título da janela e heading confirmados no Electron E2E |
| Rotas/menu | **verde** | E2E confirmou exatamente `/`, `/ia`, `/configuracoes` e três itens de navegação |
| Tema | **verde** | E2E alternou claro, escuro e sistema e conferiu `antessala-theme` |
| `npm run typecheck` | **verde** | main e renderer, sem arquivos clínicos/knowledge escondidos por `exclude` |
| `npm test` | **verde** | 51 arquivos, 216 testes, zero falha e zero skip, em 38,10 s |
| `npm run build` | **verde** | main, preload e renderer produzidos em 12,17 s; apenas avisos de chunk estático/dinâmico |
| `npm run test:e2e` | **verde** | 1/1 fluxo Electron em 12,0 s |
| Workflows | **verde** | `actionlint` sem diagnóstico; expansão de assets provada no Bash 3.2 do macOS |
| PDF isolado | **verde** | 7 testes de sandbox, bloqueio de rede, impressão e cleanup |

O Mac não foi fisicamente desconectado, conforme autorizado pelo usuário. A
prova combinou seed instrumentado fail-closed, boot real com banco temporário,
política de sessão que bloqueia HTTP/HTTPS/WS/WSS no renderer e E2E do Electron.

A cadeia `actionlint → typecheck → test → build → E2E` foi repetida e fechou
verde no commit `bc98182`. A correção documental que registra este resultado é
o único delta posterior à prova e não muda código, dependências ou workflows.
O glob dos assets também foi executado no Bash 3.2 nativo do macOS e o contrato
Rust dormente passou em `cargo metadata --locked --offline`.

O baseline tinha 409 testes passando e 4 ignorados. O resultado final tem 216
passando e nenhum ignorado: uma **redução líquida de 193**, não uma contagem
forense de arquivos apagados. Saíram provas de produtos removidos — CLI,
terminal, MCP/tool-server, modelo local/routing, Maiá, galeria, cron,
onboarding, backup FlowKit e UI de tools/anexos — e E2Es de rotas agora
escondidas foram aposentados ou substituídos por contratos da casca ativa.
Testes unitários de Memória/RAG/importadores e do STT preservado continuam na
suíte.

## O que quebrou e como foi resolvido

- A IA antiga importava tool families, routing, readiness e runtime local. Foi
  reduzida a cliente cloud direto; contratos/UI órfãos foram apagados, e não
  apenas escondidos do `tsconfig`.
- A primeira poda deixou Memória/RAG com imports de Hugging Face e LLM local.
  Foram introduzidos um adaptador de embedding opt-in e rotas cloud explícitas;
  toda a superfície dormente voltou ao typecheck e ao router IPC.
- A extração inicial dos catálogos tinha CID de asma errado, nomes MET trocados
  e aliases de medicamentos truncados. Os snapshots foram regenerados e
  ganharam testes semânticos contra o CID completo e os goldens.
- Os endpoints dos catálogos devolviam `snake_case` incompatível com os widgets.
  DTOs compartilhados e mappers tipados corrigiram a fronteira.
- Sexo desconhecido era inferido como masculino. O parecer agora normaliza
  valores reconhecidos e preserva o desconhecido sem inventar informação.
- O composer publicava drafts inválidos, aceitava IDs duplicados/versões
  incompatíveis e podia mover âncoras de snapshot/resultado. Os contratos e os
  testes foram endurecidos.
- Markdown da IA podia carregar imagem remota automaticamente ou abrir esquema
  externo arbitrário. CSP, política de sessão, renderer seguro e allowlist HTTPS
  fecharam os dois canais.
- Testes herdados apontavam para rotas/produtos removidos. Foram substituídos por
  contratos da casca Antessala e provas do boot clínico local.
- O workflow de release ainda criava título e validava artefatos com o nome
  FlowKit. Os nomes foram alinhados ao `productName: Antessala` já usado pelo
  empacotador, e os jobs deixaram de preparar Rust/llama/STT que não participam
  do bundle, evitando uma falha futura na publicação por tag.

## Divergências conscientes da spec

1. **Caminho B em vez do A.** Não havia ancestral comum útil e a maior parte do
   Studio era material que teria de ser removido.
2. **Rede da máquina não desligada.** Decisão explícita do usuário; a prova foi
   instrumentada e executada sobre banco novo.
3. **STT preservado, mas dormente.** A spec original mandava remover; o usuário
   alterou a decisão por causa do roadmap conversa → transcrição → widgets.
4. **CID completo.** Em vez de limitar o seed às 14 comorbidades, foi usado o
   snapshot hierárquico de 14.793 itens.
5. **Oito widgets portados, seleção ativa vazia.** O contrato técnico veio
   inteiro, mas nenhum conjunto foi declarado padrão antes da frente clínica.
6. **Memória/RAG recompiláveis e com IPC registrado.** “Esconder” ficou mais
   forte que somente conservar arquivos: basta recolocar a rota/menu para a
   superfície voltar, sem ligar nada no boot.
7. **Dois conectores cloud, um ativo por vez.** Gemini e OpenRouter foram
   mantidos por compatibilidade; não existe seleção automática, local ou tools.
8. **Nenhum dashboard clínico extra.** A home ficou neutra; construir painel de
   status agora anteciparia uma quinta superfície sem requisito.
9. **Contrato de fila explicitamente provisório.** Após o aviso de fronteira,
   nenhum tipo, estado, score, relógio, transição ou handler dessa superfície foi
   ampliado; a reconciliação com `codex/motor-fila-logica-v2` ficou registrada.
10. **Backup, manuais e seeds FlowKit legados removidos.** A spec não nomeava
    todos esses artefatos, mas eles ensinavam, restauravam ou semeavam apenas o
    produto herdado; mantê-los sugeriria contratos de operação e recuperação
    inexistentes no Antessala. `INVENTARIO.html` e `PLANO.html` foram preservados
    por serem fontes desta transição.
11. **Sobras visuais de outras bases removidas.** O manual de instalação dizia
    EscalaFlow e as propostas de ícone FlowKit/EscalaFlow não eram consumidas.
    Permaneceram somente `icon.png`, `icon.icns` e `icon.ico`, usados pelo build;
    uma identidade visual própria continua fora desta spec.

## Limites desta entrega

- Não define urgência, score, transições, relógios, espera ou ordenação.
- Não escolhe widgets clínicos específicos nem ativa templates.
- Não constrói as quatro telas finais.
- Não valida a licença de redistribuição dos datasets. Antes de publicar
  instaladores, CID/DATASUS, ANVISA e MET exigem revisão própria de licença.
- O extrator ad hoc que produziu os recortes iniciais não foi versionado; os
  snapshots atuais são íntegros pelos hashes, mas uma futura regeneração deve
  nascer com extrator reprodutível no repositório.
- As vulnerabilidades restantes precisam de uma campanha de atualização de
  dependências separada, com teste de regressão do Electron/PGlite.

## Git

O trabalho vive em `codex/preparar-ambiente-final`, com commits pequenos e PR
contra `main` de `nmarcofernandess/antessala`. Nenhum push foi feito na `main`.
