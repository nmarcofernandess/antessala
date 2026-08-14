# Catálogos clínicos offline

Estes arquivos são versionados e embarcados no bundle do Antessala. O primeiro
boot os carrega no PGlite local; nenhuma consulta à internet ou ao banco do
DietFlow participa desse fluxo.

Origem técnica: `DietFlow/prisma/seeds/system` e os recortes clínicos fornecidos
em `/Volumes/Vader/Marco/antessala/src/data/`. O extrator ad hoc da primeira
extração não foi versionado nem permaneceu disponível; portanto uma futura
regeneração deve começar por um extrator reprodutível no próprio repositório.
Os arquivos desta entrega são selados pelos hashes abaixo.

| Arquivo | Itens | Bytes | SHA-256 |
|---|---:|---:|---|
| `cid10.json.gz` | 14.793 | 624.180 | `24e646c92318c23ae9ba7803bd2df1961cb272d361055f94e44f6b75e1a80b20` |
| `medicamentos.json` | 382 | 87.883 | `69d119dc485a57eca755d701d594f9c47b7b519c280b74af757e63a4ddaa6fb0` |
| `grupos-risco.json` | 12 | 1.858 | `2f86cc6c7e5ab0ca1ba9ea397364a176cf90e0fc4e2412dd9796fbc6911593d9` |
| `met.json` | 94 | 9.898 | `c0dd4d1a2297b62be1e9868ac0a1945af6a63879542d6b3972dce6637e719205` |
| `comorbidades.json` | 14 | 2.147 | `2577e127f9f8b4d239944a5b9fa4954d0141f84f1a263be16420ec07da66c99c` |

Limites conhecidos:

- O CID-10 completo preserva os 22 capítulos, 275 grupos, 2.045 categorias e
  12.451 subcategorias do snapshot do DietFlow. O arquivo original tem SHA-256
  `9562faed57d7aa69d7dcce8dfbad91a53cea0fc2b2cab65004417127da0f6ef9`;
  a tabela acima registra o hash do `.gz` efetivamente embarcado.
- As 382 medicações são o recorte perioperatório, não a base ANVISA inteira.
- As 14 comorbidades têm ao menos um CID associado; são 17 referências no total,
  validadas contra o snapshot completo.
- Os 382 medicamentos preservam 1.447 aliases, deduplicados dentro de cada
  medicamento por caixa, acento e espaços.
- O arquivo de grupos preserva a conduta e o peso, mas não um mapa autônomo e
  auditável de classes por grupo. Como o extrator original não foi preservado,
  esse vínculo precisa ser especificado antes de uma regeneração.
- Os 94 equivalentes metabólicos preservam os nomes canônicos, `met` e `metMax`;
  o intervalo total é de 1 a 16 MET.
- A origem está documentada, mas a licença de redistribuição dos dados ainda
  precisa de confirmação antes de uma distribuição pública.

Esses catálogos não determinam quais widgets, protocolos ou templates entram na
triagem. Eles serão auditados pelo Analyst e só poderão alimentar o contrato clínico
depois do `PASS` da `hack/minispecs/002-triagem-decisao-humana/`.
