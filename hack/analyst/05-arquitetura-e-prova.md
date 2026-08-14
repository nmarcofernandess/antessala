# Analyst 05 — Arquitetura e prova

**Estado:** `IN PROGRESS`
**Gate:** obrigatório para Build

## Arquitetura

O Analyst deve separar três horizontes:

1. demonstração no Mac com dados sintéticos;
2. possível piloto multiusuário;
3. produção institucional.

A arquitetura da demonstração não pode se apresentar como solução hospitalar concluída.

Definir para o protótipo:

- fonte de verdade;
- operações locais e dependências externas;
- persistência e recuperação;
- fronteiras entre interface, domínio e dados;
- contratos para futura integração;
- comportamento diante de indisponibilidade.

Reserva de agenda exige uma autoridade única. “Offline” não autoriza dois bancos a
confirmarem a mesma vaga.

## Reuso

Inventariar por arquivo ou conjunto:

| Origem | Copiar | Adaptar | Rejeitar | Dependências | Risco |
|---|---:|---:|---:|---|---|
| Antessala atual | a definir | a definir | a definir | a definir | a definir |
| DietFlow | a definir | a definir | a definir | a definir | a definir |
| EscalaFlow | a definir | a definir | a definir | a definir | a definir |

Avaliar especialmente widgets, agenda, autenticação, catálogos, exportação, validação de
capacidade e auditoria. Não portar um produto inteiro para aproveitar uma peça.

## Segurança e dados

Definir:

- dados exclusivamente sintéticos na demonstração;
- mínimo necessário por papel;
- sessão e computador compartilhado;
- autoria e auditoria;
- conteúdo de logs;
- exportação e impressão;
- retenção e exclusão;
- limites de qualquer alegação de LGPD ou homologação.

## Estratégia de prova

Enumerar antes do Build:

- testes de domínio e estados;
- contratos de DTO e widgets;
- regras e explicações;
- RBAC positivo e negativo;
- reserva atômica e idempotência;
- reclassificação;
- fluxo simples;
- fluxo com pendência e retorno;
- fluxo sem vaga;
- handoff final;
- primeiro boot e funcionamento local.

A demonstração deve provar que necessidades diferentes produzem tratamentos de agenda
diferentes. Três casos que terminam na mesma vaga não provam a promessa do produto.

## Saída exigida

- ADR da demonstração;
- fronteira de piloto e produção;
- inventário de reuso;
- política de segurança da demo;
- matriz de testes;
- roteiro de prova ponta a ponta;
- critérios objetivos para autorizar o Build.
