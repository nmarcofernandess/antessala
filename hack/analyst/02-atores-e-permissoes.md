# Analyst 02 — Atores e permissões

**Estado:** `DRAFT — BLOCKED BY PRD SIGNATURE`
**Gate:** obrigatório para Build

## Atores herdados do PRD

Paciente, médico solicitante, recepção, enfermagem, anestesiologista e serviço solicitante.
O Analyst decide quais atores usam o produto diretamente e quais aparecem apenas como
origem ou destino de um handoff.

## Decisões obrigatórias

### Logins

- quais papéis precisam de sessão própria na demonstração;
- se um usuário pode acumular papéis;
- como a autoria registra pessoa e papel usado;
- como funciona troca de usuário em computador compartilhado;
- quais ações não podem existir em modo de demonstração.

### Permissões

Para cada entidade e campo, declarar:

```text
quem cria
quem lê
quem edita
quem finaliza
quem corrige
quem recebe apenas um resumo
qual correção cria adendo ou nova versão
```

### Leis mínimas

- Recepção trabalha com informação operacional; não interpreta clínica.
- Enfermagem registra entrevista e aferições; não assina decisão anestésica.
- Anestesiologista registra avaliação médica; não apaga a autoria da enfermagem.
- Serviço solicitante recebe o resultado autorizado; não altera a avaliação.
- Administração técnica não recebe acesso clínico por consequência automática.
- Toda ação sensível registra autor, papel, data, objeto e motivo.

## Matriz a completar

| Objeto/ação | Recepção | Enfermagem | Anestesiologista | Solicitante | Admin |
|---|---|---|---|---|---|
| Abrir caso | a definir | a definir | a definir | a definir | a definir |
| Editar identificação | a definir | a definir | a definir | a definir | a definir |
| Preencher anamnese | proibido | a definir | a definir | a definir | proibido |
| Ver detalhe clínico | mínimo a definir | a definir | a definir | resumo a definir | proibido por padrão |
| Definir necessidade de vaga | proibido | a definir | override a definir | proibido | proibido |
| Reservar vaga | a definir | proibido | proibido | proibido | proibido |
| Concluir avaliação | proibido | proibido | a definir | proibido | proibido |
| Receber resultado | operacional | a definir | a definir | a definir | proibido por padrão |

## Saída exigida

- catálogo de papéis;
- matriz RBAC completa;
- ownership por campo;
- contratos de leitura e escrita por papel;
- cenários negativos que provam cada proibição.

---

## Contrato de encerramento deste arquivo

- Artefato: `analyst/02-atores-e-permissoes.md`
- Gate conjunto: Analyst → Build
- Estado: `BLOQUEADO_PELA_ASSINATURA_DO_PRD`
- Assinatura de Marco: `PENDENTE`
- Data: `PENDENTE`
- Revisão Git examinada: `PENDENTE`
- Declaração: `PENDENTE`

Sem assinatura válida, este dossiê não conta como completo no gate do Analyst.
