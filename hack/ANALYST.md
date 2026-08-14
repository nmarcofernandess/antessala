# ANALYST — índice canônico do Antessala

## Estado

- Documento analítico ativo: [analysis.md](analysis.md)
- Fonte congelável após assinatura: [PRD.md](PRD.md)
- Profundidade: `forensic`
- Estado de revisão: `INVALIDATED_BY_CHANGE`
- Tracker único: [`.context/review/STATUS.md`](../.context/review/STATUS.md)
- Transição formal: bloqueada até as assinaturas anteriores do Taskgen e do PRD, além da
  assinatura deste conjunto por Marco

Este arquivo é o índice estável para ferramentas e leitores que procuram
`hack/ANALYST.md`. A análise consolidada vive em `analysis.md`; os contratos completos
vivem nos oito dossiês abaixo. Nenhum Build pode compensar uma lacuna do Analyst.

## Sistema coberto

O pacote descreve a jornada inteira do MVP local:

```text
encaminhamento na recepção
→ coleta estruturada de enfermagem
→ requisito operacional QUICK | STANDARD | EXTENDED
→ reserva de vaga compatível
→ consulta com anestesiologista
→ pendência e retorno, quando necessários
→ resultado finalizado, versionado e corrigível sem overwrite
→ recebimento pelo serviço solicitante
```

Também fecha os domínios transversais sem os quais essa jornada não funciona: login
local, papéis e permissões, auditoria, cadastros, configurações, navegação, estados de UI,
persistência PGlite, fixtures, funcionamento offline, segurança, IA assistiva, memória
aprovada e prova ponta a ponta. “Descreve” não significa pesquisado, revisado ou aprovado.

## Dossiês e BUILDs correspondentes

| # | Domínio | Analyst canônico | BUILD correspondente |
|---:|---|---|---|
| 1 | Caso e encaminhamento | [ANALYST-caso-e-encaminhamento](domains/ANALYST-caso-e-encaminhamento.md) | [BUILD-caso-e-encaminhamento](domains/BUILD-caso-e-encaminhamento.md) |
| 2 | Acesso e auditoria | [ANALYST-acesso-e-auditoria](domains/ANALYST-acesso-e-auditoria.md) | [BUILD-acesso-e-auditoria](domains/BUILD-acesso-e-auditoria.md) |
| 3 | Anamnese e catálogos | [ANALYST-anamnese-e-catalogos](domains/ANALYST-anamnese-e-catalogos.md) | [BUILD-anamnese-e-catalogos](domains/BUILD-anamnese-e-catalogos.md) |
| 4 | Classificação e agenda | [ANALYST-classificacao-e-agenda](domains/ANALYST-classificacao-e-agenda.md) | [BUILD-classificacao-e-agenda](domains/BUILD-classificacao-e-agenda.md) |
| 5 | Avaliação, pendências e handoff | [ANALYST-avaliacao-pendencias-e-handoff](domains/ANALYST-avaliacao-pendencias-e-handoff.md) | [BUILD-avaliacao-pendencias-e-handoff](domains/BUILD-avaliacao-pendencias-e-handoff.md) |
| 6 | Superfícies e configurações | [ANALYST-superficies-e-configuracoes](domains/ANALYST-superficies-e-configuracoes.md) | [BUILD-superficies-e-configuracoes](domains/BUILD-superficies-e-configuracoes.md) |
| 7 | Arquitetura offline e prova | [ANALYST-arquitetura-offline-e-prova](domains/ANALYST-arquitetura-offline-e-prova.md) | [BUILD-arquitetura-offline-e-prova](domains/BUILD-arquitetura-offline-e-prova.md) |
| 8 | IA, memória e conhecimento | [ANALYST-ia-memoria-e-conhecimento](domains/ANALYST-ia-memoria-e-conhecimento.md) | [BUILD-ia-memoria-e-conhecimento](domains/BUILD-ia-memoria-e-conhecimento.md) |

Um dossiê responde o que o domínio significa e como se comporta. O BUILD de mesmo nome
traduz somente essas decisões em tabelas, DTOs, serviços, comandos, queries, componentes e
testes. BUILD não é Spec, Plan nem autorização para código.

## Leis globais estáveis

### Papéis

```text
ADMIN | RECEPCAO | ENFERMAGEM | ANESTESIOLOGISTA | SOLICITANTE
```

- Paciente e médico solicitante não autenticam no MVP.
- `ADMIN` administra a operação, mas não herda leitura clínica.
- `SOLICITANTE` enxerga somente pendências atribuídas e resultado/entrega do serviço ao
  qual sua conta está vinculada; não possui acompanhamento geral do caso.
- Autorização é aplicada no processo principal; esconder botão não é controle de acesso.
- Revogar conta, papel, serviço ou vínculo impede novo commit/resposta protegida e invalida
  projeções efêmeras sob a autoridade anterior.
- `RECEPCAO` opera status e entrega selada; não lê nem salva PDF clínico.
- Auditoria administrativa é sanitizada e append-only nas operações normais do app; não é
  promessa de inviolabilidade contra acesso direto ao dispositivo.

### Estado canônico do caso

```text
RECEIVED_AT_RECEPTION
→ WAITING_NURSING
→ NURSING_IN_PROGRESS ↔ TRIAGE_PENDING
→ READY_FOR_SCHEDULING
→ SCHEDULED
→ WAITING_ANESTHESIA
→ IN_ASSESSMENT
→ PENDING → IN_ASSESSMENT
          ↘ WAITING_RETURN → WAITING_ANESTHESIA → IN_ASSESSMENT
→ READY_FOR_HANDOFF
→ DELIVERED_TO_REQUESTER
```

`CANCELLED` é terminal e exige motivo. Os dossiês podem possuir estados internos próprios
para sessão, slot, reserva, revisão, encontro, pendência ou resultado; eles não substituem
o estado do caso.

Antes do encontro, `WAITING_ANESTHESIA` possui saídas explícitas: anulação de check-in volta
ao estado anterior; presença sem início devolve INITIAL ao agendamento ou reabre RETURN;
cancelamento terminal exige fato e motivo próprios.

Pendência não é sinônimo de bloqueio. Evidência submetida não é suficiência clínica, e
retorno não nasce automaticamente do último item respondido. Versões finalizadas são
imutáveis; correção, adendo ou supersessão criam sucessoras e preservam o histórico.

### Fronteiras

- A triagem geral do SUS termina antes do Antessala.
- O produto não diagnostica, não atribui ASA e não declara aptidão anestésica.
- A coleta de enfermagem subsidia, mas não substitui, a avaliação pré-anestésica do
  anestesiologista. Na demo, a conta que encerra a captura representa um enfermeiro;
  habilitação, delegação e supervisão reais continuam abertas à decisão institucional.
- Captura completa, informação resolvida, requisito operacional confirmado e avaliação
  médica concluída são marcos diferentes.
- `QUICK`, `STANDARD` e `EXTENDED` descrevem carga de consulta, não cor de pulseira,
  gravidade clínica ou prioridade cirúrgica.
- Um caso guarda um snapshot descartável da pessoa; não existe cadastro longitudinal de
  paciente, deduplicação por nome nem evolução entre casos.
- O serviço solicitante recebe o resultado; a marcação da cirurgia permanece externa.
- Todas as regras e pessoas da demonstração são sintéticas e não alegam reproduzir o HC.

## Matriz de suficiência do Analyst

| Pergunta que o código exigirá | Fonte que deve respondê-la |
|---|---|
| Quem entra, como entra e o que pode fazer? | acesso e auditoria |
| O que chega à recepção e qual identidade nasce? | caso e encaminhamento |
| Quais perguntas existem, campos, DTOs e completude? | anamnese e catálogos |
| Como a triagem vira requisito e como a vaga é reservada? | classificação e agenda |
| Como o anestesiologista conclui, pede algo e devolve? | avaliação, pendências e handoff |
| Quais telas, rotas, estados e configurações existem? | superfícies e configurações |
| Como persiste, funciona offline e prova o fluxo? | arquitetura offline e prova |
| Como IA propõe, humano confirma e conhecimento é promovido? | IA, memória e conhecimento |
| Como tudo se conecta? | `analysis.md` |

O estado autoritativo de pesquisa, recon e adversarial está somente no
[tracker](../.context/review/STATUS.md). Esta tabela mapeia ownership; não declara readiness.

## Gate semântico antes do BUILD formal

- [x] Oito domínios possuem Analyst e Build pareados; o novo Build de IA está explicitamente bloqueado.
- [ ] Alegações clínicas, regulatórias e operacionais passaram por pesquisa.
- [ ] Recon técnico distingue capacidade existente de arquitetura proposta.
- [ ] Cada domínio passou por adversarial e corrigiu seus achados.
- [ ] Analysts contêm semântica; detalhes físicos pertencem aos Builds.
- [ ] Surface Blueprints e reconstrução cega fecharam a experiência durante a fase Build.
- [ ] A síntese ponta a ponta foi reconciliada depois dessas correções.
- [ ] Marco assinou o Analyst consolidado e os oito dossiês.

## Ordem obrigatória

```text
PRD assinado
→ Analyst assinado
→ BUILD + Critic assinados
→ Warlog-base assinado
→ Sprints assinadas
→ Spec da minispec assinada
→ Plan assinado
→ primeiro teste TDD em RED
→ implementação
→ QA assinado
```

Os BUILDs de domínio foram redigidos por ordem direta para permitir revisão conjunta. Isso
não promoveu a fase, não criou Plan e não autorizou uma linha de implementação.

---

## Contrato de encerramento deste arquivo

- Artefato: `ANALYST.md`, `analysis.md` e oito `ANALYST-*.md`
- Próxima fase autorizada após assinatura: BUILD formal e Critic
- Estado: `INVALIDATED_BY_CHANGE`
- Assinatura de Marco: `PENDENTE`
- Data: `PENDENTE`
- Revisão Git examinada: `PENDENTE`
- Declaração: `PENDENTE`

Declaração exigida: “Aprovo o Analyst completo e autorizo o BUILD formal.”
