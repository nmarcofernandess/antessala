# MiniSpec 001 — Contrato operacional

**Status:** `READY FOR DISCOVERY`

**Autorização atual:** pesquisa e consolidação de contrato

**Build de produto:** `PROIBIDO`

**Dono do gate:** [`../../ANALYST.md`](../../ANALYST.md)

---

## 1. Objetivo

Transformar a hipótese do [`../../PRD.md`](../../PRD.md) em um contrato operacional
verificável do pedido à realização da consulta pré-anestésica. Esta minispec entrega
evidência, decisões e limites; não entrega funcionalidade, schema, tela, widget, score ou
agenda.

O resultado precisa permitir que o Analyst responda, sem improvisar:

```text
quem faz
+ em qual sistema
+ com qual dado e identificador
+ em qual sequência
+ sob qual autoridade
+ para mudar qual propriedade do agendamento
```

---

## 2. Dependências

- autorização e participação de representantes reais da operação, anestesiologia,
  agendamento e TI;
- acesso autorizado a uma demonstração de caso e agenda sem dados identificáveis;
- briefing oficial e fontes institucionais já classificadas no PRD;
- gates G1–G8 e pendências do Analyst;
- decisões e evidências registradas no [`../../WARLOG.md`](../../WARLOG.md).

Se o acesso a uma prova mínima não existir, o item permanece **desconhecido ou
bloqueado**. Literatura, código legado e entrevista indireta não substituem a operação
real.

---

## 3. Dentro do escopo

1. Acompanhar uma sessão real, autorizada e anonimizada do evento que cria a solicitação
   até o resultado da consulta pré-anestésica.
2. Modelar o fluxo atual e um fluxo-alvo mínimo, separando fato observado de hipótese.
3. Validar um swimlane de atores, autoridades, handoffs e acessos.
4. Definir exatamente o que “agendamento semelhante” mantém igual hoje e por que dois
   casos deveriam receber tratamento diferente.
5. Mapear sistemas, telas, integrações disponíveis e identificadores de paciente,
   solicitação, procedimento, caso e agendamento.
6. Produzir dicionário de dados com origem, dono, instante, cardinalidade, estado de
   confiança, ausência, conflito e permissões.
7. Identificar catálogo de procedimentos, protocolos locais, autoria, versionamento,
   vigência e tratamento de condições específicas por procedimento.
8. Mapear agenda e capacidade: recursos, tipos de vaga, duração, modalidade, restrições,
   bloqueios, concorrência e resposta à falta de vaga.
9. Definir fixtures sintéticas rastreáveis para os casos que as próximas minispecs
   precisarão provar.
10. Classificar cada contrato legado como manter, adaptar, migrar, desativar ou remover.
11. Medir o baseline disponível ou registrar formalmente sua indisponibilidade e adotar
    apenas oráculos determinísticos para a demo.

---

## 4. Fora do escopo

- alterar código de produto, banco, migrations, rotas, navegação ou configuração;
- implementar fixtures no runtime;
- escolher ou desenhar interface final;
- definir campos, papéis, durações, cores ou estados sem evidência;
- portar widget, protocolo, score, classificador ou parecer clínico;
- escolher FullCalendar ou construir calendário;
- simular integração sem marcá-la como mock;
- coletar, copiar ou versionar dado pessoal ou clínico real no repositório;
- declarar metas de eficiência sem baseline.

---

## 5. Entregáveis obrigatórios

| ID | Entregável | Prova mínima |
|---|---|---|
| E1 | Registro da sessão ponta a ponta | tela/formulário ou relato de screen-share autorizado, sem identificadores, com ator e data |
| E2 | Fluxo atual e fluxo-alvo mínimo | estados, transições, exceções e evento que cria/encerra o caso |
| E3 | Swimlane e matriz ação × dado | validação por representantes dos setores; funções acumuladas ou separadas explícitas |
| E4 | Definição de “agendamento semelhante” | agenda anonimizada de uma semana, tipos de vaga e dois casos contrastantes |
| E5 | Mapa de sistemas e identificadores | origem, destino, chave canônica, integração real ou interface humana |
| E6 | Dicionário de dados | conceito, campo, fonte, dono, tipo, unidade, tempo, confiança, ausência, conflito e acesso |
| E7 | Contrato de procedimento e protocolo | catálogo, dono clínico, versão, vigência, composição de perguntas e rollback |
| E8 | Contrato de agenda e capacidade | papel A/B/C do Build, recursos, restrições, concorrência e falta de capacidade |
| E9 | Catálogo de fixtures sintéticas | caso nominal, origem sintética, variação relevante e resultado esperado ainda sem código |
| E10 | Mapa de migração do legado | consumidor, semântica antiga, ação, dependência, risco e rollback |
| E11 | Baseline ou declaração de ausência | fonte, período, definição e limite de uso; sem transportar números de outro fluxo |

Os artefatos de decisão são consolidados no Analyst; racional, divergência, fonte e
estado entram de forma append-only no Warlog. Não criar outro PRD, analysis, relatório ou
plano geral.

---

## 6. Critérios de aceite

- [ ] G1–G8 possuem resposta sustentada e decisão explícita; nenhuma lacuna bloqueante
      permanece aberta ou mascarada como fato.
- [ ] A sessão real, o swimlane, a agenda observada e os dois casos contrastantes são
      rastreáveis a fonte, data, papel e forma de validação.
- [ ] “Risco”, “complexidade”, “prioridade”, “esforço”, “recurso”, “modalidade” e
      “prontidão” não são usados como sinônimos.
- [ ] O papel do Antessala perante a agenda foi decidido entre A, B ou C do Build.
- [ ] Cada dado possui origem, dono, regra temporal, estados ausentes e acesso permitido.
- [ ] O catálogo/protocolo de procedimento possui estratégia real; CID e medicamentos
      não foram tratados como solução completa.
- [ ] Fixtures cobrem ao menos ausência, conflito de fontes, mudança de procedimento,
      necessidades distintas e falta de capacidade, sem dado real.
- [ ] Todos os contratos provisórios do código e branches em quarentena aparecem no mapa
      de migração, sem integração por impulso.
- [ ] Baseline indisponível está declarado como tal; não existem percentuais inventados.
- [ ] Nenhum arquivo de produto foi alterado por esta minispec.
- [ ] Analyst e Warlog contêm as decisões e evidências consolidadas.

---

## 7. Gate de saída

Concluir os entregáveis não libera build automaticamente. A saída válida é um veredito
explícito no Analyst:

- `PASS MINISPEC 001`, acompanhado do contrato aprovado e dos bloqueios residuais; ou
- `BLOCKED`, com pergunta, evidência faltante, responsável esperado e impacto.

O Analyst avalia separadamente os requisitos de entrada das MiniSpecs 002 e 003. Um
`PASS` de descoberta não autoriza antecipar nenhuma delas.
