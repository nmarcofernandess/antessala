# Antessala — contrato operacional do repositório

## Leia antes de alterar

Nesta ordem:

1. `hack/PRD.md`;
2. `hack/ANALYST.md`;
3. `hack/BUILD.md`;
4. `hack/WARLOG.md`;
5. `hack/minispecs/<sprint>/spec.md`;
6. `hack/minispecs/<sprint>/writing-plan.md`.

Existem um único PRD, Analyst, Build e Warlog. Cada sprint possui somente `spec.md` e
`writing-plan.md`.

## Estado

**`READY FOR BUILD`.** MiniSpec 001 liberada. As demais seguem em sequência, sem nova
rodada de discovery externo.

## Fluxo canônico

```text
recepção recebe encaminhamento
→ enfermagem realiza anamnese
→ confirma RAPIDO, NORMAL ou ESTENDIDO
→ recepção agenda slot compatível
→ anestesiologista conclui ou cria pendência/retorno
→ serviço solicitante recebe o resultado
```

Triagem geral do SUS e marcação da cirurgia estão fora.

## Leis do hack

1. **O fluxo está decidido.** Não reabrir descoberta hospitalar antes da entrega.
2. **MVP local.** Electron + PGlite no Mac.
3. **Dados sintéticos.** Nenhum paciente real no banco, teste, print ou pitch.
4. **Papéis simulados.** Recepção, enfermagem, anestesiologista e solicitante são modos da
   UI; sem login real.
5. **Três categorias.** `RAPIDO`, `NORMAL`, `ESTENDIDO`.
6. **Humano confirma.** Recomendação explicável com override da enfermagem.
7. **Agenda compatível.** Slot ocupado/incompatível não reserva.
8. **Pendência sobrevive.** Avaliação pode pedir exame/informação e retorno.
9. **Handoff encerra.** Resultado entregue ao solicitante; cirurgia fica fora.
10. **Sem catedral pós-vitória.** Next/Supabase/Stripe/API/RBAC/sync não entram agora.

## Arquitetura

```text
src/main/
├── index.ts                    bootstrap Electron, DB, IPC e seed
├── tipc.ts                     router IPC
├── db/
│   ├── pglite.ts               PGlite local
│   ├── query.ts                queries e transações
│   ├── schema.ts               schema geral
│   ├── clinical-schema.ts      schema clínico atual
│   └── seed.ts                 seed local
└── export/pdf.ts               HTML → PDF

src/shared/
├── anamnese/                   contratos e widgets
├── clinical/                   domínio clínico
└── extensions/                 pontos de encaixe

src/renderer/src/
├── App.tsx                     rotas
├── anamnese/                   composer shadcn
├── componentes/               shell
└── paginas/                    superfícies
```

## Domínio mínimo

### Estados

```text
RECEBIDO
→ EM_TRIAGEM
→ PRONTO_PARA_AGENDAR
→ AGENDADO
→ EM_AVALIACAO
→ PENDENTE → AGENDADO_RETORNO → EM_AVALIACAO
→ CONCLUIDO
→ ENTREGUE_AO_SOLICITANTE
```

### Classificação

Função pura retorna categoria, razões e pendências. Tratar como regra do protótipo, não
protocolo oficial. Override preserva sugestão e motivo.

### Booking

PGlite é a única autoridade. Reserva do slot, vínculo com caso, mudança de estado e
evento acontecem na mesma transação.

### Jornada

Eventos são append-only: estado anterior, novo estado, papel simulado, motivo e instante.

## Reuso

Reusar:

- PGlite, helpers e TIPC;
- composer e widgets;
- catálogos offline;
- shadcn, tema e shell;
- PDF se couber;
- testes existentes.

Não mergear em bloco branches antigas de motor/widgets nem portar DietFlow/FlowKit/
EscalaFlow inteiros.

## Offline

- primeiro boot não baixa modelo;
- catálogos vêm do repositório;
- IA cloud só por ação explícita e fora do fluxo principal;
- PDF bloqueia recursos remotos;
- agenda e casos vivem no PGlite.

## Prioridade de execução

1. caso + anamnese + classificação;
2. slots + booking;
3. avaliação + pendência/retorno + handoff;
4. testes, build e prints.

Quando houver escolha entre arquitetura elegante e demo funcional, escolher a menor
implementação reversível que preserve a narrativa.

## Provas

Antes de entregar:

```bash
npm test
npm run typecheck
npm run build
```

Também provar visualmente as superfícies principais e o fluxo dos quatro casos sintéticos.

## Pós-vitória

Somente com prêmio/investimento: Next.js, Supabase, Stripe, autenticação real,
integrações hospitalares, validação clínica/jurídica, multiusuário e deploy.
