import { queryOne, queryAll, execute } from '../db/query'
import type { CronResult, CronStepResult, IaMensagem } from '../../shared/types'

// =============================================================================
// CONFIG HELPERS — config table is key-value (key TEXT, value JSONB)
// =============================================================================

async function getConfigValue(key: string): Promise<string | null> {
  const row = await queryOne<{ value: unknown }>('SELECT value FROM config WHERE key = $1', key)
  if (!row) return null
  // JSONB comes back parsed — could be string, number, etc.
  const v = row.value
  if (typeof v === 'string') return v
  if (v !== null && v !== undefined) return String(v)
  return null
}

async function setConfigValue(key: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO config (key, value) VALUES ($1, to_jsonb($2::text))
     ON CONFLICT (key) DO UPDATE SET value = to_jsonb($2::text)`,
    key,
    value,
  )
}

// =============================================================================
// CONSTANTS
// =============================================================================

const GUARD_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24h
const MIN_MESSAGES_FOR_EXTRACTION = 5
const DECAY_DAYS = 30

// =============================================================================
// PIPELINE
// =============================================================================

export async function runCronPipeline(): Promise<CronResult> {
  const t0 = Date.now()
  const steps: CronStepResult[] = []

  try {
    // ─── Step 1: Guard 24h ───────────────────────────────────────
    const lastRunStr = await getConfigValue('cron_last_run')
    if (lastRunStr) {
      const elapsed = Date.now() - new Date(lastRunStr).getTime()
      if (elapsed < GUARD_INTERVAL_MS) {
        return {
          status: 'skipped',
          reason: 'ran_recently',
          steps: [],
          duracao_ms: Date.now() - t0,
        }
      }
    }
    steps.push({ name: 'guard_24h', status: 'ok' })

    // ─── Shared: LLM factory (used by Steps 2 & 3) ────────────────
    const { buildModelFactory } = await import('../ia/config')
    const iaConfig = await queryOne<{
      provider: 'gemini' | 'openrouter' | 'local'
      api_key: string
      modelo: string
      provider_configs_json?: string
    }>('SELECT provider, api_key, modelo, provider_configs_json FROM configuracao_ia WHERE id = 1')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const factory = iaConfig ? buildModelFactory(iaConfig as any) : null

    // ─── Step 2: Enrichment pendente ─────────────────────────────
    try {
      const pendingCount = await queryOne<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM knowledge_chunks WHERE enriched_at IS NULL`,
      )
      const pending = pendingCount?.c ?? 0

      if (pending === 0) {
        steps.push({ name: 'enrichment', status: 'skipped' })
      } else if (!factory) {
        steps.push({ name: 'enrichment', status: 'skipped' })
      } else {
        const { enrichAllChunks } = await import('../knowledge/enrichment')
        await enrichAllChunks(factory.createModel, factory.modelo)
        steps.push({ name: 'enrichment', status: 'ok' })
      }
    } catch (err) {
      steps.push({ name: 'enrichment', status: 'error', error: (err as Error).message })
    }

    // ─── Step 3: Memory extraction ───────────────────────────────
    try {
      if (!factory) {
        steps.push({ name: 'memory_extraction', status: 'skipped' })
      } else {
        const lastRun = lastRunStr ?? '1970-01-01T00:00:00Z'
        const conversas = await queryAll<{ id: string }>(
          `SELECT c.id FROM ia_conversas c
           WHERE c.atualizado_em > $1
             AND (SELECT COUNT(*)::int FROM ia_mensagens m WHERE m.conversa_id = c.id) > $2`,
          lastRun,
          MIN_MESSAGES_FOR_EXTRACTION,
        )

        if (conversas.length === 0) {
          steps.push({ name: 'memory_extraction', status: 'skipped' })
        } else {
          // Batch-fetch all messages to avoid N+1 queries
          const allMemMsgs = await queryAll<IaMensagem & { conversa_id: string }>(
            `SELECT id, conversa_id, papel, conteudo, timestamp
             FROM ia_mensagens WHERE conversa_id = ANY($1)
             ORDER BY conversa_id, timestamp ASC`,
            conversas.map(c => c.id),
          )
          const memMsgsByConv = new Map<string, (IaMensagem & { conversa_id: string })[]>()
          for (const msg of allMemMsgs) {
            const arr = memMsgsByConv.get(msg.conversa_id) ?? []
            arr.push(msg)
            memMsgsByConv.set(msg.conversa_id, arr)
          }

          const { extractMemories } = await import('../ia/session-processor')
          for (const conv of conversas) {
            const msgs = memMsgsByConv.get(conv.id) ?? []
            await extractMemories(conv.id, msgs, factory.createModel, factory.modelo)
          }
          steps.push({ name: 'memory_extraction', status: 'ok' })
        }
      }
    } catch (err) {
      steps.push({ name: 'memory_extraction', status: 'error', error: (err as Error).message })
    }

    // ─── Step 4: Session indexing (conversas → RAG) ──────────────
    try {
      const conversas = await queryAll<{ id: string; titulo: string }>(
        `SELECT c.id, c.titulo FROM ia_conversas c
         WHERE c.indexada_em IS NULL
           AND c.status = 'ativo'
           AND (SELECT COUNT(*)::int FROM ia_mensagens m WHERE m.conversa_id = c.id) >= $1`,
        MIN_MESSAGES_FOR_EXTRACTION,
      )

      if (conversas.length === 0) {
        steps.push({ name: 'session_indexing', status: 'skipped' })
      } else {
        // Batch-fetch all messages to avoid N+1 queries
        const allIdxMsgs = await queryAll<IaMensagem & { conversa_id: string }>(
          `SELECT id, conversa_id, papel, conteudo, timestamp
           FROM ia_mensagens WHERE conversa_id = ANY($1)
           ORDER BY conversa_id, timestamp ASC`,
          conversas.map(c => c.id),
        )
        const idxMsgsByConv = new Map<string, (IaMensagem & { conversa_id: string })[]>()
        for (const msg of allIdxMsgs) {
          const arr = idxMsgsByConv.get(msg.conversa_id) ?? []
          arr.push(msg)
          idxMsgsByConv.set(msg.conversa_id, arr)
        }

        const { sanitizeTranscript } = await import('../ia/session-processor')
        const { ingestKnowledge } = await import('../knowledge/ingest')

        for (const conv of conversas) {
          const msgs = idxMsgsByConv.get(conv.id) ?? []
          const transcript = sanitizeTranscript(msgs)
          if (transcript.length < 100) continue

          await ingestKnowledge(
            conv.titulo || `Conversa ${conv.id.slice(0, 8)}`,
            transcript,
            'low',
            { tipo: 'session', conversa_id: conv.id },
          )
          await execute('UPDATE ia_conversas SET indexada_em = NOW() WHERE id = $1', conv.id)
        }
        steps.push({ name: 'session_indexing', status: 'ok' })
      }
    } catch (err) {
      steps.push({ name: 'session_indexing', status: 'error', error: (err as Error).message })
    }

    // ─── Step 5: Lazy decay ──────────────────────────────────────
    try {
      await execute(
        `UPDATE knowledge_chunks
         SET importance = 'decayed'
         WHERE importance = 'low'
           AND access_count = 0
           AND criada_em < NOW() - INTERVAL '${DECAY_DAYS} days'
           AND importance != 'decayed'`,
      )
      steps.push({ name: 'lazy_decay', status: 'ok' })
    } catch (err) {
      steps.push({ name: 'lazy_decay', status: 'error', error: (err as Error).message })
    }

    // ─── Step 6: Log ─────────────────────────────────────────────
    const duracao_ms = Date.now() - t0
    try {
      await setConfigValue('cron_last_run', new Date().toISOString())
      await setConfigValue('cron_last_duration_ms', String(duracao_ms))
      await setConfigValue('cron_last_steps', JSON.stringify(steps))
      steps.push({ name: 'log', status: 'ok' })
    } catch (err) {
      steps.push({ name: 'log', status: 'error', error: (err as Error).message })
    }

    return {
      status: 'processed',
      steps,
      duracao_ms: Date.now() - t0,
    }
  } catch (err) {
    return {
      status: 'error',
      reason: (err as Error).message,
      steps,
      duracao_ms: Date.now() - t0,
    }
  }
}
