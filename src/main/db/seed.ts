import fs from 'node:fs'
import path from 'node:path'
import { getDb } from './pglite'
import { queryOne, queryAll, execute } from './query'
import { ingestKnowledge } from '../knowledge/ingest'
import { generatePassageEmbedding } from '../knowledge/embeddings'
import { importGraphSeed } from '../knowledge/graph'

// =============================================================================
// Path resolution: dev vs packaged
// =============================================================================

function resolveKnowledgePath(): string {
  try {
    const electron = require('electron') as { app?: { isPackaged?: boolean } }
    if (electron.app?.isPackaged) {
      return path.join(process.resourcesPath, 'knowledge')
    }
  } catch {
    // fallback: test runner / scripts
  }
  // Dev/test: use process.cwd() (project root)
  // Fallback: __dirname relative (out/main/ → ../../knowledge)
  const cwdPath = path.join(process.cwd(), 'knowledge')
  if (fs.existsSync(cwdPath)) return cwdPath
  return path.join(__dirname, '../../knowledge')
}

// =============================================================================
// SEED — 3-phase knowledge bootstrap
// =============================================================================

/** Docs to seed on first boot (filename → display title) */
const SEED_DOCS: Array<{ filename: string; titulo: string }> = [
  { filename: 'CLAUDE.md', titulo: 'sistema — CLAUDE' },
  { filename: 'ARCHITECTURE.md', titulo: 'sistema — ARCHITECTURE' },
  { filename: 'PLUG-AND-PLAY.md', titulo: 'sistema — PLUG-AND-PLAY' },
]

export async function seedData(): Promise<void> {
  const db = getDb()

  // Config onboarding
  await db.query(`
    INSERT INTO config (key, value) VALUES ('onboarding_complete', '"false"')
    ON CONFLICT (key) DO NOTHING
  `)

  // Check if knowledge already seeded (idempotent)
  const existing = await queryOne<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM knowledge_sources WHERE tipo = 'sistema'`,
  )
  if ((existing?.c ?? 0) > 0) {
    console.log('[seed] Knowledge already seeded — skipping')
    return
  }

  console.log('[seed] ══════════════════════════════════════════════')
  console.log('[seed] First boot — seeding knowledge base (3 phases)')
  console.log('[seed] ══════════════════════════════════════════════')

  const knowledgePath = resolveKnowledgePath()
  const sistemaPath = path.join(knowledgePath, 'sistema')
  const seedPath = path.join(knowledgePath, 'seed')

  // ─── Phase 1: Ingest docs ─────────────────────────────────────────────
  console.log('[seed] Phase 1: Ingesting system docs...')
  const sourceIds = new Map<string, number>()

  for (const doc of SEED_DOCS) {
    const filePath = path.join(sistemaPath, doc.filename)
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf-8')
    } catch {
      console.warn(`[seed]   ⚠ File not found: ${filePath} — skipping`)
      continue
    }
    try {
      const result = await ingestKnowledge(doc.titulo, content, 'high', { tipo: 'sistema' })
      sourceIds.set(doc.titulo, result.source_id)
      console.log(`[seed]   ✓ ${doc.titulo} → ${result.chunks_count} chunks (source_id: ${result.source_id})`)
    } catch (err) {
      console.error(`[seed]   ✗ Failed to ingest ${doc.titulo}:`, (err as Error).message)
    }
  }

  // ─── Phase 2: Apply enrichment seed ────────────────────────────────────
  console.log('[seed] Phase 2: Applying enrichment seed...')
  const enrichmentFile = path.join(seedPath, 'enrichment-seed.json')

  try {
    const enrichmentRaw = fs.readFileSync(enrichmentFile, 'utf-8')
    try {
      const enrichmentData = JSON.parse(enrichmentRaw)
      let enrichedCount = 0

      for (const source of enrichmentData.sources) {
        const sourceId = sourceIds.get(source.titulo)
        if (!sourceId) {
          console.warn(`[seed]   ⚠ No source_id for "${source.titulo}" — skipping enrichment`)
          continue
        }

        // Get chunks for this source ordered by id (same order as insertion)
        const chunks = await queryAll<{ id: number; conteudo: string }>(
          `SELECT id, conteudo FROM knowledge_chunks WHERE source_id = $1 ORDER BY id`,
          sourceId,
        )

        for (const enrichment of source.chunks) {
          const chunk = chunks[enrichment.chunk_index]
          if (!chunk) {
            console.warn(`[seed]   ⚠ Chunk index ${enrichment.chunk_index} not found for "${source.titulo}"`)
            continue
          }

          // Build enriched text (same pattern as enrichment.ts applyEnrichmentToChunk)
          const tagsStr = enrichment.tags.join(', ')
          const enrichedText = `[Resumo: ${enrichment.resumo}]\n[Tags: ${tagsStr}]\n\n${chunk.conteudo}`

          const enrichmentJson = JSON.stringify({
            resumo: enrichment.resumo,
            tags: enrichment.tags,
            entidades: enrichment.entidades.length,
            relacoes: enrichment.relacoes.length,
          })

          // Re-embed with enriched text (graceful: null if model unavailable)
          let embeddingJson: string | null = null
          try {
            const embedding = await generatePassageEmbedding(enrichedText)
            embeddingJson = embedding ? JSON.stringify(embedding) : null
          } catch {
            // Embedding model not ready — fine, FTS still works
          }

          if (embeddingJson) {
            await execute(
              `UPDATE knowledge_chunks
               SET embedding = $1::vector,
                   search_tsv = to_tsvector('portuguese', $2),
                   enrichment_json = $3,
                   enriched_at = NOW()
               WHERE id = $4`,
              embeddingJson,
              enrichedText,
              enrichmentJson,
              chunk.id,
            )
          } else {
            await execute(
              `UPDATE knowledge_chunks
               SET search_tsv = to_tsvector('portuguese', $1),
                   enrichment_json = $2,
                   enriched_at = NOW()
               WHERE id = $3`,
              enrichedText,
              enrichmentJson,
              chunk.id,
            )
          }

          enrichedCount++
        }
      }

      console.log(`[seed]   ✓ Enriched ${enrichedCount} chunks`)
    } catch (err) {
      console.error('[seed]   ✗ Enrichment seed failed:', (err as Error).message)
    }
  } catch {
    console.warn('[seed]   ⚠ enrichment-seed.json not found — skipping')
  }

  // ─── Phase 3: Import graph seed ───────────────────────────────────────
  console.log('[seed] Phase 3: Importing graph seed...')
  const graphFile = path.join(seedPath, 'graph-seed.json')

  try {
    const graphRaw = fs.readFileSync(graphFile, 'utf-8')
    try {
      const graphData = JSON.parse(graphRaw)
      const result = await importGraphSeed(graphData, 'sistema')
      console.log(`[seed]   ✓ Graph: ${result.entities_count} entities, ${result.relations_count} relations`)
    } catch (err) {
      console.error('[seed]   ✗ Graph seed failed:', (err as Error).message)
    }
  } catch {
    console.warn('[seed]   ⚠ graph-seed.json not found — skipping')
  }

  console.log('[seed] ══════════════════════════════════════════════')
  console.log('[seed] Knowledge seed complete!')
  console.log('[seed] ══════════════════════════════════════════════')
}
