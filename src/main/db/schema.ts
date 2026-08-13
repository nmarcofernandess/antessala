import { execDDL } from './query'

// ══════════════════════════════════════════
// CORE
// ══════════════════════════════════════════

const DDL_CORE = `
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS configuracao_ia (
  id INTEGER PRIMARY KEY DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'gemini',
  api_key TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT 'gemini-3.5-flash',
  provider_configs_json TEXT NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT FALSE,
  memoria_automatica BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

// ══════════════════════════════════════════
// KNOWLEDGE (RAG)
// ══════════════════════════════════════════

const DDL_KNOWLEDGE = `
CREATE TABLE IF NOT EXISTS knowledge_groups (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  origem TEXT NOT NULL DEFAULT 'usuario',
  metadata JSONB DEFAULT '{}',
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_import_jobs (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES knowledge_groups(id) ON DELETE CASCADE,
  root_path TEXT NOT NULL,
  recursive BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scanning', 'importing', 'embedding', 'enriching', 'paused', 'done', 'partial', 'failed', 'cancelled')),
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  failed_files INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  processed_bytes BIGINT NOT NULL DEFAULT 0,
  chunks_created INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'manual'
    CHECK (tipo IN ('manual', 'auto_capture', 'sistema', 'importacao_usuario', 'importacao_conversa', 'session')),
  titulo TEXT NOT NULL,
  conteudo_original TEXT NOT NULL,
  group_id INTEGER REFERENCES knowledge_groups(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  importance TEXT NOT NULL DEFAULT 'high'
    CHECK (importance IN ('high', 'low')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id SERIAL PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  embedding vector(768),
  search_tsv TSVECTOR,
  importance TEXT NOT NULL DEFAULT 'high'
    CHECK (importance IN ('high', 'low')),
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  enriched_at TIMESTAMPTZ,
  enrichment_json TEXT,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_import_files (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES knowledge_import_jobs(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES knowledge_sources(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  mtime_ms BIGINT NOT NULL DEFAULT 0,
  sha256 TEXT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reading', 'chunking', 'embedding', 'done', 'failed', 'skipped')),
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_entities (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  embedding vector(768),
  origem TEXT NOT NULL DEFAULT 'usuario',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ DEFAULT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(nome, tipo)
);

CREATE TABLE IF NOT EXISTS knowledge_relations (
  id SERIAL PRIMARY KEY,
  entity_from_id INTEGER NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  entity_to_id INTEGER NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  tipo_relacao TEXT NOT NULL,
  peso REAL NOT NULL DEFAULT 1.0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ DEFAULT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

// ══════════════════════════════════════════
// IA CHAT
// ══════════════════════════════════════════

const DDL_IA_CHAT = `
CREATE TABLE IF NOT EXISTS ia_conversas (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL DEFAULT 'Nova conversa',
  status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'arquivado')),
  resumo_compactado TEXT,
  indexada_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ia_mensagens (
  id TEXT PRIMARY KEY,
  conversa_id TEXT NOT NULL REFERENCES ia_conversas(id) ON DELETE CASCADE,
  papel TEXT NOT NULL
    CHECK (papel IN ('usuario', 'assistente', 'tool_result')),
  conteudo TEXT NOT NULL,
  tool_calls_json TEXT,
  anexos_meta_json TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ia_memorias (
  id SERIAL PRIMARY KEY,
  conteudo TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'manual',
  embedding vector(768),
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

// ══════════════════════════════════════════
// GALLERY
// ══════════════════════════════════════════

const DDL_GALLERY = `
CREATE TABLE IF NOT EXISTS gallery_images (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  nome_original TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'upload',
  tipo TEXT NOT NULL DEFAULT 'image',
  conversa_id TEXT REFERENCES ia_conversas(id) ON DELETE SET NULL,
  source_id INTEGER REFERENCES knowledge_sources(id) ON DELETE SET NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  mime_type TEXT,
  ai_descricao TEXT,
  ai_tags TEXT[],
  ai_confianca REAL,
  ai_provider TEXT,
  analisado BOOLEAN NOT NULL DEFAULT FALSE,
  curtido BOOLEAN NOT NULL DEFAULT FALSE,
  favorito BOOLEAN NOT NULL DEFAULT FALSE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

// ══════════════════════════════════════════
// TERMINAL HARNESS
// ══════════════════════════════════════════

const DDL_TERMINAL = `
CREATE TABLE IF NOT EXISTS terminal_command_log (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'api',
  command TEXT NOT NULL,
  cwd TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('executed', 'failed')),
  exit_code INTEGER,
  timed_out BOOLEAN NOT NULL DEFAULT FALSE,
  output_preview TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
`

// ══════════════════════════════════════════
// INDEXES
// ══════════════════════════════════════════

const DDL_INDEXES = `
-- Knowledge: FTS + trigram
CREATE INDEX IF NOT EXISTS idx_chunks_tsv
  ON knowledge_chunks USING gin(search_tsv);
CREATE INDEX IF NOT EXISTS idx_chunks_trgm
  ON knowledge_chunks USING gin(conteudo gin_trgm_ops);

-- Knowledge: HNSW vector similarity
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- Knowledge import groups/jobs
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_group
  ON knowledge_sources(group_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_groups_nome
  ON knowledge_groups(nome);
CREATE INDEX IF NOT EXISTS idx_knowledge_import_jobs_group
  ON knowledge_import_jobs(group_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_import_jobs_status
  ON knowledge_import_jobs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_import_files_job
  ON knowledge_import_files(job_id, status);

-- Knowledge Graph: relation lookups
CREATE INDEX IF NOT EXISTS idx_relations_from
  ON knowledge_relations(entity_from_id);
CREATE INDEX IF NOT EXISTS idx_relations_to
  ON knowledge_relations(entity_to_id);

-- IA Chat: message ordering + conversation filtering
CREATE INDEX IF NOT EXISTS idx_ia_mensagens_conversa
  ON ia_mensagens(conversa_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_ia_conversas_status
  ON ia_conversas(status, atualizado_em DESC);

-- Gallery: common filters
CREATE INDEX IF NOT EXISTS idx_gallery_origem
  ON gallery_images(origem);
CREATE INDEX IF NOT EXISTS idx_gallery_conversa
  ON gallery_images(conversa_id);

-- Terminal: command audit
CREATE INDEX IF NOT EXISTS idx_terminal_command_log_started
  ON terminal_command_log(started_at DESC);
`

// ══════════════════════════════════════════
// MIGRATIONS (safe, idempotent)
// ══════════════════════════════════════════

const DDL_MIGRATIONS = `
-- Bulk RAG groups/jobs retrofit for existing databases.
DO $$ BEGIN
  ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES knowledge_groups(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Bulk RAG imports can finish with imported data plus file/enrichment warnings.
DO $$ BEGIN
  ALTER TABLE knowledge_import_jobs DROP CONSTRAINT IF EXISTS knowledge_import_jobs_status_check;
  ALTER TABLE knowledge_import_jobs ADD CONSTRAINT knowledge_import_jobs_status_check
    CHECK (status IN ('pending', 'scanning', 'importing', 'embedding', 'enriching', 'paused', 'done', 'partial', 'failed', 'cancelled'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Allow 'decayed' importance for cron lazy-decay (Step 5)
DO $$ BEGIN
  ALTER TABLE knowledge_chunks DROP CONSTRAINT IF EXISTS knowledge_chunks_importance_check;
  ALTER TABLE knowledge_chunks ADD CONSTRAINT knowledge_chunks_importance_check
    CHECK (importance IN ('high', 'low', 'decayed'));
EXCEPTION WHEN others THEN NULL;
END $$;
`

// ══════════════════════════════════════════
// ENTRY POINT
// ══════════════════════════════════════════

export async function createTables(): Promise<void> {
  await execDDL(DDL_CORE)
  await execDDL(DDL_KNOWLEDGE)
  await execDDL(DDL_IA_CHAT)
  await execDDL(DDL_GALLERY)
  await execDDL(DDL_TERMINAL)
  await execDDL(DDL_MIGRATIONS)
  await execDDL(DDL_INDEXES)
  console.log('[DB] Tabelas criadas com sucesso (FlowKit v1)')
}
