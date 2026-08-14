import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { execute, queryOne, transaction } from './query'
import { seedProtocolos } from './protocolos'

type CatalogFile<T> = {
  _meta: Record<string, unknown>
  itens: T[]
}

type CidFile = {
  _meta: Record<string, unknown>
  data: Array<{
    codigo: string
    descricao: string
    descAbrev?: string | null
    nivel: 'CAPITULO' | 'GRUPO' | 'CATEGORIA' | 'SUBCATEGORIA'
    parentCodigo?: string | null
    capituloNum?: number | null
    capituloDesc?: string | null
    grupoIni?: string | null
    grupoFim?: string | null
    grupoDesc?: string | null
    categoriaCod?: string | null
    relevanceScore?: number | null
    popularityScore?: number | null
    searchText?: string | null
    searchTerms?: string[]
  }>
}

type Medicamento = {
  id: string
  nome: string
  principio: string
  comerciais: string[]
  classe: string
  grupo: string
}

type GrupoRisco = {
  id: string
  rotulo: string
  conduta: string
  peso: 'alto' | 'medio' | 'baixo'
}

type Met = {
  id: string
  nome: string
  categoria: string
  met: number
  metMax: number
}

type Comorbidade = {
  id: string
  rotulo: string
  cid: Array<{ codigo: string; descricao: string }>
}

const ASSET_HASHES = {
  'cid10.json.gz': '24e646c92318c23ae9ba7803bd2df1961cb272d361055f94e44f6b75e1a80b20',
  'medicamentos.json': '69d119dc485a57eca755d701d594f9c47b7b519c280b74af757e63a4ddaa6fb0',
  'grupos-risco.json': '2f86cc6c7e5ab0ca1ba9ea397364a176cf90e0fc4e2412dd9796fbc6911593d9',
  'met.json': 'c0dd4d1a2297b62be1e9868ac0a1945af6a63879542d6b3972dce6637e719205',
  'comorbidades.json': '2577e127f9f8b4d239944a5b9fa4954d0141f84f1a263be16420ec07da66c99c',
} as const

const SEED_REVISION = createHash('sha256')
  .update(Object.entries(ASSET_HASHES).map(([name, hash]) => `${name}:${hash}`).join('|'))
  .digest('hex')

function resolveCatalogDir(): string {
  try {
    const electron = require('electron') as { app?: { isPackaged?: boolean } }
    if (electron.app?.isPackaged) return path.join(process.resourcesPath, 'clinical-data')
  } catch {
    // Vitest e scripts Node usam o checkout local abaixo.
  }
  return path.join(process.cwd(), 'src/data/catalogos')
}

function readCatalogJson<T>(filename: keyof typeof ASSET_HASHES): T {
  const filepath = path.join(resolveCatalogDir(), filename)
  const bytes = fs.readFileSync(filepath)
  const actualHash = createHash('sha256').update(bytes).digest('hex')
  const expectedHash = ASSET_HASHES[filename]
  if (actualHash !== expectedHash) {
    throw new Error(`Catálogo ${filename} divergiu do hash versionado.`)
  }
  const jsonBytes = filename.endsWith('.gz') ? gunzipSync(bytes) : bytes
  return JSON.parse(jsonBytes.toString('utf8')) as T
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function cidId(nivel: CidFile['data'][number]['nivel'], codigo: string): string {
  return `${nivel.toLowerCase()}:${codigo}`
}

function cidParentId(item: CidFile['data'][number]): string | null {
  if (!item.parentCodigo) return null
  if (item.nivel === 'GRUPO') return cidId('CAPITULO', item.parentCodigo)
  if (item.nivel === 'CATEGORIA') return cidId('GRUPO', item.parentCodigo)
  if (item.nivel === 'SUBCATEGORIA') return cidId('CATEGORIA', item.parentCodigo)
  return null
}

async function insertJsonRows(
  sql: string,
  rows: unknown[],
  chunkSize = 1_000,
): Promise<void> {
  for (let index = 0; index < rows.length; index += chunkSize) {
    await execute(sql, JSON.stringify(rows.slice(index, index + chunkSize)))
  }
}

/**
 * Primeiro boot inteiramente local. Lê apenas assets versionados no bundle e
 * grava o PGlite embarcado. Não chama embeddings, RAG, LLM ou rede.
 */
export async function seedData(): Promise<void> {
  await execute(
    `INSERT INTO config (key, value) VALUES ('onboarding_complete', 'false'::jsonb)
     ON CONFLICT (key) DO NOTHING`,
  )

  // Antes da checagem de revisão: os catálogos são substituídos quando o asset
  // muda, os protocolos não — eles só nascem, e depois pertencem ao operador.
  await seedProtocolos()

  const current = await queryOne<{ sha256: string }>(
    `SELECT sha256 FROM catalogo_seed_state WHERE catalogo = 'clinical-v1'`,
  )
  if (current?.sha256 === SEED_REVISION) {
    console.log('[seed] Catálogos clínicos offline já estão sincronizados.')
    return
  }

  const cid = readCatalogJson<CidFile>('cid10.json.gz')
  const medicamentos = readCatalogJson<CatalogFile<Medicamento>>('medicamentos.json')
  const gruposRisco = readCatalogJson<CatalogFile<GrupoRisco>>('grupos-risco.json')
  const met = readCatalogJson<CatalogFile<Met>>('met.json')
  const comorbidades = readCatalogJson<CatalogFile<Comorbidade>>('comorbidades.json')

  const classes = [...new Set(medicamentos.itens.map((item) => item.classe))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((nome) => ({ id: slug(nome), nome }))
  const classePorNome = new Map(classes.map((item) => [item.nome, item.id]))

  await transaction(async () => {
    await execute('DELETE FROM catalogo_medicamentos')
    await execute('DELETE FROM catalogo_classes_terapeuticas')
    await execute('DELETE FROM catalogo_grupos_risco')
    await execute('DELETE FROM catalogo_met')
    await execute('DELETE FROM catalogo_comorbidades')
    await execute('DELETE FROM catalogo_cid10')

    await insertJsonRows(
      `INSERT INTO catalogo_cid10 (
         id, codigo, descricao, descricao_abreviada, nivel, parent_id,
         capitulo_num, capitulo_descricao, grupo_inicio, grupo_fim,
         grupo_descricao, categoria_codigo, relevancia, popularidade,
         search_text, search_terms
       )
       SELECT id, codigo, descricao, descricao_abreviada, nivel, parent_id,
              capitulo_num, capitulo_descricao, grupo_inicio, grupo_fim,
              grupo_descricao, categoria_codigo, relevancia, popularidade,
              search_text, search_terms
       FROM jsonb_to_recordset($1::jsonb) AS row(
         id TEXT, codigo TEXT, descricao TEXT, descricao_abreviada TEXT,
         nivel TEXT, parent_id TEXT, capitulo_num INTEGER,
         capitulo_descricao TEXT, grupo_inicio TEXT, grupo_fim TEXT,
         grupo_descricao TEXT, categoria_codigo TEXT, relevancia INTEGER,
         popularidade INTEGER, search_text TEXT, search_terms JSONB
       )`,
      cid.data.map((item) => ({
        id: cidId(item.nivel, item.codigo),
        codigo: item.codigo,
        descricao: item.descricao,
        descricao_abreviada: item.descAbrev ?? null,
        nivel: item.nivel,
        parent_id: cidParentId(item),
        capitulo_num: item.capituloNum ?? null,
        capitulo_descricao: item.capituloDesc ?? null,
        grupo_inicio: item.grupoIni ?? null,
        grupo_fim: item.grupoFim ?? null,
        grupo_descricao: item.grupoDesc ?? null,
        categoria_codigo: item.categoriaCod ?? null,
        relevancia: item.relevanceScore ?? null,
        popularidade: item.popularityScore ?? null,
        search_text: item.searchText ?? `${item.codigo} ${item.descricao}`,
        search_terms: item.searchTerms ?? [],
      })),
    )

    await insertJsonRows(
      `INSERT INTO catalogo_grupos_risco (id, rotulo, conduta, peso)
       SELECT id, rotulo, conduta, peso
       FROM jsonb_to_recordset($1::jsonb) AS row(
         id TEXT, rotulo TEXT, conduta TEXT, peso TEXT
       )`,
      gruposRisco.itens,
    )

    await insertJsonRows(
      `INSERT INTO catalogo_classes_terapeuticas (id, nome)
       SELECT id, nome
       FROM jsonb_to_recordset($1::jsonb) AS row(id TEXT, nome TEXT)`,
      classes,
    )

    await insertJsonRows(
      `INSERT INTO catalogo_medicamentos (
         id, nome, principio_ativo, nomes_comerciais, classe_id, grupo_risco_id
       )
       SELECT id, nome, principio_ativo, nomes_comerciais, classe_id, grupo_risco_id
       FROM jsonb_to_recordset($1::jsonb) AS row(
         id TEXT, nome TEXT, principio_ativo TEXT, nomes_comerciais JSONB,
         classe_id TEXT, grupo_risco_id TEXT
       )`,
      medicamentos.itens.map((item) => ({
        id: item.id,
        nome: item.nome,
        principio_ativo: item.principio,
        nomes_comerciais: item.comerciais,
        classe_id: classePorNome.get(item.classe) ?? null,
        grupo_risco_id: item.grupo || null,
      })),
    )

    await insertJsonRows(
      `INSERT INTO catalogo_met (id, nome, categoria, met_min, met_max)
       SELECT id, nome, categoria, met_min, met_max
       FROM jsonb_to_recordset($1::jsonb) AS row(
         id TEXT, nome TEXT, categoria TEXT, met_min REAL, met_max REAL
       )`,
      met.itens.map((item) => ({
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        met_min: item.met,
        met_max: item.metMax,
      })),
    )

    await insertJsonRows(
      `INSERT INTO catalogo_comorbidades (id, rotulo, cid)
       SELECT id, rotulo, cid
       FROM jsonb_to_recordset($1::jsonb) AS row(
         id TEXT, rotulo TEXT, cid JSONB
       )`,
      comorbidades.itens,
    )

    const total =
      cid.data.length +
      classes.length +
      gruposRisco.itens.length +
      medicamentos.itens.length +
      met.itens.length +
      comorbidades.itens.length
    await execute(
      `INSERT INTO catalogo_seed_state (catalogo, sha256, quantidade, carregado_em)
       VALUES ('clinical-v1', $1, $2, NOW())
       ON CONFLICT (catalogo) DO UPDATE SET
         sha256 = EXCLUDED.sha256,
         quantidade = EXCLUDED.quantidade,
         carregado_em = NOW()`,
      SEED_REVISION,
      total,
    )
  })

  console.log(
    `[seed] Catálogos clínicos offline carregados: ${cid.data.length} CID-10, ` +
      `${medicamentos.itens.length} medicamentos, ${classes.length} classes, ` +
      `${gruposRisco.itens.length} grupos de risco, ${met.itens.length} MET e ` +
      `${comorbidades.itens.length} comorbidades.`,
  )
}
