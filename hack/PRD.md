# PRD canônico — Antessala

## Triagem para definir o slot da consulta pré-anestésica

**Hacka Health 2026 · Desafio 1 · HCFMRP-USP**
**Versão:** 3.0 · 14/08/2026
**Estado:** `READY FOR BUILD`
**Entrega:** MVP demonstrável em Electron, executado localmente no Mac

---

## 0. Lei deste documento

Este é o único PRD. O fluxo descrito aqui é a decisão de produto do hackathon. Não depende
de entrevista, screen-share, API, validação da TI ou acesso a dado real para ser construído.

O MVP usa pessoas, agendas, encaminhamentos e dados clínicos **inteiramente sintéticos**.
Ele demonstra uma solução possível para o desafio; não afirma ser integração homologada
ou protocolo oficial do HCFMRP.

Se o projeto vencer e receber investimento, arquitetura web, banco compartilhado,
autenticação institucional, integrações e validação clínica entram numa fase posterior.
Nada disso bloqueia a entrega de hoje.

## 1. O fluxo é este

```text
paciente passa pela triagem geral do SUS
→ consulta com o médico do serviço solicitante
→ médico indica um procedimento e emite encaminhamento para consulta pré-anestésica
→ paciente entrega o encaminhamento na recepção
→ recepção abre o caso e encaminha para a enfermagem
→ enfermagem realiza anamnese pré-anestésica
→ triagem define o tipo de slot: RÁPIDO, NORMAL ou ESTENDIDO
→ paciente retorna à recepção
→ recepção encontra e reserva vaga compatível com o tipo indicado
→ paciente comparece à consulta com o anestesiologista
→ anestesiologista conclui a avaliação ou registra exames/retornos necessários
→ quando concluído, o resultado volta ao serviço médico solicitante
→ serviço solicitante marca a cirurgia imediatamente ou comunica a data depois
```

### 1.1 Exemplo narrativo canônico

Dr. João, gastroenterologista, indica uma endoscopia. O paciente recebe encaminhamento
para a consulta pré-anestésica, entrega-o na recepção e passa pela enfermagem. A anamnese
indica qual tipo de vaga ele necessita. A recepção agenda uma vaga compatível. No dia, o
anestesiologista avalia, solicita pendências se necessário e conclui. O resultado retorna
à secretaria do Dr. João, que conduz a marcação da cirurgia.

Os nomes e dados da demo são fictícios.

## 2. Fronteiras

### O Antessala começa

Quando a recepção recebe o encaminhamento para consulta pré-anestésica.

### O Antessala termina

Quando a avaliação pré-anestésica concluída ou sua pendência é entregue ao serviço
solicitante.

### Fora do produto

- triagem geral do SUS;
- consulta que indicou o procedimento;
- prontuário institucional completo;
- decisão de realizar o procedimento;
- gestão de sala e mapa cirúrgico;
- marcação da cirurgia;
- comunicação oficial do hospital;
- integração real com sistemas do HC.

## 3. Os quatro papéis da demonstração

O MVP roda em uma única aplicação e não exige autenticação real. Um seletor de papel ou
navegação entre superfícies simula os handoffs.

| Papel | Faz no MVP |
|---|---|
| Recepção | recebe encaminhamento, abre caso, acompanha status e agenda slot compatível |
| Enfermagem | realiza anamnese, vê sugestão e confirma/corrige o tipo de slot |
| Anestesiologista | consulta caso agendado, registra pendência, retorno ou conclusão |
| Serviço solicitante | recebe o resumo final e confirma o handoff |

Paciente participa da narrativa e fornece dados, mas não precisa de login ou app próprio.

## 4. A decisão operacional

A saída da triagem é uma destas três categorias:

| Tipo | Significado no MVP | Consequência na agenda |
|---|---|---|
| `RAPIDO` | caso deve acessar avaliação mais cedo | procura vaga protegida/mais próxima compatível |
| `NORMAL` | caso segue o fluxo padrão | procura vaga padrão disponível |
| `ESTENDIDO` | avaliação demanda mais tempo | procura vaga de duração estendida |

Essas categorias são regras de demonstração do Antessala, não classificação oficial do
HC. A enfermagem sempre pode corrigir a sugestão e registrar o motivo.

O sistema também registra pendências. Caso sem informação mínima não é agendado como se
estivesse normal.

## 5. Jornada do caso

```text
RECEBIDO
→ EM_TRIAGEM
→ PRONTO_PARA_AGENDAR
→ AGENDADO
→ EM_AVALIACAO
→ PENDENTE
→ AGENDADO_RETORNO
→ EM_AVALIACAO
→ CONCLUIDO
→ ENTREGUE_AO_SOLICITANTE
```

`PENDENTE` e `AGENDADO_RETORNO` são opcionais. Um caso pode ir de `EM_AVALIACAO`
diretamente para `CONCLUIDO`.

## 6. Capacidades do MVP

### C1 · Receber encaminhamento

Criar caso sintético com paciente, médico/serviço solicitante, procedimento e observação.

### C2 · Realizar anamnese

Usar o composer e os widgets existentes, ativando somente o conjunto necessário à demo.

### C3 · Sugerir e confirmar tipo de slot

Aplicar regra determinística de demonstração, mostrar as razões e permitir correção pela
enfermagem.

### C4 · Agendar

Exibir agenda sintética com vagas `RAPIDO`, `NORMAL` e `ESTENDIDO`; oferecer somente vagas
compatíveis e impedir dupla reserva.

### C5 · Realizar avaliação pré-anestésica

Permitir ao anestesiologista registrar:

- concluído sem pendência;
- exame ou informação necessária;
- retorno necessário;
- observação e resumo final.

### C6 · Entregar ao solicitante

Mostrar o caso concluído ao serviço solicitante e registrar que o resultado foi entregue.
A cirurgia permanece fora do sistema.

### C7 · Explicar

Em qualquer caso, mostrar anamnese relevante, tipo sugerido, decisão humana, vaga
escolhida, pendências e linha do tempo.

## 7. As superfícies mínimas

1. **Recepção** — entrada do encaminhamento, casos aguardando triagem e casos prontos
   para agendar.
2. **Triagem** — anamnese, razões da sugestão e confirmação do tipo de slot.
3. **Agenda** — vagas por tipo e booking do caso.
4. **Avaliação** — agenda do anestesiologista, pendências, retornos e conclusão.
5. **Handoff** — resumo final recebido pelo serviço solicitante.

Podem ser páginas, etapas ou drawers. O Build escolhe a composição mais rápida usando a
casca existente.

## 8. Dados e funcionamento

- Electron + React + shadcn/ui existentes;
- PGlite local como fonte de verdade da demo;
- seed com casos, profissionais e agenda sintéticos;
- primeiro boot sem acesso obrigatório à internet;
- nenhum dado real de paciente;
- nenhuma API hospitalar;
- nenhuma autenticação real obrigatória;
- IA, transcrição e RAG fora do caminho crítico.

## 9. Critérios de sucesso da demo

- Um encaminhamento percorre todo o fluxo até o handoff final.
- Três casos sintéticos resultam em `RAPIDO`, `NORMAL` e `ESTENDIDO`.
- A enfermagem entende e pode alterar a recomendação.
- A recepção só vê vagas compatíveis com o tipo confirmado.
- Uma vaga não pode ser reservada duas vezes.
- Caso pendente não desaparece e pode voltar à avaliação.
- O anestesiologista conclui ou pede retorno.
- O serviço solicitante recebe o resultado final.
- A linha do tempo explica tudo que aconteceu.
- A demo abre e funciona no Mac sem depender de integração externa.

## 10. Não fazer antes da entrega

- Next.js, Supabase, Stripe ou deploy web;
- integração com PEP, FHIR, agenda ou WhatsApp;
- login institucional e RBAC de produção;
- sync multiusuário/offline;
- protocolo clínico definitivo;
- catálogo completo de procedimentos;
- gestão do centro cirúrgico;
- app do paciente;
- burocracia de piloto hospitalar.

Esses itens são pós-vitória. Hoje o objetivo é um produto local demonstrável que conte a
história inteira sem mentir sobre ser produção.
