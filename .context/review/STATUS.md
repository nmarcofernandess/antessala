# Status único de pesquisa e review

Atualizado em `2026-08-14`. Este tracker registra maturidade e próxima ação; não cria gate
ou assinatura individual. Respostas brutas de GPT não são documentação canônica.

Estados: `INCORPORATED`, `REFERENCE_ONLY`, `NEEDS_FINAL_REVIEW`, `ADJUSTED`, `SUPERSEDED`.

| Artefato | Research/recon incorporado | Estado | Último SHA externo | Próxima ação |
|---|---|---|---|---|
| `hack/PRD.md` | fluxo e decisões de Marco | `INCORPORATED` | `9f501a9` | baseline aprovada; não alterar no hack |
| `hack/analysis.md` | oito Analysts reconciliados | `INCORPORATED` | `9f501a9` | participar do review final junto do BUILD |
| `ANALYST-caso-e-encaminhamento.md` | adversarial de 18 cenários | `REFERENCE_ONLY` | `9f501a9` | consultar como detalhe; `analysis.md` prevalece |
| `ANALYST-acesso-e-auditoria.md` | adversarial de 24 cenários | `REFERENCE_ONLY` | `9f501a9` | consultar como detalhe; `analysis.md` prevalece |
| `ANALYST-anamnese-e-catalogos.md` | research clínico-regulatório | `REFERENCE_ONLY` | `9f501a9` | limites institucionais permanecem fora da PoC |
| `ANALYST-classificacao-e-agenda.md` | research clínico-operacional | `REFERENCE_ONLY` | `9f501a9` | números permanecem `DEMO_DECISION` |
| `ANALYST-avaliacao-pendencias-e-handoff.md` | research clínico-documental | `REFERENCE_ONLY` | `9f501a9` | canais e custódia reais permanecem futuros |
| `ANALYST-superficies-e-configuracoes.md` | recon e catálogo de superfícies | `REFERENCE_ONLY` | `9f501a9` | contratos integrados no BUILD |
| `ANALYST-arquitetura-offline-e-prova.md` | recon Electron/PGlite | `REFERENCE_ONLY` | `9f501a9` | capacidade atual está em `.context/architecture.yaml` |
| `ANALYST-ia-memoria-e-conhecimento.md` | research regulatório e de segurança | `REFERENCE_ONLY` | `9f501a9` | Gemini sintético único; uso real fora do escopo |
| `hack/BUILD.md` | oito Builds reconciliados | `NEEDS_FINAL_REVIEW` | `9f501a9` | review final PRD → Analyst → BUILD no SHA publicado |
| `domains/BUILD-*.md` | contratos técnicos de detalhe | `REFERENCE_ONLY` | `9f501a9` | Writing Plans consultam sem superar `BUILD.md` |

## Decisões congeladas para a demonstração

- QUICK/STANDARD/EXTENDED e seus números são escolhas da demo, não protocolo do HC.
- Todas as pessoas, regras, relações, contas, serviços, procedimentos e casos são sintéticos.
- PGlite e troca sequencial de contas provam a PoC local, não operação hospitalar.
- Gemini é o único provedor-alvo e recebe somente fixture sintética por ação explícita.
- STT de 478 MB, embeddings e integração institucional não pertencem ao caminho crítico.
- Ausência de resposta nunca vira negativa; IA nunca aplica campo ou conhecimento sozinha.
- Aprovar conhecimento não o ativa; ativação é ação humana separada.
- `demo-workload-v1` possui matriz literal versionada; `desiredBy` é antecedência
  administrativa separada da duração.
- O review deve avaliar primeiro o perfil `PITCH_CRITICAL`; hardening posterior não pode
  ser confundido com bloqueio da demonstração nem usado para dispensar invariantes P0.

## Review final

O próximo review deve procurar somente incongruência material que impeça execução:

1. regra do PRD ausente ou contrariada no Analyst;
2. regra do Analyst sem contrato implementável no BUILD;
3. duas fontes canônicas para a mesma entidade, estado, ação ou tabela;
4. fluxo sem comando, ator, persistência, superfície ou prova;
5. decisão de demo apresentada como evidência clínica/institucional;
6. IA, rede ou memória com efeito automático ou dependência do fluxo offline;
7. Writing Plan obrigado a inventar produto ou arquitetura.

Achado P0 confirmado corrige o artefato canônico e repete o review. Sem P0, o estado do
BUILD muda para `READY_FOR_WARLOG`; então o Warlog é criado e corta as minispecs.
