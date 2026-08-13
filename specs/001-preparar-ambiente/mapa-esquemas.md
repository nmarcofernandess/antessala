# Mapa de esquemas — anamnese DietFlow → Antessala

Este documento fixa o contrato de dados que atravessa do DietFlow para o
Antessala. Ele não escolhe quais widgets ou templates serão usados na triagem e
não define urgência, tempo de espera, transições ou ordenação da fila.

Fontes conferidas:

- DietFlow: `src/lib/anamnese/types.ts`, `src/lib/anamnese/schemas.ts`,
  `src/lib/widgets/types.ts`, `src/lib/anamnese/widget-registry.ts`, os oito
  diretórios em `src/lib/anamnese/widgets/`, `src/lib/anamnese/templates.ts` e
  `prisma/schema.prisma`;
- Antessala: `src/main/db/clinical-schema.ts`, `src/main/db/seed.ts` e
  `src/data/catalogos/`.

## 1. Resumo da transformação

| DietFlow | Antessala |
|---|---|
| `Content.content` do módulo `ANAMNESE`, tipo Prisma `Json` | `registros.anamnese`, coluna PostgreSQL `JSONB` no PGlite |
| `Content.patientId` aponta para uma linha de `Patient` quando é registro | não existe `patientId`, tabela de pacientes ou FK de paciente |
| pessoa cadastrada fora da anamnese | `nome`, `sexo`, `idade` e `plano` pertencem à própria linha de `registros` |
| leitura e evolução agrupadas por paciente | cada registro é autônomo; não há busca, deduplicação nem comparação entre registros |
| catálogos em Postgres remoto | snapshots JSON versionados no bundle, carregados no PGlite no primeiro boot |

A pessoa está embutida **no registro**, não dentro do JSON da anamnese. O JSONB
continua contendo somente o envelope e os blocos clínicos. Dois registros com o
mesmo nome são duas entradas válidas e independentes.

## 2. Como o DietFlow serializa uma anamnese

No DietFlow, `Content.content` é um objeto JSON, não uma string com JSON dentro.
O contrato canônico está em `src/lib/anamnese/types.ts:151-162` e no schema Zod
em `src/lib/anamnese/schemas.ts:221-225`:

```ts
interface AnamneseContent {
  _v: 2
  blocos: Bloco[]
}
```

`_v: 2` versiona o envelope inteiro. Cada bloco pode ter seu próprio `_v`
positivo para uma migração granular do seu conteúdo. `Bloco` é uma união
discriminada por `type`:

```ts
type Bloco = BlocoWidget | BlocoSnapshot | BlocoResultado

interface BlocoWidget {
  _v?: number
  id: string
  type: 'widget'
  widgetType: WidgetType
  data: Record<string, unknown>
  convertidoParaTexto: boolean
  textoConvertido?: string
}

interface BlocoSnapshot {
  _v?: number
  id: string
  type: 'snapshot'
  dataCaptura: string // ISO-8601
  dados: SnapshotOverviewData
}

interface BlocoResultado {
  _v?: number
  id: string
  type: 'resultado_protocolo'
  protocoloTipo: string
  protocoloId: string
  scoreCapturado: number
  subscoresCapturados?: Record<string, number>
  dataCaptura: string // ISO-8601
}
```

Dentro de `BlocoSnapshot`, `dados` tem o shape
`{ dataCaptura, antropometria?, estrategia?, objetivo?, protocolos? }`:
antropometria guarda peso, altura, IMC e percentual de gordura opcional;
estratégia guarda tipo, calorias e dieta opcional; objetivo guarda descrição,
meta e progresso opcionais; cada protocolo guarda nome, score e interpretação.
O `WidgetType` original também enumera tipos dinâmicos e legados, mas o registry
portado pelo Antessala aceita para criação somente os oito tipos da seção 4.1.

Um conteúdo mínimo e um bloco preenchido ficam assim:

```json
{
  "_v": 2,
  "blocos": [
    {
      "_v": 1,
      "id": "bloco-01",
      "type": "widget",
      "widgetType": "hidratacao",
      "data": {
        "litrosDia": 2,
        "sliderMax": 5
      },
      "convertidoParaTexto": false
    }
  ]
}
```

`convertidoParaTexto` e `textoConvertido` registram a conversão explícita de um
widget em texto. Eles não substituem `renderToText`: a função continua sendo a
forma determinística de gerar uma representação textual dos dados estruturados.

Os tipos `snapshot` e `resultado_protocolo` fazem parte do formato original e
são preservados como contrato de compatibilidade. Eles não são produtores de
histórico no Antessala: o registry desta etapa só cria blocos dos oito tipos
`widget`, sem decidir quais serão selecionados para a triagem, e não há consulta
que agregue blocos de atendimentos anteriores. Isso mantém o formato legível
sem introduzir evolução clínica.

## 3. Como o mesmo conteúdo vive no PGlite

`src/main/db/clinical-schema.ts:14-29` declara:

```sql
CREATE TABLE registros (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL,
  sexo TEXT NOT NULL,
  idade INTEGER NOT NULL,
  plano TEXT NOT NULL,
  anamnese JSONB NOT NULL DEFAULT '{"_v":2,"blocos":[]}'::jsonb,
  prioridade SMALLINT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

O banco exige `anamnese._v = 2` e `anamnese.blocos` do tipo array. A fronteira
de IPC/escrita deve validar o conteúdo detalhado com o contrato compartilhado.
Na fronteira SQL, o objeto deve ser serializado uma única vez com
`JSON.stringify(...)` e vinculado como `$n::jsonb`; na leitura, PGlite devolve
novamente o valor JSON estruturado. Não há conversão para o antigo formato de
formulário nem uma segunda coluna por widget.

Mapeamento dos campos:

| Origem | Destino | Regra |
|---|---|---|
| `Content.content._v` | `registros.anamnese._v` | permanece literal `2` |
| `Content.content.blocos` | `registros.anamnese.blocos` | preserva ordem, IDs, discriminador e `_v` dos blocos |
| dados de cada widget | `registros.anamnese.blocos[n].data` | preserva o shape validado pelo widget correspondente |
| `Patient.fullName` e demais dados do cadastro | `registros.nome/sexo/idade/plano` | snapshot descartável da pessoa, sem FK |
| `Content.patientId` | — | removido, sem substituto |

`prioridade` está reservada no registro, mas esta etapa não a calcula. A tabela
`registro_jornada` guarda marcos append-only com horário; ela declara os estados
do produto, mas não contém regra de transição nem ordenação. Essas decisões
pertencem a `specs/002-motor-da-fila/`.

## 4. O contrato dos widgets

O `WidgetDefinition<T>` do DietFlow separa quatro partes:

1. metadados (`type`, label, descrição, ícone, categoria, tags e versão);
2. dados (`defaultData`, schema Zod, `isComplete` e `isEmpty`);
3. saídas puras (`renderToText` e `renderToSummary`);
4. renderização React e conectores opcionais.

As três primeiras atravessam para o Antessala. O `Component` HeroUI e o
`renderToPreview` visual do DietFlow não atravessam como JSX: a interface é
refeita com os componentes shadcn/ui daqui. O registro continua sendo a fonte
única que associa um `widgetType` ao seu schema, defaults e renderizadores.

### 4.1 Os oito shapes

| `widgetType` | O que guarda | Default | Catálogo externo |
|---|---|---|---|
| `rotina_alimentar` | `registros[]`; cada item tem `id`, `tipo` (`alimento`, `exercicio`, `remedio` ou `suplemento`), `titulo`, `horario?` e `descricao` | `{ registros: [] }` | nenhum; os itens são texto do próprio registro |
| `hidratacao` | `litrosDia` (0–15), `perfil?` (`sedentario`, `ativo`, `atleta`), `pesoLocal?` (20–300) e `sliderMax` (3–15) | 2 L/dia, sem perfil/peso local, slider até 5 L | nenhum; `pesoLocal` é dado do próprio bloco, não busca um paciente |
| `sono` | modo `triagem`/`completo`; três itens centrais ISI (`satisfacaoSono`, `interferenciaDiurna`, `preocupacaoSono`, todos 0–4); quatro itens opcionais do ISI-7; `horasDormidas?` (0–14) e `acordouNoite?` (0, 1, 2 ou 3+) | triagem, itens centrais em 1, 7 horas e zero despertares | nenhum |
| `bristol` | `tipo` 1–7, `frequencia?` (`diaria`, `dias_alternados`, `irregular`), `observacao?` e sintomas GI opcionais (`inchaco`, `gases`, `dorAbdominal`), cada um com `ativo` e intensidade 0–3 | tipo 4 | nenhum |
| `problemas_saude` | `problemas[]`; cada item tem `id`, `nome`, `codigo?`, `desde?`, `controlado?`; mais `observacao?` | `{ problemas: [] }` | **CID-10** para buscar e preencher código/descrição; texto livre ainda pode existir no registro |
| `medicacoes` | `medicacoes[]`; cada item tem `id`, `nome`, `dose?`, `frequencia?` e `motivo?`; mais `naoUsaMedicamentos?` | `{ medicacoes: [] }` | **medicamentos ANVISA**, nomes comerciais e classe terapêutica |
| `adesao` | `seguiu` (`sim`, `mais_ou_menos`, `nao`), `diferencaCalorica?`, `diasPeriodo` e `observacao?` | seguiu `sim`, período de 7 dias | nenhum |
| `observacoes_gerais` | `texto` livre | string vazia | nenhum |

As frequências aceitas em `medicacoes` são `1x_dia`, `2x_dia`, `3x_dia`,
`4x_dia`, `1x_semana`, `2x_semana`, `3x_semana`, `dias_alternados`,
`uso_continuo` e `sob_demanda`.

O DietFlow contém um helper legado `basica` que instancia os oito widgets nessa
ordem: rotina alimentar, hidratação, sono, Bristol, problemas de saúde,
medicações, adesão e observações gerais. Isso é referência de compatibilidade,
não uma decisão de produto do Antessala. O catálogo ativo de templates e a
seleção de widgets específicos entram em `hack/specs/02-quais-widgets/`; esta
etapa deixa o encaixe vazio.

## 5. Catálogos realmente offline

### 5.1 Formato versionado

O snapshot adotado usa arquivos dentro de `src/data/catalogos/`:

- CID: `{ "_meta": {...}, "data": [...] }`, comprimido como
  `cid10.json.gz` porque é grande e só precisa ser expandido no seed;
- conjuntos curados: `{ "_meta": {...}, "itens": [...] }` em JSON simples,
  pequenos o bastante para revisão em Git;
- SHA-256 de cada arquivo fixado no loader. Alteração sem atualização explícita
  do hash aborta o seed;
- no app empacotado, o loader lê o diretório de recursos `clinical-data`; em
  desenvolvimento e testes, lê o checkout local;
- `catalogo_seed_state` guarda o hash combinado e torna o seed idempotente.

Os itens têm shapes explícitos e independentes do schema da nuvem:

- CID: código, descrições, nível, código do pai, campos denormalizados de
  capítulo/grupo/categoria, relevância, popularidade e termos de busca;
- medicamento: `id`, nome de exibição, princípio ativo, nomes comerciais,
  classe terapêutica e grupo de risco opcional;
- grupo de risco: `id`, rótulo, conduta e peso (`alto`, `medio`, `baixo`);
- MET: `id`, nome, categoria, `met` mínimo e `metMax`;
- comorbidade: `id`, rótulo e lista de pares `{ codigo, descricao }` do CID.

O CID foi derivado de
`~/dietflow-app/prisma/seeds/system/cid10/cid10.json`. Os quatro recortes menores
vieram dos arquivos já extraídos em `/Volumes/Vader/Marco/antessala/src/data/`,
cuja origem técnica remete aos seeds do DietFlow. Assim, o Antessala não exporta
o Postgres da nuvem no primeiro uso: o snapshot já chega no Git e no bundle.

No primeiro boot, `src/main/db/seed.ts:128-150` lê os bytes locais com
`fs.readFileSync`, verifica os hashes e descompacta o CID em memória. A carga
ocorre em transação e não executa `fetch`, embeddings, LLM ou consulta ao banco
do DietFlow.

### 5.2 Snapshot embarcado nesta etapa

| Arquivo | Conteúdo | Itens | Bytes no bundle | SHA-256 do arquivo |
|---|---|---:|---:|---|
| `cid10.json.gz` | CID-10 completo e hierárquico | 14.793 | 624.180 | `24e646c92318c23ae9ba7803bd2df1961cb272d361055f94e44f6b75e1a80b20` |
| `medicamentos.json` | recorte perioperatório curado | 382 | 83.058 | `82710228c24915db14f3ba48819f4e3257de2abf2b6cb161b08afc4142f5d4b3` |
| `grupos-risco.json` | grupos usados pelo classificador | 12 | 1.858 | `2f86cc6c7e5ab0ca1ba9ea397364a176cf90e0fc4e2412dd9796fbc6911593d9` |
| `met.json` | atividades e faixa de equivalentes metabólicos | 94 | 10.878 | `8ecbd5ff81fba218687abbcc6af589212cf0e347f4291598e10bd09be9334dad` |
| `comorbidades.json` | recorte de comorbidades do classificador | 14 | 2.063 | `98b56c6239f3b26e74c5916b36995b46993249398b3fc1d6f66afa44c79958c3` |

Total dos cinco assets: **722.037 bytes**, aproximadamente 705 KiB. O CID
descompactado tem 11.135.026 bytes e SHA-256
`9562faed57d7aa69d7dcce8dfbad91a53cea0fc2b2cab65004417127da0f6ef9`.

O CID completo se divide em 22 capítulos, 275 grupos, 2.045 categorias e
12.451 subcategorias. Ele vai para `catalogo_cid10` preservando nível,
parentesco, descrições, termos de busca e escores de relevância. O arquivo de
**14 comorbidades não é um “CID reduzido”**: é apenas a lista do classificador
de risco. Onze dessas comorbidades têm associações CID; `arritmia`,
`apneia-do-sono` e `tabagismo` ainda não têm código nesse recorte.

Os 382 medicamentos geram 35 classes terapêuticas distintas e trazem 1.113
nomes comerciais. Eles são um recorte clínico curado, **não a base ANVISA
completa**. O golden do DietFlow contém 2.628 medicamentos e ocupa 2.125.171
bytes; pode substituir ou ampliar o recorte mais tarde sem mudar o schema, após
decisão clínica e revisão da redistribuição. Os 94 itens MET cobrem de 1 a 16
MET e são o golden curado, não todo o compêndio bruto.

### 5.3 Destino no PGlite

| Arquivo | Tabelas locais |
|---|---|
| CID | `catalogo_cid10` |
| medicamentos | `catalogo_medicamentos` e `catalogo_classes_terapeuticas` |
| grupos de risco | `catalogo_grupos_risco`, referenciado opcionalmente pelo medicamento |
| MET | `catalogo_met` |
| comorbidades | `catalogo_comorbidades` |

A primeira carga produz 15.330 linhas clínicas: 14.793 CID + 382 medicamentos + 35
classes + 12 grupos de risco + 94 atividades MET + 14 comorbidades. O banco
embarcado passa a ser a única origem de consulta em runtime; os JSON são a
origem versionada e reprodutível do seed.

### 5.4 Limites de proveniência

A origem técnica foi rastreada aos seeds do DietFlow e ao extrator local que
gerou os recortes, mas a licença de redistribuição dos datasets não foi
confirmada nesta etapa. Antes de publicar instaladores fora do ambiente do
projeto, é obrigatório validar separadamente as condições de redistribuição do
CID/DATASUS, da base ANVISA e dos compêndios MET. Até lá, os hashes comprovam a
integridade do snapshot, não concedem licença.

## 6. Onde o vínculo com paciente é cortado

No DietFlow, o vínculo existe em várias camadas:

- `ContentType` documenta `TEMPLATE` como `patientId NULL` e `RECORD` como
  `patientId NOT NULL` (`prisma/schema.prisma:1060-1063`);
- `Content.patientId String?` e a relação
  `patient Patient? @relation(... onDelete: Cascade)` prendem o registro ao
  cadastro (`prisma/schema.prisma:1101-1112` e `1201-1204`);
- índices de `Content` agrupam consultas por `patientId` e módulo;
- `AnamneseMain` exige `patientId` ao criar um registro e navega por rotas
  `/paciente/{id}/anamnese/...`;
- hooks de contexto consultam `/api/paciente/{patientId}/dados-base`, e a
  evolução lê outros registros daquele mesmo paciente.

No Antessala, o corte é estrutural, não apenas visual:

1. não se porta `Patient`, `patientId`, a relação, os índices ou as rotas por
   paciente;
2. não se porta busca, detecção de duplicidade, timeline, evolução ou leitura
   de “dados-base” de outro atendimento;
3. `registros` recebe diretamente `nome`, `sexo`, `idade` e `plano`;
4. `anamnese` pertence somente àquela linha de `registros`;
5. a jornada referencia `registro_id`, nunca uma identidade de paciente;
6. repetir nome e demais atributos não cria conflito e não conecta registros.

Templates, quando forem definidos pela frente responsável, também são objetos
autônomos de catálogo. Eles não usarão o truque `patientId NULL` para dividir a
mesma tabela entre favorito e histórico clínico.
