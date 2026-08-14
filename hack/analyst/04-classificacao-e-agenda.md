# Analyst 04 — Classificação e agenda

**Estado:** `IN PROGRESS`
**Gate:** obrigatório para Build

## Lei herdada do PRD

A enfermagem produz uma necessidade operacional de vaga rápida, normal ou estendida. A
recepção agenda sem interpretar dados clínicos. Esses nomes ainda não constituem algoritmo,
prioridade clínica, duração ou protocolo.

## Classificação a fechar

Separar explicitamente:

- duração ou complexidade da consulta;
- antecedência desejada;
- prontidão para agendar;
- modalidade ou recurso necessário;
- decisão médica do anestesiologista.

Definir:

- entradas mínimas;
- regras e gatilhos;
- tratamento de informação ausente;
- resultado, motivos e dados disparadores;
- versão da regra;
- confirmação, override e justificativa;
- reclassificação antes e depois do agendamento;
- procedimento desconhecido;
- casos de prova e controles negativos.

Um número isolado ou uma cor sem contrato não passa.

## Agenda a fechar

Definir:

- recurso agendável;
- agenda e fonte de capacidade;
- disponibilidade recorrente e exceções;
- unidade temporal;
- templates de slot e duração;
- compatibilidade entre caso e vaga;
- vagas protegidas, se existirem;
- reserva, confirmação, comunicação, reagendamento e cancelamento;
- falta do paciente e retorno;
- comportamento quando não existe vaga;
- conflito e dupla reserva;
- revalidação da classificação durante a reserva.

O calendário será uma projeção da agenda. A interface visual não decide regra clínica nem
autoriza uma reserva inválida.

## Corridas obrigatórias

- duas recepcionistas escolhem a mesma vaga;
- classificação muda durante a reserva;
- vaga é bloqueada durante a confirmação;
- resposta do servidor se perde após confirmar;
- requisição é repetida;
- caso agendado passa a exigir outro tipo de slot;
- não existe capacidade compatível.

## Saída exigida

- contrato das saídas operacionais;
- tabela de regras e explicações;
- política de override e reclassificação;
- modelo conceitual da agenda;
- invariantes de reserva;
- cenários de capacidade e concorrência;
- oráculos de teste para casos diferentes.
