# Writing plan — MiniSpec 002 · Triagem e decisão humana

**Status:** `BLOCKED`

**Este arquivo não é autorização de build.**

---

## Passo 0 · Checar o gate e parar sem `PASS`

1. Ler o veredito vigente do [`../../ANALYST.md`](../../ANALYST.md).
2. Exigir a frase `PASS MINISPEC 002` e o contrato completo no formato obrigatório de
   `PASS`.
3. Confirmar que a MiniSpec 001 foi concluída e que seu SHA/evidência estão registrados.
4. Conferir se identidade, papéis, P0, protocolos, limite do motor, fixtures e migração
   estão decididos.

Sem qualquer um desses itens, **PARAR**. Não criar branch de implementação, schema,
componente, teste-placeholder ou “fundação neutra”.

## Passo 1 · Congelar o corte aprovado

1. Traduzir cada decisão do Analyst em entrada, saída, ator, estado, regra temporal,
   fixture e critério de aceite.
2. Listar os arquivos legados afetados e a ação aprovada para cada um.
3. Delimitar explicitamente tudo que pertence à agenda e ficará fora.
4. Registrar no Warlog qualquer divergência descoberta antes de codar.

**Saída:** checklist de implementação vinculado ao `PASS`; lacuna encontrada devolve o
sprint ao Analyst.

## Passo 2 · Escrever contratos e testes de domínio

1. Materializar tipos/schemas aprovados para caso, fatos, protocolo, avaliação, revisão e
   auditoria.
2. Escrever testes para estados válidos e impossíveis, ausência, conflito, mudança de
   procedimento, versionamento e permissão.
3. Usar somente as fixtures sintéticas aprovadas e marcar sua origem.
4. Provar que nenhum contrato incorpora slot, agenda ou classe inventada.

**Saída:** testes inicialmente falhando pelo comportamento ainda ausente.

## Passo 3 · Implementar persistência e migração

1. Criar migrations determinísticas para o agregado aprovado.
2. Implementar persistência append-only onde o contrato exigir versão/auditoria.
3. Aplicar a matriz manter/adaptar/migrar/desativar/remover sem remendar
   `registro_jornada` no novo fluxo.
4. Provar instalação limpa, migração e rollback da demo.

**Saída:** banco coerente com o contrato, sem vínculo por nome e sem dados reais.

## Passo 4 · Implementar catálogos, protocolos e coleta P0

1. Versionar apenas catálogos e protocolos aprovados.
2. Compor perguntas/widgets P0 pelo protocolo do procedimento.
3. Implementar validação, proveniência, temporalidade, ausência e conflito.
4. Refazer JSX necessário com os componentes do app; não copiar HeroUI do DietFlow.
5. Testar troca de procedimento e compatibilidade de respostas anteriores.

**Saída:** coleta estruturada aprovada, sem regra clínica escondida no componente.

## Passo 5 · Implementar avaliação explicável

1. Implementar regras como funções puras e versionadas.
2. Associar cada saída às entradas e à regra que a produziu.
3. Rejeitar regra sem versão, dono ou contrato de dado.
4. Transformar ausência e conflito em pendência explícita.
5. Garantir que nenhuma saída se apresente como aptidão, conduta ou ASA final não
   aprovados.

**Saída:** sugestão determinística dentro do limite autorizado.

## Passo 6 · Implementar revisão humana e auditoria

1. Exibir ao papel autorizado fatos, pendências, regras e incertezas necessárias.
2. Permitir confirmar, corrigir ou rejeitar; exigir motivo conforme contrato.
3. Preservar sugestão original, decisão, ator, instante e versão.
4. Restringir o resumo operacional ao mínimo necessário para o próximo papel.
5. Testar acesso negado e tentativa de transição inválida.

**Saída:** decisão humana auditável, ainda sem procurar vaga.

## Passo 7 · Integrar a jornada aprovada sem agenda

1. Conectar intake, coleta, avaliação e revisão nas superfícies dos papéis confirmados.
2. Manter mocks e fixtures visivelmente identificados.
3. Expor o requisito operacional aprovado como saída, sem ordenar casos ou alocar slots.
4. Remover rotas/textos do produto invalidado somente conforme a matriz de migração.

**Saída:** fluxo reproduzível da solicitação ao requisito revisado.

## Passo 8 · Provar e fechar

1. Rodar testes de contrato, migração, regras, permissões e fluxos aprovados.
2. Rodar typecheck, suíte proporcional, build e prova visual no SHA final.
3. Confirmar primeiro boot local e ausência de integração não declarada.
4. Atualizar Analyst com provas e Warlog com SHA, divergências e decisões.
5. Pedir revisão do Analyst para a conclusão do sprint e, separadamente, para o gate da
   MiniSpec 003.

Sem `PASS MINISPEC 003`, **PARAR**. Não iniciar calendário, adaptador ou agenda.
