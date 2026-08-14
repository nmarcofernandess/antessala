# Antessala

MVP Electron para demonstrar **triagem aplicada ao agendamento da consulta
pré-anestésica**.

> **Estado: `READY FOR BUILD`.** O fluxo do hack está decidido e usa somente dados
> sintéticos no Mac.

## Fluxo

```text
encaminhamento do médico solicitante
→ recepção abre caso
→ enfermagem realiza anamnese
→ confirma slot RAPIDO, NORMAL ou ESTENDIDO
→ recepção agenda vaga compatível
→ anestesiologista conclui ou cria pendência/retorno
→ resultado volta ao serviço solicitante
```

A triagem geral do SUS acontece antes e não pertence ao produto. A marcação da cirurgia
acontece depois e também fica fora.

## Documentação canônica

1. [`hack/PRD.md`](hack/PRD.md) — produto e leis do MVP;
2. [`hack/ANALYST.md`](hack/ANALYST.md) — decisões de domínio e arquitetura;
3. [`hack/BUILD.md`](hack/BUILD.md) — plano mestre;
4. [`hack/WARLOG.md`](hack/WARLOG.md) — histórico das decisões.

Três sprints, cada um com `spec.md` e `writing-plan.md`:

| Sprint | Estado | Entrega |
|---|---|---|
| [`001-caso-triagem-classificacao`](hack/minispecs/001-caso-triagem-classificacao/spec.md) | pronto | caso, anamnese, classificação e override |
| [`002-capacidade-agenda-booking`](hack/minispecs/002-capacidade-agenda-booking/spec.md) | depois da 001 | slots sintéticos e booking compatível |
| [`003-handoff-prova-final`](hack/minispecs/003-handoff-prova-final/spec.md) | depois da 002 | avaliação, pendência/retorno e handoff |

## Fundação pronta

- Electron + React 19 + shadcn/ui;
- PGlite embarcado e IPC tipado;
- composer e oito widgets de anamnese;
- CID-10, medicamentos, MET e catálogos locais;
- primeiro boot sem download de modelo;
- tema claro/escuro/sistema;
- exportação PDF;
- IA opcional e memória/RAG dormentes;
- Vitest e Playwright.

## Arquitetura do hack

```text
Electron renderer
→ TIPC
→ PGlite local
→ seed sintético
```

- um único Mac;
- papéis simulados por modos da interface;
- nenhuma API hospitalar;
- nenhum dado real;
- nenhuma rede obrigatória no fluxo;
- nenhuma alegação de homologação clínica.

## Categorias

- `RAPIDO`: acesso antecipado;
- `NORMAL`: vaga padrão;
- `ESTENDIDO`: consulta com maior duração.

A regra do protótipo é explicável e a enfermagem pode sobrescrever a sugestão.

## O que não entra agora

- Next.js, Supabase, Stripe ou deploy web;
- autenticação/RBAC institucional;
- FHIR, PEP ou agenda real;
- sync multiusuário;
- centro cirúrgico;
- app do paciente;
- protocolo oficial do HC.

Isso é pós-vitória. O hack precisa demonstrar o fluxo completo no Mac.

## Comandos

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```
