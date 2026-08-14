# Antessala — instruções para agentes

Este arquivo é operacional. Não é fonte de produto.

## Antes de agir

1. Leia [`.context/manifest.yaml`](.context/manifest.yaml).
2. Leia [`hack/PRD.md`](hack/PRD.md).
3. Consulte [`hack/status.json`](hack/status.json),
   [`hack/progress.md`](hack/progress.md) e
   [`.context/review/STATUS.md`](.context/review/STATUS.md).
4. Leia [`hack/ANALYST.md`](hack/ANALYST.md) e o `ANALYST-*.md` dono da tarefa
   integralmente.
5. Se houver decisão técnica, leia o `BUILD-*.md` correspondente integralmente.
6. Use [`hack/analysis.md`](hack/analysis.md) e [`hack/BUILD.md`](hack/BUILD.md) como
   hubs de integração, nunca como substitutos dos contratos de domínio.
7. Prove o código do HEAD antes de afirmar capacidade existente.

Em conflito, pare, nomeie as fontes e corrija o owner. Nunca escolha silenciosamente.

## Produto

**Goal:** transformar a entrevista de enfermagem em uma necessidade operacional de agenda
compreensível pela recepção e acompanhar o caso até o resultado chegar ao serviço
solicitante.

```text
encaminhamento
→ recepção abre caso autônomo
→ enfermagem conduz anamnese
→ requisito operacional é sugerido
→ humano confirma ou altera
→ recepção agenda vaga compatível
→ anestesiologista avalia
→ pendências/retorno quando necessário
→ resultado e handoff
→ cirurgia continua externa
```

Leis:

- uma conta sintética integrada mostra todas as ferramentas;
- papéis são responsabilidades e autoria por ação, não cinco logins;
- cada encaminhamento é autônomo;
- não existe paciente longitudinal, `patientId`, deduplicação ou evolução;
- ausência de resposta não significa negativa;
- gravidade, urgência, prioridade e duração são eixos distintos;
- app não atribui ASA, aptidão ou conduta;
- primeiro boot e fluxo-base são offline;
- IA sugere; humano decide.

## Experiência obrigatória

- Anamnese: Composer no padrão DietFlow, 14 widgets pré-anestésicos, WidgetCards, DnD,
  teclado, drawer multi-select e protocolos salvos.
- Agenda: FullCalendar v6 portado/adaptado do DietFlow, mês/semana/dia/programação,
  dropdowns, busca/filtros, drawer, DnD/resize com validação no main e `revert()`.
- Compatibilidade: requisito operacional opaco/versionado; nunca ID de paciente.
- Assistente: somente `/assistente`; zero painel global, toggle no header ou IA em widget.
- User menu: Configurações, Claro/Escuro/Sistema, Amostra de uso e Sair.

DietFlow e EscalaFlow são doadores. Não transporte paciente, evolução, nutrição, agenda
longitudinal, Supabase ou regra de domínio sem adaptação explícita no Build Antessala.

## Arquitetura comprovada

O inventário vivo está em [`.context/architecture.yaml`](.context/architecture.yaml).
Resumo:

- Electron separa main, preload e renderer;
- PGlite persiste localmente;
- TIPC é a fronteira tipada; no renderer use `client['namespace.action'](input)`, não
  `.invoke()` manual;
- `src/shared/app-identity.ts` é a fonte de identidade;
- PDF usa `printToPDF` isolado;
- renderer bloqueia rede remota;
- Gemini opcional deve sair somente do main por ação explícita;
- o código atual não materializa ainda todo o produto documental.

## Regras de execução

1. Não invente regra clínica, SLA, score, relação ou fato hospitalar.
2. Renderer nunca fornece ator, responsabilidade, timestamp ou compatibilidade autoritativa.
3. Não crie fonte paralela para regra já possuída por um Analyst/Build.
4. Após review, corrija o owner e o tracker; não arquive resposta bruta.
5. Não escreva Warlog nesta lane. Outra IA fará isso após review final.
6. O Warlog deve ler os 16 contratos, não apenas os hubs, e pode ter cerca de mil tarefas.
7. Não existe Spec intermediária.
8. Não escreva código antes do Writing Plan da fatia e do primeiro teste TDD em RED.
9. Preserve mudanças alheias; prove worktree, branch, HEAD e árvore antes de editar.
10. Push não autoriza merge. Merge exige ordem explícita.

## Fluxo

```text
PRD aprovado
→ 8 Analysts + hub
→ 8 Builds + hub
→ review final independente
→ Warlog exaustivo
→ Writing Plan da fatia
→ TDD RED
→ implementação
→ QA
```

## Comandos

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm test
npm run test:e2e
```

Para docs: YAML/JSON válido, links locais, Mermaid e `git diff --check`. Não rode CI
pesado por mudança exclusivamente documental.
