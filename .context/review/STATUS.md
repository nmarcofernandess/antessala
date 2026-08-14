# Status único de pesquisa e review

Atualizado em `2026-08-14`. Respostas brutas de GPT são material de trabalho; somente o
artefato canônico corrigido e este tracker permanecem no repositório.

Estados permitidos: `NOT_REVIEWED`, `RESEARCH_REQUIRED`, `RECON_REQUIRED`,
`ADVERSARIAL_REQUIRED`, `IN_REVIEW`, `ADJUSTED`, `READY_FOR_MARCO`,
`APPROVED_BY_MARCO`, `INVALIDATED_BY_CHANGE`.

| Artefato | Pesquisa web | Recon técnico | Adversarial | Estado | Último SHA revisado | Próxima ação |
|---|---|---|---|---|---|---|
| `hack/PRD.md` | incorporada no baseline | N/A | concluído no ciclo anterior | `APPROVED_BY_MARCO` | `— (emenda direta de Marco; sem review independente)` | revisar apenas congruência, sem reabrir produto |
| `hack/ANALYST.md` | N/A | N/A | invalidado pela nova hierarquia | `IN_REVIEW` | `— (estado atual sem review independente)` | review final como índice, não fonte |
| `hack/analysis.md` | consome owners | consome owners | invalidado pela nova sessão/UX | `IN_REVIEW` | `— (estado atual sem review independente)` | review final das fronteiras entre os oito domínios |
| `ANALYST-acesso-e-auditoria.md` | N/A | parcial | rodada anterior incorporada | `INVALIDATED_BY_CHANGE` | `9f501a9` | atacar sessão integrada e autoria por responsabilidade |
| `ANALYST-caso-e-encaminhamento.md` | não bloqueante para leis de Marco | parcial | rodada anterior incorporada | `ADVERSARIAL_REQUIRED` | `9f501a9` | confirmar que nenhum fluxo reintroduziu paciente/dedup |
| `ANALYST-anamnese-e-catalogos.md` | rodada clínica incorporada parcialmente | donor recon incorporado | invalidado pelo Composer/protocolos completos | `IN_REVIEW` | `— (estado atual sem review independente)` | revisar 14 widgets, protocolos, DnD e fronteira IA |
| `ANALYST-classificacao-e-agenda.md` | rodada operacional incorporada | donor recon incorporado | invalidado pela agenda FullCalendar | `IN_REVIEW` | `— (estado atual sem review independente)` | revisar requisito ID, compatibilidade e UX portada |
| `ANALYST-avaliacao-pendencias-e-handoff.md` | rodada clínica incorporada parcialmente | parcial | rodada anterior incorporada | `ADVERSARIAL_REQUIRED` | `9f501a9` | validar handoffs com sessão integrada sem mudar domínio |
| `ANALYST-superficies-e-configuracoes.md` | N/A | renderer e donors reconciliados | invalidado pelo shell integrado | `IN_REVIEW` | `— (estado atual sem review independente)` | revisar cobertura de todas as telas e estados |
| `ANALYST-arquitetura-offline-e-prova.md` | N/A | atualizado parcialmente | invalidado pela conta integrada/Assistente | `RECON_REQUIRED` | `— (estado atual sem review independente)` | confrontar texto com HEAD após publicação |
| `ANALYST-ia-memoria-e-conhecimento.md` | rodada externa incorporada | parcial | invalidado pela rota isolada | `IN_REVIEW` | `— (estado atual sem review independente)` | revisar `/assistente`, propostas e conhecimento sem burocracia nova |
| `hack/BUILD.md` | N/A | consome owners | invalidado pela nova hierarquia | `IN_REVIEW` | `— (estado atual sem review independente)` | review final como hub técnico, sem usar como fonte exclusiva |
| `BUILD-acesso-e-auditoria.md` | N/A | proposto sobre HEAD | invalidado pela sessão integrada | `IN_REVIEW` | `— (estado atual sem review independente)` | conferir action authority e fixture única |
| `BUILD-caso-e-encaminhamento.md` | N/A | proposto sobre HEAD | rodada anterior incorporada | `ADVERSARIAL_REQUIRED` | `9f501a9` | revisar apenas integração com sessão/requisito |
| `BUILD-anamnese-e-catalogos.md` | N/A | donor recon incorporado | invalidado pelo contrato completo de UX | `IN_REVIEW` | `— (estado atual sem review independente)` | conferir DTOs/DB/Composer/protocolos/testes |
| `BUILD-classificacao-e-agenda.md` | N/A | donor recon incorporado | invalidado pelo FullCalendar portado | `IN_REVIEW` | `— (estado atual sem review independente)` | conferir packages, adapters, DnD/revert e ID opaco |
| `BUILD-avaliacao-pendencias-e-handoff.md` | N/A | proposto sobre HEAD | rodada anterior incorporada | `ADVERSARIAL_REQUIRED` | `9f501a9` | revisar integração física e resultado versionado |
| `BUILD-superficies-e-configuracoes.md` | N/A | renderer/donors reconciliados | invalidado pelo shell integrado | `IN_REVIEW` | `— (estado atual sem review independente)` | confirmar rotas, user menu e zero IA global |
| `BUILD-arquitetura-offline-e-prova.md` | N/A | precisa refresh no novo HEAD | invalidado pela conta/Assistente | `RECON_REQUIRED` | `— (estado atual sem review independente)` | atualizar evidência técnica sem prometer implementação |
| `BUILD-ia-memoria-e-conhecimento.md` | rodada incorporada | parcial | invalidado pela rota isolada | `IN_REVIEW` | `— (estado atual sem review independente)` | conferir Gemini único, proposal operation e ausência de painel |

## Decisões de demonstração, não evidência institucional

- Uma conta integrada mostra todas as ferramentas; os papéis são responsabilidades por ação.
- QUICK/STANDARD/EXTENDED, durações, buffers, sinais e horizonte são fixtures versionadas.
- O “tipo de paciente ID” é um requisito operacional opaco e versionado; nunca `patientId`.
- FullCalendar e Composer são padrões portados/adaptados do DietFlow, não suas entidades
  nutricionais nem seu histórico longitudinal.
- Gemini é o único provedor da demonstração e fica em `/assistente`.
- Pessoas, serviços, procedimentos, casos, relações e amostras são sintéticos.

## Gate único antes do Warlog

O próximo reviewer independente precisa ler PRD, os oito Analysts, os oito Builds e os três
hubs. Ele procura apenas incongruência material capaz de quebrar o fluxo, criar duas fontes,
obrigar Writing Plan a inventar contrato ou impedir decomposição exaustiva.

Sem P0 confirmado, este tracker pode marcar os artefatos ajustados e liberar o Warlog. O
Warlog será produzido por outra IA, lerá os 16 contratos e poderá gerar centenas ou milhares
de tarefas. Não existe Warlog, Spec ou Writing Plan nesta árvore agora.
