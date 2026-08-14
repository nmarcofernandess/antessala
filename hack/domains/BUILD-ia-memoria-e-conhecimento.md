# Build — IA, memória e conhecimento

## State

- Estado: `DRAFT`.
- Bloqueios: `BLOCKED_BY_ANALYST_RESEARCH`, `BLOCKED_BY_ANALYST_SIGNATURE`.
- `AUTHORIZA_IMPLEMENTACAO = NÃO`.
- Natureza: recon técnico e agenda de decisões físicas; não é blueprint fechado.
- Analyst de origem:
  [ANALYST-ia-memoria-e-conhecimento.md](ANALYST-ia-memoria-e-conhecimento.md).
- Assinatura de Marco no Analyst: `PENDENTE`.
- Assinatura de Marco neste Build: `PENDENTE`.

## Propósito deste rascunho

O projeto pareia cada Analyst com um Build. Este arquivo mantém o pareamento sem fingir que
as respostas físicas já existem. Ele registra somente:

1. capacidades comprovadas no HEAD;
2. incompatibilidades entre o legado e o novo contrato;
3. restrições que já vêm das leis do produto;
4. perguntas que o Build deverá fechar depois da pesquisa e assinatura.

Não há escolha canônica de tabela, migration, DTO, canal TIPC, serviço, componente, modelo,
provedor, retenção ou arquivo-alvo neste estado.

## Fontes consumidas

- `hack/PRD.md` — fronteiras gerais da prova, ainda sem o contrato deste domínio.
- `hack/domains/ANALYST-ia-memoria-e-conhecimento.md` — `RESEARCH_REQUIRED`.
- `hack/domains/ANALYST-acesso-e-auditoria.md` — atores e fronteira de confiança.
- `hack/domains/ANALYST-anamnese-e-catalogos.md` — respostas semânticas e proveniência.
- `hack/domains/ANALYST-classificacao-e-agenda.md` — requisito operacional e autoridade humana.
- `hack/domains/ANALYST-arquitetura-offline-e-prova.md` — boot e fluxo-base offline.
- Código do HEAD citado na matriz abaixo.

## Terreno comprovado no HEAD

| Capacidade | Estado real | Evidência |
|---|---|---|
| Chat cloud genérico | `ATIVO`, fora do caso clínico | `/ia` e painel lateral estão montados em `src/renderer/src/App.tsx:13-55`; envio usa `src/main/ia/cliente.ts`. |
| Configuração de provedor | `ATIVA`, inadequada para segredo clínico | Token/modelo persistem em `configuracao_ia` (`src/main/db/schema.ts:14-24`) e handlers salvam token (`src/main/tipc.ts:61-103`). |
| Egress cloud do main | `ATIVO` por ação de chat/teste | Gemini/OpenRouter são chamados em `src/main/ia/cliente.ts:52-107`; Gemini fica habilitado por padrão em `src/main/config/app-config.ts:34-43`. |
| Conversas e mensagens | `ATIVAS`, sem vínculo com caso | Tabelas em `src/main/db/schema.ts:133-163`; handlers em `src/main/tipc.ts:131-262`. |
| Memória de texto livre | Handler `ATIVO`, superfície sem rota | `dormantKnowledgeRouter` é espalhado no router ativo em `src/main/tipc.ts:373-390`; `MemoriaPagina` não aparece em `App.tsx`. |
| RAG/importadores/grafo | Handlers `ATIVOS`, UI principal dormente, contrato não clínico | Canais em `src/main/knowledge/router.ts:546-582`; tabelas em `src/main/db/schema.ts:31-126`. |
| Embeddings | `DORMENTE` sem adaptador | Sem adapter, funções retornam `null` e busca textual permanece disponível (`src/main/knowledge/embeddings.ts:1-79`). |
| Captura de áudio | Componente `DORMENTE` | `FlowSpeechInput` grava WAV, mas o input ativo é somente texto (`FlowSpeechInput.tsx:14-66`; `IaChatInput.tsx:14-55`). |
| STT local | `INCOMPLETO` | Main possui catálogo, download e sidecar, mas `ia.stt.*` não está no router ativo (`src/main/stt/*`; `src/main/tipc.ts:373-409`). |
| Modelo STT | Opcional e externo | Catálogo aponta para artefato de 478 MB (`src/main/stt/catalog.ts:8-24`); download usa `fetch` explícito (`src/main/stt/download.ts:51-79`). |
| Preload | `ATIVO`, amplo | Expõe `invoke(channel: string)` genérico (`src/preload/index.ts:1-17`). |
| Propostas por campo | `INEXISTENTE` | Não há contrato que ligue transcript, widget, origem e decisão humana. |
| Relação aprovada/versionada | `INEXISTENTE` | `knowledge_relations` guarda arestas e vigência, mas não aprovação, versão, justificativa ou auditoria clínica (`src/main/db/schema.ts:105-126`). |

Os nomes “dormant” no código não são prova de inatividade: os handlers de conhecimento são
registrados pelo spread no router. Qualquer Build futuro precisa provar rota, router, egress
e consumidores separadamente.

## Gap entre legado e produto

| Legado | Por que não satisfaz o Analyst |
|---|---|
| Chat livre | Não conhece caso, widgets, responsabilidades, fontes por campo nem confirmação individual. |
| `ia_memorias` com texto livre | Não distingue caso, exemplo e regra; não tem revisão, aprovação, versão ou desativação clínica. |
| Importação automática de conversas | Pode promover narrativa e identidade sem decisão explícita; é proibida até reconciliação. |
| Grafo extraído por LLM | Relação inferida pode ser persistida sem o lifecycle humano exigido. |
| `peso` da relação | Não representa evidência, validade clínica nem autoridade para decidir. |
| Token no PGlite | Não fecha segredo, escopo, redaction, rotação ou acesso administrativo. |
| STT baixável | Não pode baixar 478 MB no primeiro boot nem virar dependência do fluxo-base. |
| Painel global de IA | Facilita enviar conteúdo clínico sem contexto, minimização ou explicação de rede. |
| Memória automática configurável | Contraria a proibição de promoção implícita de casos para memória global. |

Nenhuma tabela ou handler legado é declarado canônico por este rascunho. Reuso exige
adaptação comprovada; nome semelhante não basta.

## Restrições físicas já obrigatórias

Estas restrições decorrem de leis do produto e não dependem da escolha de arquitetura:

1. Boot, caso, agenda, avaliação, PDF e handoff não dependem de IA nem rede.
2. Não existe download automático de modelo no primeiro boot.
3. O renderer não acessa PGlite, segredo ou arquivo clínico diretamente.
4. Todo conteúdo cloud sai somente após ação explícita e confirmação informada.
5. Toda saída da IA persiste, se persistir, como `DRAFT` até ação humana autorizada.
6. Caso, exemplo e regra global têm storage/lifecycle separados ou separação equivalente
   comprovável; nunca compartilham estado implícito.
7. Somente relações aprovadas e ativas entram na recuperação operacional.
8. Proposta por campo preserva origem, versão de entrada, modelo e decisão humana.
9. Recepção, solicitante e admin não recebem conteúdo clínico deste domínio por padrão.
10. Mutação e recibo de decisão humana são atômicos no main.
11. Conteúdo clínico e segredos ficam fora de logs, erros públicos, auditoria e exportação.
12. Fallback manual funciona quando microfone, STT, embeddings, provedor ou rede falham.

## Decisões físicas bloqueadas

| Área | O que falta no Analyst/research | O que o Build deverá definir depois |
|---|---|---|
| Consentimento | Texto, base legal, revogação e retenção. | Persistência, lifecycle, UI e prova do recibo. |
| Áudio | Política de retenção e STT permitido. | Limites, formato, diretório temporário, descarte e isolamento. |
| Transcript | Retenção, correção e acesso por papel. | Schema físico, versionamento, DTOs e transações. |
| Propostas de campo | Campos/widgets demonstrados e explicação mínima. | Schema, parser estrito, canais, serviço e write atômico. |
| Resumo assistivo | Sinais permitidos e fronteira com o motor de agenda. | Entrada/saída física e composição sem duplicar classificação. |
| Relações | Taxonomia mínima, aprovador e fontes aceitas. | Modelo de versionamento, constraints, consulta e desativação. |
| Exemplos | Critério de promoção e de-identificação. | Separação física, validação e auditoria. |
| RAG/grafo | Fontes, ranking, conflitos e fallback. | Índice, query, filtros de estado e projeção de proveniência. |
| Embeddings | Necessidade, provider, licença e tamanho. | Adapter, armazenamento, rebuild e modo textual. |
| Cloud | Provedor, política de dados e segredo. | Cofre local, egress allowlist, minimização e envelopes de erro. |
| Permissões | Aprovação final dos papéis/capabilities. | Guards no main e DTOs redigidos por papel. |
| Auditoria | Conteúdo seguro versus proibido. | Eventos, sanitização, atomicidade e testes negativos. |
| Superfícies | Trabalho e momento exatos em cada tela. | Surface Blueprints na fase correta; não criar agora. |
| Migração | Destino das tabelas e conversas legadas. | Estratégia expand-only, compatibilidade e contenção. |

## Fronteiras com outros Builds

- **Acesso e auditoria** é owner de sessão, papel, capability, guard e ledger; este Build
  apenas consome.
- **Anamnese e catálogos** é owner do schema de widgets e estados de resposta; a IA propõe,
  nunca redefine.
- **Classificação e agenda** é owner do requisito operacional; o resumo assistivo não cria
  segundo motor.
- **Avaliação e handoff** é owner do resultado e pendências; transcript não vira laudo.
- **Superfícies** define onde cada trabalho aparece depois dos contratos físicos.
- **Arquitetura offline** é owner da política global de boot, router, rede e prova negativa.

Divergência entre owners retorna ao Analyst; este Build não resolve conflito silenciosamente.

## Arquitetura a decidir após desbloqueio

O Build definitivo deverá fechar, sem deixar valores implícitos:

- migrations e ownership de cada entidade;
- DTOs discriminados e validação runtime para transcript, proposta, decisão e relação;
- channels TIPC allowlisted e matriz ator × ação × estado;
- serviços e fronteiras transacionais;
- estratégia de redaction e armazenamento de segredo;
- política de egress do processo main e indicação no renderer;
- lifecycle de áudio, transcript, proposta, exemplo e relação;
- consulta textual/RAG/grafo e comportamento sem embeddings;
- integração exata com widgets e requirement sem escrita direta da IA;
- componentes compartilhados e Surface Blueprints somente na fase de Build;
- fixtures sintéticas e provas de 0, 1, conflito, indisponibilidade e 1.000 relações;
- rollout/containment do chat, memória e importadores herdados.

## Provas que o Build definitivo deverá tornar executáveis

1. Boot e fluxo-base com todo egress bloqueado.
2. Chamada opcional mostra disclosure e não acontece ao cancelar.
3. Proposta fora do schema não produz write.
4. Aceite, correção e rejeição por campo preservam autoria e origem.
5. Mudança de transcript/schema invalida proposta pendente.
6. Caso não aparece em busca de memória nem em outro caso.
7. Relação sugerida fica fora do índice ativo até promoção humana.
8. Nova versão não reescreve casos antigos; desativação preserva auditoria.
9. Busca vazia/conflitante não produz conclusão.
10. Papel proibido recebe `FORBIDDEN` sem payload protegido.
11. Falha de STT/cloud/embedding mantém o caminho manual.
12. Logs, auditoria, PDF e erros não contêm segredo ou conteúdo clínico proibido.
13. Nenhum modelo grande é baixado no boot.
14. Uma prova sintética executa um uso real de IA e um uso real de memória aprovada.

Esta lista define resultados, não nomes de testes ou arquivos; o Plan só poderá fazê-lo após
Build e Critic assinados.

## Riscos abertos

| Risco | Severidade | Estado |
|---|---|---|
| Dado clínico sair pelo main apesar da policy do renderer | Crítica | `UNRESOLVED`; requer egress allowlist e prova do processo inteiro. |
| Caso virar memória por processamento herdado | Crítica | `UNRESOLVED`; conter auto-indexação antes de reuso. |
| Relação inferida ganhar aparência de protocolo | Crítica | `UNRESOLVED`; lifecycle humano e rotulagem obrigatórios. |
| Token persistido em texto recuperável | Alta | `UNRESOLVED`; storage seguro precisa de decisão. |
| Prompt injection em transcript/fonte | Alta | `UNRESOLVED`; ameaça e parser estrito precisam de research/adversarial. |
| Áudio sobreviver ao descarte prometido | Alta | `UNRESOLVED`; lifecycle e prova negativa precisam ser fechados. |
| Modelo local inflar pacote ou iniciar download | Alta | `UNRESOLVED`; estratégia de distribuição precisa de decisão. |
| Chat global capturar contexto indevido | Alta | `CONFIRMADO`; superfície ativa atual não é reutilizável como está. |
| Embeddings ausentes degradarem silenciosamente | Média | `CONFIRMADO`; modo textual deve ser explícito e testado. |

## Critérios para retirar os bloqueios

Este Build só pode ser completado quando:

- [ ] o tracker registrar pesquisa e adversarial do Analyst;
- [ ] todas as perguntas obrigatórias para a demo estiverem resolvidas ou delimitadas;
- [ ] Marco assinar o Analyst;
- [ ] o recon técnico for atualizado contra o SHA de implementação pretendido;
- [ ] os owners dos outros domínios aceitarem as fronteiras;
- [ ] o Build físico completo passar pelo Critic;
- [ ] Marco assinar este Build.

Somente depois podem existir Warlog, MiniSpec, Spec, Plan e primeiro teste TDD em `RED`.

## Contrato de encerramento deste arquivo

- Artefato: `hack/domains/BUILD-ia-memoria-e-conhecimento.md`.
- Estado: `DRAFT`.
- Bloqueios: `BLOCKED_BY_ANALYST_RESEARCH`, `BLOCKED_BY_ANALYST_SIGNATURE`.
- Contrato físico: `NÃO_FECHADO`.
- `AUTHORIZA_IMPLEMENTACAO = NÃO`.
- Assinatura de Marco no Analyst: `PENDENTE`.
- Assinatura de Marco neste Build: `PENDENTE`.
- Data: `PENDENTE`.
- Revisão Git examinada: `PENDENTE`.
- Declaração: `PENDENTE`.

Declaração futura exigida: “Aprovo o Build de IA, memória e conhecimento e autorizo sua
revisão pelo Critic; nenhuma fase posterior pode saltar o fluxo forense.”

Sem a pesquisa e as duas assinaturas, este arquivo é somente um rascunho de recon e nenhuma
linha de código está autorizada.
