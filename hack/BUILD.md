# BUILD — plano mestre do Antessala

**Estado:** `BLOCKED BY ANALYST`
**Execução liberada:** nenhuma minispec
**Quantidade máxima de sprints:** 3
**Última revisão:** 14/08/2026

---

## 0. Contrato do Build

Este é o único plano mestre de construção. Ele organiza dependências, cortes e provas;
não possui autoridade para preencher lacunas do [`ANALYST.md`](ANALYST.md).

Cada sprint vive numa minispec com exatamente dois arquivos:

```text
spec.md          → contrato do que precisa ser verdade
writing-plan.md  → sequência executável depois do PASS do Analyst
```

O writing plan pode existir como rascunho bloqueado. Só vira ordem de execução quando o
Analyst registrar `PASS` para a minispec. Descoberta, entrevistas, inventários e ADRs são
trabalho interno do Analyst; não consomem um dos três sprints de build.

---

## 1. Objetivo da construção

Demonstrar, com casos sintéticos e fronteiras honestas, que uma solicitação de consulta
pré-anestésica pode ser qualificada antes da alocação para produzir requisitos de agenda
diferentes e explicáveis, sob decisão humana.

O produto construído precisa preservar esta causalidade:

```text
paciente + procedimento + dados com origem
→ fatos, ausências, conflitos e pendências
→ avaliação/revisão humana
→ prioridade + esforço + recurso + prontidão
→ recomendação ou alocação compatível
→ auditoria da decisão
```

Não existe build válido se a cadeia começar por uma tela ou biblioteca.

---

## 2. Estado do repositório

### 2.1 Fundação aproveitável

- aplicação Electron com React, shadcn/ui e Tailwind;
- banco PGlite embarcado e IPC tipado;
- primeiro boot local sem download de modelo;
- contratos de anamnese versionados e composer;
- oito widgets técnicos portados do DietFlow;
- CID-10, medicamentos, classes, MET e recortes clínicos locais;
- exportação PDF;
- testes Vitest e Playwright;
- IA cloud opcional, memória/RAG e STT dormentes.

### 2.2 Legado sem autoridade

O código atual contém schema, handlers e tipos construídos para pessoa descartável,
jornada no mesmo dia e fila por urgência/espera. Essas peças não serão removidas ou
adaptadas antes do contrato aprovado pelo Analyst, mas também não serão importadas por novas
features.

### 2.3 Branches que não entram por merge

- `codex/motor-fila-logica-v2` e `codex/motor-da-fila-resume`: motor da antiga fila;
- `origin/hack/02-quais-widgets`: catálogo preso aos antigos invariantes;
- `origin/zan/widgets`: pesquisa parcialmente útil misturada a rotas e tempos propostos.

Reuso dessas branches é por seleção consciente de ideia, dado ou teste — nunca merge ou
cherry-pick em bloco.

---

## 3. Princípios técnicos do build

1. **Caso, não fila física.** A unidade é o caso pré-anestésico associado a paciente e
   procedimento.
2. **Múltiplos eixos.** Prioridade, risco, complexidade, esforço, modalidade, recurso e
   prontidão não viram uma cor única.
3. **Ausência é dado.** Campo ausente, desconhecido, não aplicável, recusado e conflitante
   têm semânticas diferentes.
4. **Origem e tempo.** Todo fato clínico relevante carrega fonte e instante de validade.
5. **Procedimento muda a avaliação.** O mesmo paciente para procedimentos diferentes
   pode exigir perguntas e capacidade diferentes.
6. **Widget captura; protocolo interpreta.** Regras não ficam escondidas no JSX.
7. **Humano decide.** Sugestão automatizada nunca se disfarça de decisão clínica.
8. **Agenda não fabrica recurso.** Sem capacidade compatível, o sistema expõe o gargalo.
9. **Mock visível.** Integração simulada é marcada na interface, fixture e documentação.
10. **Offline é propriedade da demo.** Não é decisão de arquitetura hospitalar.
11. **Sem meta inventada.** Critério de demo é determinístico; KPI clínico depende de
    baseline.
12. **Migração consciente.** Código legado só muda depois do mapa de consumidores e de
    uma decisão de compatibilidade.

---

## 4. Modelo de domínio provisório

Os nomes abaixo organizam a investigação. Não autorizam schema até o Analyst aprovar.

```text
PatientReference
  identidade institucional ou sintética da demo

ProcedureRequest
  solicitação de avaliação ligada a um procedimento proposto

PreAnestheticCase
  agregado da solicitação, coleta, avaliações, pendências e decisão operacional

ClinicalFact
  valor + origem + data + estado de confiança

ProcedureDefinition
  código e atributos do procedimento vindos de fonte aprovada

ProcedureProtocolVersion
  composição versionada de perguntas, regras, pendências e requisitos

AssessmentVersion
  resultado explicável do conjunto de regras, sem apagar versões anteriores

HumanReview
  confirmação, correção ou rejeição assinada com motivo

SchedulingRequirement
  prioridade, esforço, recurso, modalidade, janela e prontidão separadas

CapacitySlot / Appointment
  somente se o produto for dono de agenda; caso contrário, contrato de exportação

AuditEvent
  ator, ação, objeto, instante, origem e versão
```

### 4.1 Invariantes candidatos

- Um caso sem procedimento identificável não recebe requisito final de agenda.
- Um dado ausente nunca assume valor normal.
- Troca de procedimento invalida ou recalcula somente o que depende dele.
- Publicar nova versão de protocolo não reescreve decisões passadas.
- Revisão humana preserva sugestão original e motivo da divergência.
- Regulação vê o necessário para agendar, não o prontuário inteiro.
- Nenhum agendamento incompatível é persistido silenciosamente.

O Analyst confirma, corrige ou remove cada invariante antes do `PASS MINISPEC 001`.

---

## 5. Arquitetura alvo em camadas

```text
Fonte/entrada
  solicitação sintética, formulário ou integração mockada
        ↓
Caso pré-anestésico
  identidade, procedimento, proveniência e versões
        ↓
Coleta estruturada
  widgets/perguntas definidos por protocolo
        ↓
Avaliação explicável
  fatos, ausências, conflitos, regras e pendências
        ↓
Revisão humana
  decisão, override, motivo e auditoria
        ↓
Tradução operacional
  prioridade, esforço, recurso, modalidade e prontidão
        ↓
Agenda ou adaptador
  alocação compatível ou declaração de falta de capacidade
```

Cada seta terá um contrato testável. Camada clínica não importa React; camada de agenda
não lê detalhes clínicos que não participem da decisão operacional.

---

## 6. Os três sprints

### Sprint 001 · Caso, triagem e classificação

**Objetivo:** construir o caso pré-anestésico, a coleta aprovada, a avaliação explicável
e a revisão humana que produzem um requisito operacional auditável.

Entregas candidatas, todas sujeitas ao `PASS MINISPEC 001`:

- persistência/migração de paciente-referência, solicitação, caso e procedimento;
- autenticação e RBAC mínimos dos papéis confirmados;
- intake e composição versionada de perguntas/widgets P0;
- proveniência, ausência, conflito e temporalidade;
- régua aprovada, pendências e explicação;
- revisão/override humano;
- resumo operacional mínimo e auditoria;
- fixtures e migração do legado.

**Não entrega:** agenda, vaga, booking ou decisão clínica além do limite aprovado.

Arquivos:

- [`spec.md`](minispecs/001-caso-triagem-classificacao/spec.md)
- [`writing-plan.md`](minispecs/001-caso-triagem-classificacao/writing-plan.md)

### Sprint 002 · Capacidade, agenda e booking

**Objetivo:** traduzir o requisito revisado em capacidade compatível e realizar somente
o caminho A, B ou C aprovado pelo Analyst.

Entregas candidatas, sujeitas aos Sprints 001 e ao `PASS MINISPEC 002`:

- contrato executável de `SchedulingRequirement` e compatibilidade;
- adaptador de handoff, agenda demonstrativa mínima ou integração contratada;
- recursos, disponibilidade, slots e restrições aprovados;
- atomicidade/idempotência e proteção contra conflito, quando houver booking;
- alocação compatível e resposta explícita à falta de capacidade;
- superfícies mínimas de agendamento e explicação da decisão;
- fixtures de contraste, controle negativo e concorrência.

Arquivos:

- [`spec.md`](minispecs/002-capacidade-agenda-booking/spec.md)
- [`writing-plan.md`](minispecs/002-capacidade-agenda-booking/writing-plan.md)

### Sprint 003 · Handoff e prova final

**Objetivo:** fechar o final real da promessa e provar o fluxo end-to-end sem inventar
uma consulta, laudo ou planejamento que a descoberta não tenha colocado no produto.

Entregas candidatas, sujeitas ao `PASS MINISPEC 003`:

- handoff confirmado ao papel/sistema seguinte;
- consulta e retorno ao serviço cirúrgico somente se estiverem dentro da fronteira
  validada;
- estados finais, reabertura, cancelamento e auditoria aprovados;
- exportação/documento apenas quando houver finalidade e destino;
- cenários simples, complexos, ausentes, conflitantes, sem capacidade e com falha;
- prova automatizada e visual das superfícies finais;
- comparação honesta entre tratamento indiferenciado e diferenciado.

Arquivos:

- [`spec.md`](minispecs/003-handoff-prova-final/spec.md)
- [`writing-plan.md`](minispecs/003-handoff-prova-final/writing-plan.md)

---

## 7. Decisão sobre calendário

O Analyst precisa escolher uma destas classes antes do `PASS MINISPEC 002`:

### A · O produto somente qualifica a solicitação

Saída é um `SchedulingRequirement` entregue a sistema externo ou operado manualmente.
Não se constrói calendário; a demo mostra capacidade fictícia apenas para provar o
contrato.

### B · O produto mantém agenda demonstrativa

Precisa persistir recursos, disponibilidade, slots e alocações. A biblioteca visual é
escolhida depois de provar:

- suporte aos recursos e restrições necessários;
- comportamento com duração variável;
- acessibilidade e navegação por teclado;
- licença para hack e eventual produção;
- tamanho no bundle Electron;
- testabilidade sem browser frágil;
- aderência aos componentes já existentes.

Comparar FullCalendar, padrão de agenda do DietFlow e grade própria pequena. Nenhuma
opção vence por familiaridade.

### C · O produto integra com agenda institucional

Exige contrato real da TI. Sem API ou exportação confirmada, a integração fica fora do
build e é representada por adaptador mockado.

---

## 8. Estratégia de dados e migração

O Analyst deve produzir uma matriz para cada tabela/contrato atual:

| Ação | Quando usar |
|---|---|
| manter | semântica continua válida |
| adaptar | conceito sobrevive com contrato diferente |
| migrar | dado existente precisa de novo agregado |
| desativar | código fica sem consumidor durante o hack |
| remover | conceito pertence exclusivamente ao produto invalidado |

Regras:

- não chamar `registros` de paciente institucional;
- não conectar casos por nome;
- não portar `prioridade 1..4` para o novo domínio sem fonte;
- não converter `registro_jornada` em workflow novo por remendo;
- preservar compatibilidade do envelope de anamnese apenas se o novo contrato permitir;
- banco da demo pode ser recriado, mas migrations e fixtures precisam ser determinísticas.

---

## 9. Estratégia de testes

### Contrato

- schemas rejeitam estados impossíveis e distinguem ausente/desconhecido;
- regras são puras, determinísticas e versionadas;
- mesmo paciente + procedimento diferente pode gerar requisito diferente;
- protocolo antigo continua explicando avaliação antiga;
- override não apaga sugestão original.

### Segurança clínica

- dado ausente produz pendência;
- conflito de fontes permanece visível;
- medicamento nunca produz ordem automática não aprovada;
- regra sem versão/dono não carrega;
- papel não autorizado não acessa dado clínico.

### Agenda

- alocação incompatível falha;
- concorrência não duplica slot;
- falta de capacidade é resposta de domínio;
- remarcação/cancelamento só entram se o Analyst os aprovar;
- regra de duração e recurso possui oráculo claro.

### Demonstração

- fixtures sintéticas identificadas;
- fluxo completo reproduzível;
- nenhuma rede necessária no primeiro boot;
- integrações mockadas visíveis;
- typecheck, testes e build verdes no SHA entregue;
- prova visual das superfícies finais aprovadas.

---

## 10. Definition of Ready

Uma tarefa só entra no writing plan executável quando possui:

- vínculo com capacidade do PRD;
- `PASS` do Analyst;
- ator e permissão;
- entrada, saída e origem dos dados;
- estados válidos/invalidos;
- regra temporal;
- fixture;
- critério de aceite;
- impacto no legado;
- dependências e caminho de rollback.

## 11. Definition of Done

- implementação e testes do escopo aprovado;
- nenhum comportamento inventado fora da minispec;
- typecheck e testes proporcionais verdes;
- documentação canônica atualizada sem criar nova fonte paralela;
- WARLOG com decisão, divergência e evidência;
- Analyst reavalia o gate seguinte;
- commit e SHA de prova registrados.

---

## 12. Ordem de execução e branches

1. O Analyst conclui a descoberta e emite `PASS` antes da primeira branch de build.
2. Executar uma minispec por vez.
3. Criar branch `codex/<minispec>` a partir da `main` atualizada.
4. Não empilhar Sprint 002 antes das provas do Sprint 001.
5. Não empilhar Sprint 003 antes das provas do Sprint 002.
6. Branches antigas são doadoras somente leitura.
7. Cada PR declara qual gate do Analyst foi satisfeito.
8. Merge só depois de provas no SHA final.

Esta reorganização documental vive em `codex/hack-prd-unico`; ela não autoriza nenhum dos
três builds por si só.
