# Progresso — Antessala

## Estado atual

- PRD: aprovado por Marco.
- Oito Analysts: contratos canônicos de domínio, sem gate individual.
- Oito Builds: contratos canônicos de domínio, sem gate individual.
- `ANALYST.md`, `analysis.md` e `BUILD.md`: hubs; não superam os owners.
- Fase: reconciliação documental concluindo validações internas.
- Review final independente: ainda não executado sobre estas mudanças.
- Warlog: inexistente e reservado a outra IA.
- Código: bloqueado até Warlog, Writing Plan da fatia e TDD RED.

## Reconciliação desta rodada

- [x] Uma conta sintética integrada substituiu a troca entre cinco logins.
- [x] Papéis permaneceram como responsabilidades, projeção e autoria por ação.
- [x] Sidebar expõe o fluxo completo; user menu inclui Configurações, três temas, Amostra
      de uso e Sair.
- [x] “Tipo de paciente ID” foi formalizado como requisito operacional opaco/versionado,
      nunca `patientId`.
- [x] Agenda simplificada foi substituída pelo contrato de port/adaptação do FullCalendar
      do DietFlow, com quatro visões, dropdowns, drawer, DnD/resize e reversão.
- [x] Anamnese foi fechada no padrão Composer do DietFlow com 14 widgets, WidgetCards, DnD,
      drawer multi-select e protocolos salvos.
- [x] Assistente foi isolado em `/assistente`; zero painel global ou IA dentro de widget.
- [x] Cada arquivo de domínio foi promovido a owner; os hubs foram reduzidos a mapas.
- [x] Contrato do futuro Warlog exige leitura dos 16 contratos e rastreabilidade exaustiva.
- [x] Não foi criado Warlog, Spec, Writing Plan ou código de produto.
- [ ] Validações documentais finais desta árvore.
- [ ] Commit e publicação do SHA.
- [ ] Review final independente do SHA publicado.
- [ ] Warlog exaustivo por outra IA.
- [ ] Writing Plans, TDD, implementação e QA.

## Fluxo operacional

```text
PRD aprovado
→ oito Analysts + hubs
→ oito Builds + hub
→ review final independente
→ outra IA cria Warlog exaustivo
→ Warlog corta fatias verticais
→ writing-plan.md da fatia
→ primeiro teste TDD em RED
→ implementação
→ QA
```

Não existe `spec.md` por fatia. O Writing Plan consome PRD, os contracts de domínio e o
Warlog. Hubs nunca dispensam a leitura integral do owner.

## Próxima ação exata

Validar e publicar esta reconciliação. Em seguida, entregar ao reviewer independente a
branch, o SHA e um prompt que exija leitura do PRD, dos 16 contratos e dos três hubs. Sem
incongruência material, outra IA cria o Warlog e só depois os Writing Plans.
