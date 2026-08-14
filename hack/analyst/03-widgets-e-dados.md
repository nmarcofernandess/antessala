# Analyst 03 — Widgets e dados

**Estado:** `IN PROGRESS`
**Gate:** obrigatório para Build

## Objetivo

Fechar todos os dados necessários à triagem, à agenda e à avaliação. Nenhum widget entra
porque “parece clínico”; nenhum campo consumido por uma regra pode ficar sem origem.

## Contrato obrigatório por widget

Cada widget deve declarar:

- ID e versão;
- objetivo e responsável;
- DTO completo;
- tipos, unidades e opções;
- obrigatoriedade e condições de exibição;
- representação de `não`, `não sei`, `não se aplica`, `não perguntado` e recusa;
- proveniência e horário da coleta;
- validação, defaults, vazio e completude;
- resumo para enfermagem, anestesiologista, recepção e exportação;
- regra consumidora e efeito possível;
- migração de versão;
- testes de contrato.

## Inventário a fechar

### Núcleo provável

- contexto do procedimento;
- problemas de saúde;
- medicações;
- alergias;
- cardiovascular;
- respiratório;
- capacidade funcional;
- histórico anestésico;
- sangramento e trombose;
- mudança clínica recente;
- hábitos e substâncias;
- condições especiais;
- observações;
- sinais vitais, se aferidos na triagem.

### Condicionais a decidir

- sono e apneia;
- digestivo e aspiração;
- via aérea autorreferida;
- exames;
- perguntas específicas por procedimento;
- logística e comunicação;
- demais widgets já portados no Antessala.

## Catálogos

Auditar fonte, cobertura, licença, versão, busca, sinônimos e fallback de:

- procedimentos;
- CID/diagnósticos;
- medicamentos, princípios ativos e classes;
- alergias;
- exames;
- especialidades;
- tipos de anestesia e recursos, se usados.

CID e medicamentos não substituem contexto clínico. O Analyst deve garantir que controle
da doença, sintomas atuais, capacidade funcional, histórico anestésico e contexto do
procedimento sejam representados quando consumidos.

## Matriz a completar

| Widget/campo | Fonte | Owner | DTO | Obrigatório | Regra consumidora | Saída afetada | Visibilidade | Teste |
|---|---|---|---|---|---|---|---|---|

## Saída exigida

- catálogo final de widgets;
- DTO de cada widget;
- matriz campo → regra → saída;
- auditoria dos catálogos;
- modelo de perguntas condicionais por procedimento;
- lista de lacunas e decisão para cada uma.
