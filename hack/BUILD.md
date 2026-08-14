# BUILD — plano mestre do Antessala

**Estado:** `BLOCKED BY ANALYST`
**Execução liberada:** somente MiniSpec 001, trabalho de contrato e descoberta
**Quantidade máxima de sprints:** 3
**Última revisão:** 13/08/2026

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
Analyst registrar `PASS` para a minispec.

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
adaptadas antes do contrato do Sprint 001, mas também não serão importadas por novas
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

O Sprint 001 confirma, corrige ou remove cada invariante.

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

### Sprint 001 · Contrato operacional

**Objetivo:** transformar a hipótese em um contrato que possa ser construído sem
adivinhação.

Entregas:

- fluxo atual e fluxo-alvo mínimo;
- atores, autoridade e matriz de acesso;
- unidade `Paciente → Solicitação → Caso`;
- dicionário de dados e proveniência;
- significado operacional de risco e complexidade;
- catálogo/protocolo de procedimento;
- papel do produto perante a agenda;
- decisão de integração/mock;
- ADRs consolidadas no Analyst;
- fixtures sintéticas aceitas;
- mapa de migração do legado.

**Saída:** Analyst decide `PASS` ou mantém o build bloqueado.

Arquivos:

- [`spec.md`](minispecs/001-contrato-operacional/spec.md)
- [`writing-plan.md`](minispecs/001-contrato-operacional/writing-plan.md)

### Sprint 002 · Triagem e decisão humana

**Objetivo:** construir o caso, a coleta aprovada, a avaliação explicável e a revisão
humana sem antecipar agenda.

Entregas candidatas, sujeitas ao Sprint 001:

- persistência/migração do caso;
- intake do procedimento e origem da solicitação;
- composição versionada de perguntas;
- widgets P0 e tratamento de dados ausentes/conflitantes;
- avaliação por regras aprovadas;
- pendências;
- revisão/override humano;
- resumo operacional mínimo;
- auditoria e fixtures.

**Não entrega:** agenda, tempos inventados, autoaptidão ou integração real não fornecida.

Arquivos:

- [`spec.md`](minispecs/002-triagem-decisao-humana/spec.md)
- [`writing-plan.md`](minispecs/002-triagem-decisao-humana/writing-plan.md)

### Sprint 003 · Agenda diferenciada e demo

**Objetivo:** traduzir a decisão revisada em uso de capacidade e fechar a narrativa
end-to-end.

Entregas candidatas, sujeitas aos Sprints 001 e 002:

- contrato de requisito de vaga;
- adaptador de recomendação ou agenda própria mínima;
- disponibilidade, recurso, duração/modalidade e conflitos aprovados;
- alocação compatível e resposta explícita de falta de capacidade;
- superfícies mínimas por papel confirmado;
- explicação da decisão;
- cenário demonstrativo e prova automatizada/visual;
- comparação honesta entre fluxo indiferenciado e diferenciado.

Arquivos:

- [`spec.md`](minispecs/003-agenda-diferenciada-demo/spec.md)
- [`writing-plan.md`](minispecs/003-agenda-diferenciada-demo/writing-plan.md)

---

## 7. Decisão sobre calendário

O Sprint 001 precisa escolher uma destas classes:

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

O Sprint 001 deve produzir uma matriz para cada tabela/contrato atual:

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
- remarcação/cancelamento só entram se o Sprint 001 os aprovar;
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

1. Executar uma minispec por vez.
2. Criar branch `codex/<minispec>` a partir da `main` atualizada.
3. Não empilhar Sprint 002 antes do `PASS` do Sprint 001.
4. Não empilhar Sprint 003 antes das provas do Sprint 002.
5. Branches antigas são doadoras somente leitura.
6. Cada PR declara qual gate do Analyst foi satisfeito.
7. Merge só depois de provas no SHA final.

Esta reorganização documental vive em `codex/hack-prd-unico`; ela não autoriza nenhum dos
três builds por si só.
