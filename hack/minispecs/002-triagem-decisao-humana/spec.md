# MiniSpec 002 — Triagem e decisão humana

**Status:** `BLOCKED BY ANALYST`

**Execução:** proibida até `PASS MINISPEC 002` explícito

**Dependência:** MiniSpec 001 concluída e contratos aprovados

**Agenda:** fora deste sprint

---

## 1. Objetivo

Construir o caso pré-anestésico, a coleta aprovada, a avaliação explicável e a revisão
humana que produzem um requisito operacional auditável. Este sprint termina antes de
procurar, reservar ou exibir uma vaga.

O desenho final será derivado do contrato do Sprint 001. Nomes de entidades, papéis,
campos e regras neste documento são categorias de trabalho, não requisitos aprovados.

---

## 2. Dependências que bloqueiam a entrada

O Analyst precisa registrar `PASS MINISPEC 002` contendo:

- unidade `Paciente → Solicitação → Caso` e identidade definidas;
- papéis, permissões e autoridade humana validados;
- campos e widgets P0 com fonte, dono, temporalidade e estados ausentes;
- catálogo de procedimentos e estratégia de protocolos versionados;
- limite do motor: o que sinaliza, recomenda e jamais decide;
- regras aprovadas com fonte, versão, responsável e tratamento de conflito;
- fixtures para ausência, conflito e mudança de procedimento;
- decisão de migração dos contratos legados;
- critérios de aceite e rollback verificáveis.

Faltar um item mantém toda a minispec bloqueada. Implementação existente não satisfaz o
gate.

---

## 3. Dentro do escopo, depois do `PASS`

1. Persistir o caso e sua relação aprovada com paciente, solicitação e procedimento.
2. Registrar origem, instante, confiança e estados de ausência dos fatos coletados.
3. Compor perguntas/widgets P0 por versão de protocolo, sem mega-widget por cirurgia.
4. Carregar apenas catálogos auditados e necessários ao contrato.
5. Executar regras puras, versionadas e explicáveis dentro do limite clínico aprovado.
6. Manter pendências e conflitos visíveis; nunca convertê-los em normalidade.
7. Permitir confirmação, correção ou rejeição humana com motivo.
8. Preservar sugestão, decisão, ator, instante e versão para auditoria.
9. Produzir resumo operacional mínimo para o próximo sprint, sem alocação de vaga.
10. Migrar, desativar ou remover o legado exatamente como aprovado.

---

## 4. Fora do escopo

- calendário, disponibilidade, slot, reserva, ordenação ou alocação;
- durações, modalidades, cores ou rotas não aprovadas;
- aptidão cirúrgica ou anestésica automática;
- solicitação automática de exames ou manejo de medicamentos;
- inferir ASA final ou usar um score como decisão completa;
- integração real sem contrato da TI;
- WhatsApp, teleconsulta, transcrição ou autopreenchimento por IA;
- notificações, remarcação ou gestão do centro cirúrgico;
- dados reais de paciente na demo.

---

## 5. Entregáveis

- modelo persistente e migrations do caso aprovados;
- contrato tipado de fatos, procedimento, protocolo, avaliação, revisão e auditoria;
- intake mínimo para o ator confirmado;
- widgets P0 em shadcn/ui, com validação e estados de ausência/conflito;
- catálogo/protocolo versionado com autoria, vigência e rollback;
- avaliador puro e explicável limitado às regras aprovadas;
- superfície de revisão/override para o papel autorizado;
- resumo operacional sem detalhes clínicos desnecessários;
- trilha de auditoria e controle de acesso;
- fixtures sintéticas e testes de contrato, segurança clínica e migração;
- atualização do Analyst e registro append-only no Warlog.

---

## 6. Critérios de aceite

- [ ] Um caso só nasce e transita conforme o fluxo e as permissões aprovados.
- [ ] Dado ausente, desconhecido, não aplicável, recusado e conflitante permanecem
      distintos.
- [ ] Todo fato relevante preserva origem e instante; toda regra preserva versão e dono.
- [ ] O mesmo paciente com procedimento diferente pode produzir coleta ou requisito
      diferente quando o protocolo aprovado determinar.
- [ ] Trocar procedimento invalida apenas dependências comprovadas e não apaga histórico.
- [ ] Protocolo novo não reescreve avaliação antiga.
- [ ] Sugestão é explicável por entrada e regra; regra não aprovada não carrega.
- [ ] Humano autorizado consegue confirmar, corrigir ou rejeitar, com motivo obrigatório
      quando houver divergência.
- [ ] A sugestão original e a decisão humana permanecem auditáveis.
- [ ] Papéis não autorizados não acessam detalhes clínicos.
- [ ] CID, medicamentos e classes não são tratados como protocolo completo nem geram
      conduta automática.
- [ ] Não existe código de agenda, slot ou alocação neste sprint.
- [ ] Testes proporcionais, typecheck e build estão verdes no SHA final.

---

## 7. Gate de saída

O sprint só termina com provas no SHA entregue e revisão do Analyst. A conclusão da
MiniSpec 002 não libera a 003 automaticamente: o Analyst precisa verificar os gates
específicos de agenda e registrar `PASS MINISPEC 003`.

Qualquer divergência entre o contrato aprovado e a implementação mantém o estado
`BLOCKED` e entra no Warlog antes de novo trabalho.
