# Analyst 01 — Fluxo e domínio

**Estado:** `DRAFT — BLOCKED BY PRD SIGNATURE`
**Gate:** obrigatório para Build

## Lei herdada do PRD

O produto começa quando a recepção recebe o encaminhamento e termina quando o resultado da
avaliação pré-anestésica chega ao serviço solicitante. A triagem geral do SUS e a marcação
da cirurgia ficam fora.

## Decisões que este dossiê deve fechar

### Fluxo por raia

Para cada etapa do PRD, registrar:

```text
ator → evento → entrada → ação → saída → estado → próximo responsável → falha
```

O fluxo precisa cobrir:

- caminho simples;
- anamnese incompleta;
- ausência de vaga compatível;
- reagendamento e cancelamento;
- não comparecimento;
- pedido de exame ou informação;
- retorno ao anestesiologista;
- conclusão e recebimento pelo serviço solicitante.

### Identidades

Definir, sem ambiguidade:

- referência da pessoa;
- encaminhamento;
- caso pré-anestésico;
- anamnese;
- reserva/agendamento;
- encontro com anestesiologista;
- pendência;
- retorno;
- resultado entregue.

Também responder: duplicidade, homônimos, dois procedimentos simultâneos, correção de dado,
vínculo entre retorno e consulta e duração do caso.

### Máquina de estados

Cada estado deve declarar owner, evento de entrada, ações, saídas, motivo obrigatório,
timestamp e terminalidade. Nenhum estado pode nascer apenas porque uma tela precisa de uma
badge.

### Documentos e handoffs

Definir quais artefatos são dados editáveis, snapshots, documentos ou meros resumos:

- encaminhamento;
- triagem de enfermagem;
- orientação operacional de agenda;
- comprovante de agendamento;
- avaliação do anestesiologista;
- pendência;
- resultado entregue ao solicitante;
- trilha de auditoria.

## Saída exigida

- diagrama de sequência canônico;
- modelo conceitual de entidades;
- máquina de estados;
- matriz de handoffs;
- invariantes e falhas;
- cenários simples, pendente e sem vaga.

Depois da assinatura do PRD, este dossiê entra em `IN PROGRESS`. Enquanto qualquer item
acima estiver aberto, ele não pode pedir assinatura de conclusão.

---

## Contrato de encerramento deste arquivo

- Artefato: `analyst/01-fluxo-e-dominio.md`
- Gate conjunto: Analyst → Build
- Estado: `BLOQUEADO_PELA_ASSINATURA_DO_PRD`
- Assinatura de Marco: `PENDENTE`
- Data: `PENDENTE`
- Revisão Git examinada: `PENDENTE`
- Declaração: `PENDENTE`

Sem assinatura válida, este dossiê não conta como completo no gate do Analyst.
