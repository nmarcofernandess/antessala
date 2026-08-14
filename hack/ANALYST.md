# ANALYST — decisões para o MVP de hoje

**Estado:** `READY FOR BUILD`
**Produto:** Electron local, dados sintéticos, demonstração no Mac
**Minispec liberada:** `001-caso-triagem-classificacao`
**Última revisão:** 14/08/2026

---

## 0. Mandato

O Analyst deixou de exigir prova hospitalar impossível antes do hack. Sua função agora é
manter o MVP pequeno, coerente e demonstrável.

Regras:

1. decisão explícita deste PRD vale para a demo;
2. dado e agenda são sintéticos;
3. regra clínica é apresentada como regra do protótipo;
4. nenhum requisito de piloto/produção bloqueia o build;
5. dúvida de implementação é resolvida pela opção local mais simples e reversível;
6. só parar por impossibilidade técnica real de concluir a narrativa.

## 1. Veredito

> **PASS PARA BUILD.** Existe produto suficiente para construir e apresentar.

O fluxo, os papéis, as categorias, os estados e a arquitetura da demonstração estão
decididos. Não é necessário perguntar ao HC antes de implementar.

## 2. Fluxo canônico

```text
encaminhamento chega à recepção
→ recepção abre caso
→ enfermagem faz anamnese
→ sistema sugere RAPIDO, NORMAL ou ESTENDIDO
→ enfermagem confirma ou corrige
→ recepção agenda vaga compatível
→ anestesiologista avalia
→ conclui ou cria pendência/retorno
→ resultado é entregue ao serviço solicitante
```

O que acontece antes do encaminhamento e a marcação da cirurgia ficam fora.

## 3. Modelo mínimo

### Caso

```text
id
paciente: nome, sexo, idade
serviço/médico solicitante
procedimento proposto
observação do encaminhamento
estado
tipo de slot sugerido
tipo de slot confirmado
motivo de override opcional
timestamps
```

### Anamnese

Usa o envelope JSONB e o composer existentes. O catálogo ativo da demo pode começar com
os oito widgets portados e ser reduzido se algum não contribuir para a narrativa.

### Slot

```text
id
data/hora
tipo: RAPIDO | NORMAL | ESTENDIDO
duração em minutos
profissional sintético
status: DISPONIVEL | RESERVADO | BLOQUEADO
caso reservado opcional
```

### Avaliação

```text
caso
resultado: CONCLUIDO | PENDENTE | RETORNO
pendências/observações
resumo final
timestamp
```

### Evento da jornada

Append-only: caso, estado anterior, novo estado, ator simulado, motivo e timestamp.

## 4. Estados

| Estado | Próximos estados válidos |
|---|---|
| `RECEBIDO` | `EM_TRIAGEM` |
| `EM_TRIAGEM` | `PRONTO_PARA_AGENDAR` |
| `PRONTO_PARA_AGENDAR` | `AGENDADO` |
| `AGENDADO` | `EM_AVALIACAO` |
| `EM_AVALIACAO` | `PENDENTE`, `CONCLUIDO` |
| `PENDENTE` | `AGENDADO_RETORNO`, `CONCLUIDO` |
| `AGENDADO_RETORNO` | `EM_AVALIACAO` |
| `CONCLUIDO` | `ENTREGUE_AO_SOLICITANTE` |
| `ENTREGUE_AO_SOLICITANTE` | terminal |

Não construir motor genérico de workflow. Um contrato tipado e transições explícitas
bastam.

## 5. Categorias da triagem

| Categoria | Regra operacional da demo |
|---|---|
| `RAPIDO` | precisa acessar uma vaga mais próxima/protegida |
| `NORMAL` | usa vaga padrão |
| `ESTENDIDO` | precisa de vaga com maior duração |

A implementação usa regras determinísticas simples sobre as respostas da anamnese e o
procedimento sintético. Cada resultado retorna razões legíveis. A enfermagem confirma ou
altera.

Não transformar a categoria em ASA, aptidão cirúrgica ou protocolo oficial.

## 6. Papéis e superfícies

### Recepção

- cria caso;
- envia para triagem;
- vê categoria confirmada e pendências operacionais;
- agenda slot compatível;
- não edita a anamnese clínica.

### Enfermagem

- abre caso aguardando triagem;
- preenche anamnese;
- vê explicação da sugestão;
- confirma ou altera categoria.

### Anestesiologista

- vê agenda e resumo do caso;
- inicia avaliação;
- conclui ou cria pendência/retorno;
- escreve resumo final.

### Serviço solicitante

- vê casos concluídos;
- recebe o resumo;
- confirma handoff.

No MVP, os papéis são modos da interface. Não implementar autenticação real.

## 7. Agenda

PGlite é a autoridade única. Slots são seedados. O calendário é uma projeção; pode ser
uma lista/grade simples se isso for mais rápido que instalar FullCalendar.

Leis:

- só slot disponível e compatível pode ser reservado;
- reserva e mudança do caso acontecem na mesma transação;
- reservar slot já ocupado falha com mensagem clara;
- caso pendente não recebe vaga nova até voltar a pronto;
- ausência de vaga compatível aparece como estado, não erro técnico.

## 8. Fixtures obrigatórias

1. **Carlos — RÁPIDO:** caso com sinal de necessidade de acesso antecipado.
2. **Marina — NORMAL:** caso padrão e completo.
3. **Joana — ESTENDIDO:** caso que demanda avaliação mais longa.
4. **Paulo — PENDENTE:** informação/exame faltante e retorno posterior.

Todos os nomes, dados, regras e agendas são fictícios.

## 9. Arquitetura decidida

```text
Electron
→ React/shadcn existente
→ TIPC direto
→ PGlite local
→ seed sintético
```

- sem Next.js;
- sem Supabase;
- sem Stripe;
- sem deploy;
- sem sync;
- sem API hospitalar;
- sem login real;
- sem IA no caminho crítico.

Se o projeto vencer, essas decisões serão reavaliadas para produto real.

## 10. Reuso autorizado

- composer e widgets existentes;
- catálogos offline existentes;
- PGlite, query helpers e IPC;
- PDF, se couber no final;
- componentes shadcn e tema;
- funções puras do classificador somente como matéria-prima, nunca como protocolo oficial;
- padrões visuais de agenda já disponíveis, se economizarem tempo.

Não portar DietFlow, EscalaFlow ou Studio em bloco.

## 11. Gate de cada minispec

### MiniSpec 001

`PASS`: caso + anamnese + sugestão explicável + confirmação humana funcionando.

### MiniSpec 002

`PASS` automático depois da 001: agenda sintética + compatibilidade + booking atômico.

### MiniSpec 003

`PASS` automático depois da 002: avaliação + pendência/retorno + handoff + demo final.

Não existe nova rodada de descoberta entre os sprints.

## 12. Definition of Done do hack

- fluxo completo demonstrável;
- dados sintéticos claramente identificados;
- estados e decisões visíveis;
- três categorias provadas;
- override humano provado;
- slot incompatível/ocupado recusado;
- pendência e retorno provados;
- handoff final provado;
- testes, typecheck e build verdes;
- interface suficiente para prints e pitch.

Tudo que for necessário para homologação hospitalar fica no backlog pós-vitória e não
bloqueia esta entrega.
