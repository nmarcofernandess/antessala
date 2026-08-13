# Catálogos clínicos offline

Estes arquivos são versionados e embarcados no bundle do Antessala. O primeiro
boot os carrega no PGlite local; nenhuma consulta à internet ou ao banco do
DietFlow participa desse fluxo.

Snapshot de origem: `DietFlow/prisma/seeds/system`, extraído em 13/08/2026 pelo
script preservado em `/Volumes/Vader/Marco/antessala/scripts/extract.mjs`.

| Arquivo | Itens | Bytes | SHA-256 |
|---|---:|---:|---|
| `cid10.json.gz` | 14.793 | 624.180 | `24e646c92318c23ae9ba7803bd2df1961cb272d361055f94e44f6b75e1a80b20` |
| `medicamentos.json` | 382 | 83.058 | `82710228c24915db14f3ba48819f4e3257de2abf2b6cb161b08afc4142f5d4b3` |
| `grupos-risco.json` | 12 | 1.858 | `2f86cc6c7e5ab0ca1ba9ea397364a176cf90e0fc4e2412dd9796fbc6911593d9` |
| `met.json` | 94 | 10.878 | `8ecbd5ff81fba218687abbcc6af589212cf0e347f4291598e10bd09be9334dad` |
| `comorbidades.json` | 14 | 2.063 | `98b56c6239f3b26e74c5916b36995b46993249398b3fc1d6f66afa44c79958c3` |

Limites conhecidos:

- O CID-10 completo preserva os 22 capítulos, 275 grupos, 2.045 categorias e
  12.451 subcategorias do snapshot do DietFlow. O arquivo original tem SHA-256
  `9562faed57d7aa69d7dcce8dfbad91a53cea0fc2b2cab65004417127da0f6ef9`;
  a tabela acima registra o hash do `.gz` efetivamente embarcado.
- As 382 medicações são o recorte perioperatório, não a base ANVISA inteira.
- Há 14 comorbidades; 11 têm CID associado e três (`arritmia`,
  `apneia-do-sono`, `tabagismo`) não têm código no recorte.
- O arquivo de grupos preserva a conduta e o peso, mas não o mapa auditável de
  classes por grupo; esse mapa continua no extrator de origem.
- Os equivalentes metabólicos preservam `met` e `metMax`; o intervalo total é
  de 1 a 16 MET.
- A origem está documentada, mas a licença de redistribuição dos dados ainda
  precisa de confirmação antes de uma distribuição pública.

Esses catálogos não determinam quais widgets ou templates entram na triagem.
Essa decisão pertence a `hack/specs/02-quais-widgets/`.
