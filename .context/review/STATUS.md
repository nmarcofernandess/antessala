# Status único de pesquisa e review

Atualizado em `2026-08-14`. Este é o único tracker de readiness documental do
Antessala. `hack/status.json` controla fases e assinaturas; não replica esta matriz.

Estados permitidos: `NOT_REVIEWED`, `RESEARCH_REQUIRED`, `RECON_REQUIRED`,
`ADVERSARIAL_REQUIRED`, `IN_REVIEW`, `ADJUSTED`, `READY_FOR_MARCO`,
`APPROVED_BY_MARCO`, `INVALIDATED_BY_CHANGE`.

| Artefato | Pesquisa web | Recon técnico | Adversarial | Estado | Último SHA revisado | Próxima ação |
|---|---|---|---|---|---|---|
| `hack/ANALYST.md` | `RESEARCH_REQUIRED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `7b8cdc4` | Reconciliar somente depois dos oito Analysts. |
| `hack/analysis.md` | `RESEARCH_REQUIRED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `7b8cdc4` | Ressintetizar depois das rodadas dos oito domínios; a integração de IA ainda é provisória. |
| `ANALYST-caso-e-encaminhamento.md` | `NOT_REVIEWED` | `RECON_REQUIRED` | `ADJUSTED` | `ADVERSARIAL_REQUIRED` | `9f501a9` | Repetir os 18 cenários após reconciliar anamnese, agenda, avaliação, acesso, IA e superfícies. |
| `ANALYST-acesso-e-auditoria.md` | `NOT_REVIEWED` | `RECON_REQUIRED` | `ADJUSTED` | `ADVERSARIAL_REQUIRED` | `9f501a9` | Repetir os 24 cenários após reconciliar caso, avaliação, superfícies, arquitetura e IA. |
| `ANALYST-anamnese-e-catalogos.md` | `IN_REVIEW` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `RESEARCH_REQUIRED` | `9f501a9` | Validar licenças e protocolo local; repetir casos clínico-semânticos no SHA corrigido com review multiprofissional. |
| `ANALYST-classificacao-e-agenda.md` | `ADJUSTED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `ADVERSARIAL_REQUIRED` | `9f501a9` | Atacar abstenção da regra, supersessão, redaction, retorno e falhas de capacidade após reconciliar a criticidade campo a campo da anamnese. |
| `ANALYST-avaliacao-pendencias-e-handoff.md` | `ADJUSTED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `ADVERSARIAL_REQUIRED` | `9f501a9` | Repetir os 25 cenários; resolver custódia, assinatura, documentos, correção substituta e canal institucional. |
| `ANALYST-superficies-e-configuracoes.md` | `NOT_REVIEWED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `7b8cdc4` | Compor IA/memória somente após os contratos dos domínios. |
| `ANALYST-arquitetura-offline-e-prova.md` | `NOT_REVIEWED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `RECON_REQUIRED` | `7b8cdc4` | Reconciliar com `.context/architecture.yaml` e política de rede opcional. |
| `ANALYST-ia-memoria-e-conhecimento.md` | `RESEARCH_REQUIRED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `RESEARCH_REQUIRED` | `7b8cdc4` | Pesquisar privacidade, consentimento, proveniência e promoção de conhecimento. |
| `hack/BUILD.md` | `RESEARCH_REQUIRED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `7b8cdc4` | Ressintetizar somente depois dos oito pares e Surface Blueprints. |
| `BUILD-caso-e-encaminhamento.md` | `RESEARCH_REQUIRED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `7b8cdc4` | Aguardar novo adversarial e assinatura do Analyst; depois refazer contratos físicos. |
| `BUILD-acesso-e-auditoria.md` | `RESEARCH_REQUIRED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `7b8cdc4` | Aguardar novo adversarial e assinatura do Analyst; depois refazer fronteira física. |
| `BUILD-anamnese-e-catalogos.md` | `RESEARCH_REQUIRED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `9f501a9` | Refazer somente após Analyst pesquisado, adversarial verde e assinatura de Marco. |
| `BUILD-classificacao-e-agenda.md` | `RESEARCH_REQUIRED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `7b8cdc4` | Aguardar Analyst corrigido, adversarial e assinatura; depois reconciliar contratos físicos e provar o PGlite. |
| `BUILD-avaliacao-pendencias-e-handoff.md` | `ADJUSTED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `9f501a9` | Não remendar: reescrever depois do Analyst assinado, incluindo suficiência, versões, documentos, retorno e handoff local/externo. |
| `BUILD-superficies-e-configuracoes.md` | `NOT_REVIEWED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `7b8cdc4` | Corrigir após os domínios; então criar Surface Blueprints. |
| `BUILD-arquitetura-offline-e-prova.md` | `RESEARCH_REQUIRED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `INVALIDATED_BY_CHANGE` | `7b8cdc4` | Refazer política IPC/rede/IA e provar o runtime PGlite. |
| `BUILD-ia-memoria-e-conhecimento.md` | `RESEARCH_REQUIRED` | `RECON_REQUIRED` | `ADVERSARIAL_REQUIRED` | `RESEARCH_REQUIRED` | `7b8cdc4` | Permanecer DRAFT/BLOCKED até o Analyst fechar e Marco assinar. |

## Como atualizar

1. Publique branch, SHA e artefato para research ou adversarial.
2. Trate a resposta externa como material de trabalho, nunca como fonte canônica.
3. Verifique as fontes e corrija o artefato canônico.
4. Registre aqui o SHA revisado, a data e a próxima ação.
5. Use `PRODUCT_LAW`, `EVIDENCE_BACKED`, `DEMO_DECISION` ou `UNRESOLVED` dentro do artefato.
6. Mudança material volta o estado para `INVALIDATED_BY_CHANGE`.

## Próxima rodada

Próximo gate deste domínio: review adversarial de semântica clínica, competência
profissional e fatores humanos sobre o SHA corrigido de
`hack/domains/ANALYST-anamnese-e-catalogos.md`.

Research de classificação/agenda recebido e incorporado: as fontes sustentam variabilidade
e calibração local, não os números do motor. O artefato segue para adversarial somente após
a criticidade campo a campo da anamnese ser reconciliada.

Adversarial de caso/encaminhamento incorporado: referência externa deixou de bloquear caso,
corridas e impacto de correção foram fechados, revisão pré-publicação ganhou invalidação,
check-in ganhou recuperação e o solicitante foi restrito a pendência própria e resultado.
O artefato continua `ADVERSARIAL_REQUIRED` até repetir os 18 cenários no novo SHA.

Adversarial de acesso/RBAC incorporado: revogação em voo, último admin concorrente,
não interferência por serviço, auditoria allowlisted, limite append-only, erro opaco,
capabilities de IA e fronteiras de arquivo/cloud/PDF foram fechados semanticamente. O
artefato continua `ADVERSARIAL_REQUIRED` até repetir os 24 cenários no novo SHA.

Research clínico-regulatório de anamnese incorporado: estado de valor foi separado de
ausência, `NOT_PERFORMED` entrou, encerramento da captura deixou de significar informação
resolvida, FINAL ficou corrigível por versão vinculada, campos de julgamento clínico foram
retirados ou rebaixados e catálogos foram assumidos como recortes. O domínio continua
`RESEARCH_REQUIRED` por protocolo local, competências, licenças e review multiprofissional.

Research clínico-documental de avaliação incorporado: pendência ganhou impacto explícito,
evidência submetida foi separada de suficiência, retorno virou nova decisão, recibo sem
conteúdo deixou de alegar verificabilidade, resultado ganhou versões sucessoras e handoff
local deixou de fingir envio externo. O Analyst continua `ADVERSARIAL_REQUIRED` até
repetir os 25 cenários e as lacunas institucionais continuam sem resposta inventada. O
Build descendente foi invalidado integralmente.

Nenhum estado nesta página substitui assinatura. Somente Marco pode produzir
`APPROVED_BY_MARCO`.

---

## Contrato de encerramento

- Artefato: `.context/review/STATUS.md`.
- Gate: definido em `hack/status.json` e `hack/CONTRATO-DE-APROVACAO.md`.
- Estado: `EM_REVISÃO`.
- Assinatura de Marco: `PENDENTE`.
- Data, revisão Git e declaração: `PENDENTES`.

Sem assinatura válida, este tracker não promove fase nem autoriza implementação.
