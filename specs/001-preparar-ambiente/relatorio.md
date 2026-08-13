# Relatório de execução — Spec 001

## Veredito

A preparação seguiu o **caminho B**: o fork do FlowKit foi podado diretamente, e do
Studio entraram apenas as peças genéricas úteis — editor rich text, contrato de contexto
da IA e simplificação conceitual da navegação/configurações.

O resultado desta etapa é uma casca Antessala menor, com primeiro boot desenhado para
usar somente dados locais e com o esqueleto clínico pronto. As quatro telas finais, a
escolha dos widgets/templates da triagem e o motor de ordenação da fila não foram
inventados aqui.

## Por que o caminho B venceu

A branch Studio não tinha merge-base útil com este fork. Aplicá-la inteira significaria
absorver **46.865 linhas adicionadas** para, logo depois, remover a maior parte. A leitura
do diff mostrou que aproximadamente **86,7%** da expansão era editorial ou ligada a
gravação/transcrição. Ela também ainda carregava `phaser`, Hugging Face, llama e MCP — ou
seja, não entregava por si só o boot magro e offline pedido.

As três partes genéricas desejáveis somavam cerca de **2.613 linhas** e tinham fronteiras
claras. O custo e o risco de copiar essas partes seletivamente eram menores que os de
integrar uma segunda árvore inteira sem ancestral comum e executar uma poda reversa.

## O que foi entregue

### Mapa e persistência clínica

- `mapa-esquemas.md` documenta o envelope `{ _v: 2, blocos: [...] }`, os oito widgets,
  catálogos e o corte estrutural de `patientId`.
- `registros` guarda nome, sexo, idade e plano na própria linha, mais anamnese JSONB.
- `registro_jornada` guarda marcos com horário e impede `UPDATE`/`DELETE`.
- Os seis estados do analyst foram declarados, sem transições ou ordenação.
- Não existe tabela de pacientes, FK, índice de deduplicação ou leitura por histórico.

### Widgets e encaixes

- Os oito contratos do DietFlow foram portados com tipos, defaults, validação,
  completude, serialização e `renderToText`.
- O composer/drawer e o JSX dos widgets foram refeitos com shadcn/ui.
- O registry técnico conhece os oito widgets, mas a seleção clínica e o catálogo ativo
  de templates estão vazios.
- `src/shared/extensions/catalogo-widgets.ts` aponta para
  `hack/specs/02-quais-widgets/`.
- `src/shared/extensions/motor-fila.ts` aponta para `specs/002-motor-da-fila/`.

### Dados clínicos locais

O bundle passa a trazer cinco snapshots versionados, com hash verificado no seed:

| Conteúdo | Quantidade | Tamanho do arquivo |
|---|---:|---:|
| CID-10 hierárquico completo | 14.793 | 624.180 bytes, gzip |
| Medicamentos | 382 | 83.058 bytes |
| Classes terapêuticas derivadas | 35 | carregadas dos medicamentos |
| Grupos de risco | 12 | 1.858 bytes |
| Atividades MET | 94 | 10.878 bytes |
| Comorbidades | 14 | 2.063 bytes |

São **15.330 linhas clínicas** após a carga. O primeiro boot lê os arquivos do checkout
ou de `clinical-data/` no bundle, valida seus hashes e carrega o PGlite em transação.
Não consulta o Postgres do DietFlow.

O classificador de risco e o parecer foram portados de JavaScript para TypeScript como
funções puras, preservando o comportamento da origem.

### Casca e integrações

- Rotas ativas reduzidas a Início, Assistente IA e Configurações.
- Menu sem destinos mortos e seletor claro/escuro/sistema sempre visível.
- Onboarding e painel herdado de “configure seu tema” removidos.
- IA reduzida a chamada cloud direta, sem tools, RAG, memória automática ou runtime
  local.
- Editor TipTap genérico e contrato de contexto com modos `global`, `adaptive` e
  `pinned`, escopos e orçamento de caracteres.
- Exportação HTML → PDF pelo `printToPDF` do Electron, em partição efêmera e com rede
  bloqueada.

## Removido versus escondido

| Situação | Peças | Motivo/condição |
|---|---|---|
| **Removido** | terminal, harness de shell e CLI | não têm função clínica e ampliavam a superfície de execução |
| **Removido** | MCP e tool-server HTTP | integração sem consumidor nesta etapa |
| **Removido** | cron | não existe trabalho periódico no produto atual |
| **Removido** | modelo local, llama.cpp, download e readiness local | eliminam GB, subprocessos e boot dependente de modelo |
| **Removido** | Maiá | outro produto e permissões de sistema desnecessárias |
| **Removido** | galeria | sem função clínica |
| **Removido** | onboarding/wizard herdado | a casca não precisa fingir configuração obrigatória |
| **Não importado** | editorial do Studio: aulas, cadernos, tradução, glossário e montador | o caminho B evitou introduzir outro produto para removê-lo depois |
| **Escondido** | Memória, RAG, knowledge graph e importadores | fonte preservada para a futura base científica, sem rota, menu ou boot |
| **Escondido** | gravação/STT | preservado para o roadmap de transcrição e autopreenchimento, sem rota, IPC, boot ou recurso de bundle ativo |

## Números

As medidas de `node_modules` usam `du -sk` e contagem de arquivos. O audit usa o lockfile
da respectiva medição.

| Medida | Antes | Após a poda atual | Variação |
|---|---:|---:|---:|
| `node_modules` | 2.043.256 KiB | 1.158.544 KiB | −884.712 KiB (−43,3%) |
| Arquivos em `node_modules` | 53.040 | 43.594 | −9.446 (−17,8%) |
| Vulnerabilidades `npm audit` | 51 | 40 | −11 |
| Baixas | 4 | 3 | −1 |
| Moderadas | 6 | 3 | −3 |
| Altas | 37 | 31 | −6 |
| Críticas | 4 | 3 | −1 |

`npm install` concluiu em **5,17 s** e não executou download de modelo de IA. As 40
vulnerabilidades restantes pertencem à árvore ainda instalada; este trabalho não usa
`npm audit fix --force`, porque ele alteraria versões e contratos fora do objetivo da
spec.

**TODO de fechamento:** repetir tamanho, contagem e audit no checkout/commit final para
selar os números contra o SHA entregue.

## Provas

| Critério | Estado | Evidência/pendência |
|---|---|---|
| Instalação sem download de modelo | **verde** | `npm install`, 5,17 s; nenhum script de modelo no lifecycle |
| `npm run typecheck` | **verde** | main e renderer concluíram sem erro após a poda |
| Seed clínico sem rede | **implementado, prova final pendente** | loader usa `readFileSync`; teste instrumentado bloqueia `fetch` |
| `npm test` completo | **TODO** | executar a suíte final e registrar quantidade de arquivos/testes removidos ou adaptados |
| `npm run build` | **TODO** | executar no SHA final |
| Primeiro boot com banco limpo | **TODO** | usar diretório temporário, observar ausência de conexão externa e registrar o seed |
| `npm run dev` / nome Antessala | **TODO** | abrir Electron real e registrar título/rota inicial |
| Menu e seletor de tema | **TODO de prova E2E** | contratos/implementação presentes; validar claro, escuro e sistema no Electron |
| Contagem final de testes | **TODO** | baseline: 409 passando e 4 ignorados; registrar resultado pós-remoção |
| PR contra `main` | **TODO** | criar somente após todas as provas e árvore limpa |

O Mac não será colocado fisicamente offline: isso derrubaria a própria sessão de
trabalho. Conforme autorizado pelo usuário, a prova de primeiro boot deve usar banco
novo e instrumentação/observação de tráfego para demonstrar **zero conexão externa**,
mantendo a rede da máquina disponível.

## O que quebrou e como foi resolvido

- A IA antiga importava tool families, discovery, readiness e runtime local. Ela foi
  substituída por um cliente cloud direto e por uma fronteira IPC menor.
- A remoção dos runtimes deixou o código escondido de Memória/RAG com referências
  antigas. Em vez de reescrever roadmap inativo, esses caminhos foram retirados dos
  `tsconfig` ativos; a dívida de reativação ficou explícita.
- Os testes herdados que provavam rotas removidas, CLI, terminal, MCP, Maiá, galeria e
  modelo local deixaram de representar o produto. Eles foram removidos; os testes da
  superfície ativa foram adaptados ou criados. O saldo final ainda depende do
  `npm test` completo indicado acima.
- O editor dos widgets precisava aceitar rascunhos numéricos transitórios sem desmontar
  o componente, e o drag-and-drop não podia atravessar blocos de snapshot/resultado.
  Esses dois limites foram corrigidos no porte.

## Divergências conscientes da spec

1. **Caminho B em vez do A.** A ausência de merge-base e a proporção editorial/STT do
   diff tornaram a integração integral do Studio mais cara e arriscada.
2. **Rede da máquina não desligada.** Decisão explícita do usuário; a prova será por
   instrumentação de boot, não por corte físico da conexão.
3. **STT preservado, mas dormente.** A spec original mandava remover; o usuário alterou a
   decisão por causa do roadmap de conversa → transcrição → autopreenchimento.
4. **CID completo.** Em vez de limitar o seed às 14 comorbidades já extraídas, foi usado
   o snapshot hierárquico de 14.793 itens do DietFlow. As 14 comorbidades permanecem como
   recorte do classificador, não como substituto do catálogo CID.
5. **Oito widgets portados, seleção ativa vazia.** O contrato técnico foi trazido por
   inteiro, mas nenhum conjunto foi declarado “padrão da triagem” e nenhum template foi
   ativado antes da entrega de `hack/specs/02-quais-widgets/`.
6. **Código escondido fora do typecheck ativo.** A spec dizia manter os arquivos; isso foi
   feito, mas compilar contratos dormentes obrigaria conservar runtimes removidos. A
   reativação terá de recolocar esses caminhos no gate.
7. **Nenhum dashboard clínico extra.** A home ficou neutra. Um painel de status pode ser
   útil quando as quatro telas existirem, mas construí-lo agora anteciparia produto sem
   requisito.
8. **Dois conectores cloud, um ativo por vez.** A IA foi simplificada para chamada direta,
   mas Gemini e OpenRouter foram mantidos por compatibilidade de configuração. Não há
   modelo local, roteador automático ou orquestração de tools.

## Limites desta entrega

- Não define urgência, score, transições válidas, cálculo de espera ou ordenação.
- Não escolhe os widgets clínicos específicos nem ativa templates.
- Não constrói as quatro telas finais.
- Não valida licença de redistribuição dos datasets; antes de publicar instaladores fora
  do projeto, CID/DATASUS, ANVISA e MET precisam de revisão própria de licença.
