# BUILD — plano mestre do MVP Antessala

**Estado:** `READY FOR BUILD`
**Execução liberada:** MiniSpec 001 agora; 002 e 003 em sequência
**Plataforma:** Electron local + PGlite
**Prazo:** entrega do hackathon

---

## 0. Objetivo

Construir a narrativa inteira no Mac:

```text
encaminhamento
→ triagem/anamnese
→ RAPIDO | NORMAL | ESTENDIDO
→ booking compatível
→ avaliação/pendência/retorno
→ handoff ao serviço solicitante
```

O Build não abre novas investigações. Quando houver mais de uma opção tecnicamente
válida, escolhe a mais simples que preserve a demonstração.

## 1. Fundação disponível

- Electron + React + shadcn/ui;
- PGlite, migrations e helpers de transação;
- IPC tipado;
- composer e oito widgets;
- catálogos offline;
- tema, rich text e PDF;
- Vitest e Playwright;
- primeiro boot local.

Não reconstruir essa base.

## 2. Arquitetura do MVP

```text
Renderer
  Recepção | Triagem | Agenda | Avaliação | Handoff
        ↓ TIPC
Main process
  casos | anamnese | classificação | slots | avaliações | jornada
        ↓
PGlite local
```

### Regras

- um banco local;
- dados seedados e sintéticos;
- transações para booking e transições críticas;
- regra de classificação pura e testável;
- regra de domínio fora dos componentes;
- sem autenticação real: modo de papel na UI;
- sem rede obrigatória no fluxo.

## 3. Modelo mínimo de persistência

O código legado pode ser substituído ou adaptado diretamente. Não existe necessidade de
migração de dados reais.

### `casos_pre_anestesicos`

- identidade sintética do paciente;
- solicitante e procedimento;
- estado;
- anamnese JSONB;
- categoria sugerida/confirmada;
- razões e override;
- timestamps.

### `slots_pre_anestesicos`

- data/hora, duração, tipo e profissional;
- status e caso reservado;
- restrição única que impeça dupla reserva.

### `avaliacoes_pre_anestesicas`

- resultado, pendências, resumo e timestamps;
- várias avaliações/retornos podem pertencer ao mesmo caso.

### `eventos_caso`

- jornada append-only com estado anterior/novo, papel, motivo e instante.

## 4. Regra de classificação

Criar contrato puro:

```ts
classificarCaso(input): {
  sugerido: 'RAPIDO' | 'NORMAL' | 'ESTENDIDO'
  razoes: string[]
  pendencias: string[]
}
```

Princípios:

- regras explícitas e determinísticas;
- prioridade de `RAPIDO` vence `ESTENDIDO` quando a demo exigir uma única categoria;
- dado mínimo ausente cria pendência;
- enfermagem pode confirmar ou sobrescrever;
- UI chama isso de “recomendação do protótipo”.

As regras exatas são fixtures de produto, não alegação médica institucional.

## 5. Agenda

Começar com lista/grade própria usando componentes existentes. Só usar FullCalendar se já
estiver disponível e realmente reduzir trabalho.

Slots sintéticos possuem tipo e duração configurados no seed. A busca oferece vagas do
tipo confirmado e ordena por data/hora. Booking:

1. valida estado do caso;
2. trava/atualiza slot ainda disponível;
3. associa caso;
4. muda caso para `AGENDADO`;
5. grava evento;
6. tudo na mesma transação.

## 6. As três minispecs

### 001 · Caso, triagem e classificação

Entrega vertical:

```text
recepção cria caso
→ enfermagem preenche anamnese
→ sistema recomenda categoria
→ enfermagem confirma/corrige
→ caso fica pronto para agendar
```

Arquivos:

- [`spec.md`](minispecs/001-caso-triagem-classificacao/spec.md)
- [`writing-plan.md`](minispecs/001-caso-triagem-classificacao/writing-plan.md)

### 002 · Capacidade, agenda e booking

Entrega vertical:

```text
recepção abre casos prontos
→ vê vagas compatíveis
→ reserva
→ caso fica agendado
```

Arquivos:

- [`spec.md`](minispecs/002-capacidade-agenda-booking/spec.md)
- [`writing-plan.md`](minispecs/002-capacidade-agenda-booking/writing-plan.md)

### 003 · Avaliação, handoff e prova final

Entrega vertical:

```text
anestesiologista atende
→ conclui ou cria pendência/retorno
→ conclui avaliação
→ serviço solicitante recebe resultado
```

Arquivos:

- [`spec.md`](minispecs/003-handoff-prova-final/spec.md)
- [`writing-plan.md`](minispecs/003-handoff-prova-final/writing-plan.md)

## 7. Ordem de construção

1. Contratos/DDL/IPC do caso.
2. Recepção cria caso.
3. Triagem com widgets.
4. Classificação + override.
5. Seed de slots.
6. Agenda + booking.
7. Avaliação + pendência/retorno.
8. Handoff.
9. Fixtures, demo e polimento.

Não construir infraestrutura pós-vitória no meio dessa ordem.

## 8. Testes mínimos

### Domínio

- cada fixture classifica como esperado;
- ausência cria pendência;
- override preserva sugestão;
- transição inválida falha.

### Agenda

- vaga compatível reserva;
- vaga incompatível recusa;
- slot ocupado não reserva duas vezes;
- ausência de vaga retorna resposta útil.

### Jornada

- caso simples conclui;
- caso pendente agenda retorno e depois conclui;
- handoff só ocorre depois de conclusão.

### Produto

- fluxo principal E2E;
- typecheck;
- testes;
- build Electron;
- prints das superfícies-chave.

## 9. Cortes autorizados se o relógio apertar

1. calendário visual vira lista de vagas;
2. login vira seletor de papel;
3. PDF vira resumo em tela;
4. catálogo de widgets é reduzido;
5. somente quatro fixtures canônicas;
6. comunicação vira confirmação visual de handoff;
7. retorno usa o mesmo fluxo de avaliação.

Não cortar:

- classificação em três categorias;
- confirmação/override humano;
- booking compatível;
- pendência/retorno;
- handoff final;
- dados sintéticos claramente marcados.

## 10. Pós-vitória

Somente depois de prêmio/investimento:

- Next.js e Supabase;
- autenticação/RBAC real;
- integração hospitalar;
- validação clínica e jurídica;
- sync e multiusuário;
- Stripe, deploy e operação SaaS;
- importação madura de módulos do DietFlow.
