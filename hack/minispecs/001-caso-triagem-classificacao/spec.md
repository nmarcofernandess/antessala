# MiniSpec 001 — Caso, triagem e classificação

**Status:** `BLOCKED BY ANALYST`

**Execução:** proibida até `PASS MINISPEC 001` explícito

**Agenda e booking:** fora deste sprint

**Dono do gate:** [`../../ANALYST.md`](../../ANALYST.md)

---

## 1. Objetivo

Construir a primeira fatia vertical aprovada: uma solicitação vira caso pré-anestésico,
os fatos necessários são coletados com origem e incerteza, uma régua aprovada produz uma
sugestão explicável e o profissional autorizado confirma ou diverge. A saída é um
requisito operacional auditável, ainda sem procurar vaga.

Nomes de papéis, campos, widgets, estados, classes e regras só entram pelo `PASS`. Este
arquivo organiza a execução futura; não preenche a descoberta.

## 2. Dependências que bloqueiam a entrada

O Analyst precisa registrar:

- fronteira, início e final da fatia;
- identidade de paciente, solicitação, caso e procedimento;
- atores, autenticação, RBAC e ownership por campo/ação;
- dicionário de dados, proveniência, temporalidade e estados ausentes;
- widgets/formulários P0 e seus consumidores;
- catálogo de procedimentos e protocolos versionados;
- eixos e limite da régua clínico-operacional;
- estados, reclassificação, override e auditoria;
- estratégia de arquitetura/source of truth suficiente para esta fatia;
- fixtures, oráculos e mapa de migração do legado.

Faltar um item mantém toda a minispec bloqueada. Código existente não satisfaz gate.

## 3. Dentro do escopo, depois do `PASS`

1. Persistir o agregado aprovado e suas identidades.
2. Implementar login/perfis mínimos e autorização server-side/IPC por ação.
3. Registrar origem, instante, confiança, ausência, recusa e conflito dos fatos.
4. Compor perguntas/widgets P0 por versão de protocolo.
5. Carregar somente catálogos auditados e necessários.
6. Executar regras puras, versionadas e explicáveis dentro do limite aprovado.
7. Manter pendências e incertezas visíveis.
8. Permitir confirmação/correção/rejeição humana com motivo.
9. Preservar sugestão, decisão, ator, instante e versão.
10. Produzir o `SchedulingRequirement` aprovado, sem alocação.
11. Migrar, desativar ou remover legado exatamente como decidido.

## 4. Fora do escopo

- calendário, disponibilidade, slot, reserva, ordenação ou booking;
- duração, modalidade, prioridade ou cor não aprovada;
- aptidão anestésica/cirúrgica automática;
- solicitação automática de exame ou manejo de medicamento;
- inferir ASA final ou usar score como decisão completa;
- integração real sem contrato da TI;
- WhatsApp, teleconsulta, STT ou autopreenchimento por IA;
- dado real de paciente na demo.

## 5. Entregáveis

- migrations e contratos tipados aprovados;
- autenticação/RBAC mínimos;
- intake do caso e procedimento;
- widgets P0 em shadcn/ui com todos os estados de dado;
- protocolo versionado com autoria, vigência e rollback;
- avaliador puro e explicável;
- revisão/override e resumo operacional mínimo;
- trilha de auditoria;
- fixtures e testes de domínio, permissão e migração;
- atualização do Analyst e entrada append-only no Warlog.

## 6. Critérios de aceite

- [ ] Todo campo tem fonte, owner, temporalidade, consumidor e autorização.
- [ ] Ausente, desconhecido, não aplicável, recusado e conflitante são distintos.
- [ ] Trocar procedimento recalcula apenas dependências aprovadas e preserva versões.
- [ ] Regra sem fonte, dono ou versão não carrega.
- [ ] Sugestão liga saída a entradas e regras.
- [ ] Humano autorizado pode divergir com motivo; sugestão original permanece.
- [ ] Papel não autorizado não lê nem altera detalhe clínico.
- [ ] CID, medicamentos e exames não produzem conduta automática.
- [ ] A saída respeita o contrato aprovado e não procura vaga.
- [ ] Fixtures cobrem ausência, conflito, override e mudança de procedimento.
- [ ] Testes proporcionais, typecheck e build estão verdes no SHA final.

## 7. Gate de saída

O sprint termina somente com provas no SHA entregue e revisão do Analyst. Sua conclusão
não libera automaticamente a MiniSpec 002; é obrigatório `PASS MINISPEC 002` separado.
