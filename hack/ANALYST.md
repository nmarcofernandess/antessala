# ANALYST — Índice dos contratos de domínio

## Papel deste arquivo

Este arquivo é um hub. Ele não contém a verdade completa de nenhum domínio e não autoriza
implementação. A fonte semântica é sempre o `ANALYST-*` correspondente em `hack/domains/`.
Se o hub e um contrato de domínio divergirem, o trabalho para e a divergência é corrigida no
artefato canônico; ninguém escolhe silenciosamente o texto mais conveniente.

O PRD aprovado define problema, promessa e leis globais. Os Analysts de domínio definem
entidades semânticas, estados, atores, responsabilidades, regras, falhas e proibições. O
arquivo [analysis.md](analysis.md) integra apenas as fronteiras e o fluxo ponta a ponta.

## Ordem de leitura

1. [PRD.md](PRD.md)
2. [.context/manifest.yaml](../.context/manifest.yaml)
3. este índice
4. todos os Analysts de domínio relacionados à fatia — integralmente
5. [analysis.md](analysis.md), apenas para dependências e fluxo global
6. Builds correspondentes e [BUILD.md](BUILD.md)
7. [tracker único](../.context/review/STATUS.md)

## Contratos canônicos

| Domínio | Analyst canônico | O que fecha |
|---|---|---|
| Acesso e auditoria | [ANALYST-acesso-e-auditoria.md](domains/ANALYST-acesso-e-auditoria.md) | conta integrada da demo, responsabilidades por ação, projeções, escopo e auditoria |
| Caso e encaminhamento | [ANALYST-caso-e-encaminhamento.md](domains/ANALYST-caso-e-encaminhamento.md) | caso autônomo, snapshots, handoffs e lifecycle |
| Anamnese e catálogos | [ANALYST-anamnese-e-catalogos.md](domains/ANALYST-anamnese-e-catalogos.md) | Composer, 14 widgets, respostas semânticas, protocolos e catálogos |
| Classificação e agenda | [ANALYST-classificacao-e-agenda.md](domains/ANALYST-classificacao-e-agenda.md) | requisito operacional versionado, compatibilidade, capacidade e agenda |
| Avaliação, pendências e handoff | [ANALYST-avaliacao-pendencias-e-handoff.md](domains/ANALYST-avaliacao-pendencias-e-handoff.md) | consulta anestésica, pendências, retorno, resultado e entrega |
| Superfícies e configurações | [ANALYST-superficies-e-configuracoes.md](domains/ANALYST-superficies-e-configuracoes.md) | navegação integrada, trabalhos por tela, estados e limites de informação |
| Arquitetura offline e prova | [ANALYST-arquitetura-offline-e-prova.md](domains/ANALYST-arquitetura-offline-e-prova.md) | boot local, fronteiras Electron, rede opcional e prova |
| IA, memória e conhecimento | [ANALYST-ia-memoria-e-conhecimento.md](domains/ANALYST-ia-memoria-e-conhecimento.md) | Assistente isolado, proposta humana, conhecimento versionado e Gemini explícito |

## Decisões transversais vigentes

- A demonstração usa uma conta integrada. Os cinco papéis continuam sendo
  responsabilidades funcionais e autoria de ação, não cinco logins.
- O menu lateral expõe o fluxo inteiro. O dropdown do usuário oferece Configurações, tema
  Claro/Escuro/Sistema, Amostra de uso e Sair.
- Não existe paciente longitudinal, `patientId`, deduplicação por pessoa nem evolução entre
  encaminhamentos.
- A identidade que determina compatibilidade de agenda é o requisito operacional
  versionado (`schedulingRequirementId`), nunca um ID de paciente.
- A agenda porta e adapta a experiência FullCalendar do DietFlow; regras nutricionais,
  histórico de paciente e entidades doadoras não atravessam.
- A anamnese porta e adapta o Composer do DietFlow com 14 widgets pré-anestésicos,
  WidgetCards, DnD, drawer multi-select e protocolos salvos.
- IA fica em `/assistente`. Não existe painel global nem IA dentro de widget, agenda ou
  header. Toda saída continua rascunho até decisão humana.
- Primeiro boot e fluxo-base funcionam offline. Gemini é opcional, explícito e dispensável.

## Contrato para o futuro Warlog

Este repositório não possui Warlog nesta fase. Outra IA o produzirá somente depois do review
final de congruência.

O Warlog futuro deve:

1. ler os oito Analysts e os oito Builds integralmente;
2. decompor cada MUST, regra, estado, campo, ação, falha, teste, acessibilidade e caso de
   escala em trabalho rastreável;
3. registrar, para cada item, os arquivos e as seções de origem;
4. não criar tarefa baseada apenas neste hub, em `analysis.md` ou em `BUILD.md`;
5. aceitar centenas ou milhares de itens quando isso for necessário para cobrir o contrato;
6. provar cobertura reversa: toda linha normativa dos contratos de domínio precisa apontar
   para ao menos uma tarefa, prova ou exclusão consciente;
7. cortar fatias verticais somente depois dessa matriz de cobertura;
8. gerar Writing Plans por fatia, sem Spec intermediária.

## Estado

- PRD: aprovado por Marco.
- Analysts individuais: contratos canônicos sem gate individual.
- Síntese: hub em reconciliação final.
- Build integrado: não autoriza código antes do review final de congruência.
- Warlog, Writing Plans e implementação: inexistentes/bloqueados.
