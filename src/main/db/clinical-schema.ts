import { execDDL } from './query'

/**
 * Schema clínico legado da hipótese invalidada e catálogos locais reaproveitáveis.
 *
 * `registros`, prioridade e `registro_jornada` são provisórios: não representam o
 * paciente institucional, o caso pré-anestésico nem o fluxo canônico. Não amplie essa
 * superfície antes do mapa de migração aprovado pelo Analyst.
 */
const DDL_CLINICAL = `
CREATE TABLE IF NOT EXISTS registros (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  sexo TEXT NOT NULL CHECK (length(trim(sexo)) > 0),
  idade INTEGER NOT NULL CHECK (idade BETWEEN 0 AND 130),
  plano TEXT NOT NULL CHECK (length(trim(plano)) > 0),
  anamnese JSONB NOT NULL DEFAULT '{"_v":2,"blocos":[]}'::jsonb
    CHECK (
      anamnese->>'_v' = '2'
      AND jsonb_typeof(anamnese->'blocos') = 'array'
    ),
  prioridade SMALLINT
    CHECK (prioridade IS NULL OR prioridade BETWEEN 1 AND 4),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registro_jornada (
  id BIGSERIAL PRIMARY KEY,
  registro_id TEXT NOT NULL REFERENCES registros(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL CHECK (estado IN (
    'aguardando_triagem',
    'anamnese_em_andamento',
    'na_fila',
    'analisado_pelo_especialista',
    'no_hub',
    'encerrado'
  )),
  entrou_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION bloquear_mutacao_registro_jornada()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'registro_jornada é append-only; grave um novo marco';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS registro_jornada_append_only ON registro_jornada;
CREATE TRIGGER registro_jornada_append_only
BEFORE UPDATE OR DELETE ON registro_jornada
FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_registro_jornada();

CREATE TABLE IF NOT EXISTS catalogo_seed_state (
  catalogo TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade >= 0),
  carregado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalogo_cid10 (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  descricao_abreviada TEXT,
  nivel TEXT NOT NULL CHECK (nivel IN ('CAPITULO', 'GRUPO', 'CATEGORIA', 'SUBCATEGORIA')),
  parent_id TEXT,
  capitulo_num INTEGER,
  capitulo_descricao TEXT,
  grupo_inicio TEXT,
  grupo_fim TEXT,
  grupo_descricao TEXT,
  categoria_codigo TEXT,
  relevancia INTEGER,
  popularidade INTEGER,
  search_text TEXT,
  search_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (nivel, codigo)
);

CREATE TABLE IF NOT EXISTS catalogo_classes_terapeuticas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS catalogo_grupos_risco (
  id TEXT PRIMARY KEY,
  rotulo TEXT NOT NULL,
  conduta TEXT NOT NULL,
  peso TEXT NOT NULL CHECK (peso IN ('alto', 'medio', 'baixo'))
);

CREATE TABLE IF NOT EXISTS catalogo_medicamentos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  principio_ativo TEXT NOT NULL,
  nomes_comerciais JSONB NOT NULL DEFAULT '[]'::jsonb,
  classe_id TEXT REFERENCES catalogo_classes_terapeuticas(id) ON DELETE RESTRICT,
  grupo_risco_id TEXT REFERENCES catalogo_grupos_risco(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS catalogo_met (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  met_min REAL NOT NULL CHECK (met_min >= 0),
  met_max REAL NOT NULL CHECK (met_max >= met_min)
);

CREATE TABLE IF NOT EXISTS catalogo_comorbidades (
  id TEXT PRIMARY KEY,
  rotulo TEXT NOT NULL,
  cid JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_registros_criado_em
  ON registros(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_registro_jornada_atual
  ON registro_jornada(registro_id, entrou_em DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_cid10_codigo
  ON catalogo_cid10(codigo);
CREATE INDEX IF NOT EXISTS idx_cid10_busca
  ON catalogo_cid10 USING gin(to_tsvector('portuguese', search_text));
CREATE INDEX IF NOT EXISTS idx_medicamentos_nome
  ON catalogo_medicamentos(nome);
`

/**
 * Protocolos de coleta da anamnese.
 *
 * Um protocolo é uma composição versionada de blocos e nunca guarda resposta,
 * pessoa, caso ou proveniência clínica — só quais perguntas o formulário faz e
 * em que ordem. `procedimentos` é a lista de procedimentos que o aplicam; um
 * procedimento sem protocolo cai no geral.
 *
 * A composição é `TEXT[]` de tipos de widget, não blocos materializados: o
 * blueprint precisa acompanhar a evolução do widget, e blob congelado no
 * momento da autoria não acompanha.
 */
const DDL_PROTOCOLOS = `
CREATE TABLE IF NOT EXISTS protocolos_anamnese (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  regime TEXT NOT NULL DEFAULT '',
  blocos TEXT[] NOT NULL DEFAULT '{}',
  procedimentos TEXT[] NOT NULL DEFAULT '{}',
  versao INTEGER NOT NULL DEFAULT 1 CHECK (versao >= 1),
  origem TEXT NOT NULL DEFAULT 'FIXTURE' CHECK (origem IN ('FIXTURE', 'OPERADOR')),
  arquivado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_protocolos_ativos
  ON protocolos_anamnese(nome) WHERE arquivado_em IS NULL;
`

export async function createClinicalTables(): Promise<void> {
  await execDDL(DDL_CLINICAL)
  await execDDL(DDL_PROTOCOLOS)
}
