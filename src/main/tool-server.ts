import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { executeTool, IA_TOOLS } from './ia/tools'
import { buildContextBriefing } from './ia/discovery'
import { cancelJob, getJob, listJobs, pauseJob, resumeJob } from './jobs'
import {
  DEFAULT_TOOL_SERVER_HOST,
  DEFAULT_TOOL_SERVER_PORT,
  TOOL_SERVER_AUTH_ENV,
  TOOL_SERVER_AUTH_HEADER,
  resolveToolServerAuthFile,
  resolveToolServerPort,
} from '../shared/tool-server-url'
import type { IaContexto, IaMensagem } from '../shared/types'

let httpServer: ReturnType<typeof createServer> | null = null
let activePort = DEFAULT_TOOL_SERVER_PORT
let activeHost = DEFAULT_TOOL_SERVER_HOST
let activeAuthToken = ''

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return true
  try {
    const host = new URL(`http://${hostHeader}`).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
  } catch {
    return false
  }
}

function isLoopbackOrigin(originHeader: string | undefined): boolean {
  if (!originHeader) return false
  try {
    const host = new URL(originHeader).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
  } catch {
    return false
  }
}

function requestLooksLikeUntrustedBrowser(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (origin && !isLoopbackOrigin(origin)) return true

  const fetchSite = req.headers['sec-fetch-site']
  const site = Array.isArray(fetchSite) ? fetchSite[0] : fetchSite
  return Boolean(site && !['none', 'same-origin', 'same-site'].includes(site))
}

function requestRequiresAuth(method: string | undefined, pathname: string): boolean {
  if (method === 'GET' && pathname === '/health') return false
  return true
}

function getRequestToken(req: IncomingMessage): string {
  const headerValue = req.headers[TOOL_SERVER_AUTH_HEADER]
  const token = Array.isArray(headerValue) ? headerValue[0] : headerValue
  if (token?.trim()) return token.trim()

  const authorization = req.headers.authorization
  const auth = Array.isArray(authorization) ? authorization[0] : authorization
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]
  return bearer?.trim() ?? ''
}

function authFailure(req: IncomingMessage, pathname: string): { status: number; message: string } | null {
  if (!requestRequiresAuth(req.method, pathname)) return null

  if (requestLooksLikeUntrustedBrowser(req)) {
    return {
      status: 403,
      message: 'Tool server local rejeitou uma requisicao de navegador externo.',
    }
  }

  if (!activeAuthToken || getRequestToken(req) !== activeAuthToken) {
    return {
      status: 403,
      message: 'Token local do FlowKit ausente ou invalido.',
    }
  }

  return null
}

function prepareToolServerAuthToken(port: number, tokenOverride?: string): string {
  const token = tokenOverride?.trim()
    || process.env[TOOL_SERVER_AUTH_ENV]?.trim()
    || crypto.randomBytes(32).toString('hex')
  const tokenFile = resolveToolServerAuthFile(process.env, port)

  try {
    fs.writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 })
    fs.chmodSync(tokenFile, 0o600)
  } catch (error) {
    console.warn('[TOOL-SERVER] Falha ao gravar token local:', error)
  }

  process.env[TOOL_SERVER_AUTH_ENV] = token
  return token
}

function normalizeChatContext(context: unknown): IaContexto {
  if (context && typeof context === 'object') {
    const value = context as Record<string, unknown>
    return {
      pagina: String(value.pagina ?? value.page ?? 'externo') as IaContexto['pagina'],
      rota: String(value.rota ?? value.route ?? '/cli'),
      store_snapshot: value.store_snapshot as IaContexto['store_snapshot'],
    }
  }

  return { pagina: 'externo', rota: '/cli' }
}

async function getHealthPayload() {
  let version = '?'
  try { version = require('electron').app.getVersion() } catch { /* dev/non-electron fallback */ }
  const issues: string[] = []
  const db: { connected: boolean; error?: string } = { connected: false }

  let ia = {
    provider: null as string | null,
    modelo: null as string | null,
    ativo: false,
    local_model: null as unknown,
    readiness: null as unknown,
    readiness_error: null as string | null,
  }

  try {
    const { queryOne } = await import('./db/query')
    const config = await queryOne<{
      provider: string | null
      modelo: string | null
      ativo: boolean | number | null
    }>('SELECT provider, modelo, ativo FROM configuracao_ia LIMIT 1')
    ia = {
      ...ia,
      provider: config?.provider ?? null,
      modelo: config?.modelo ?? null,
      ativo: Boolean(config?.ativo),
    }
    db.connected = true
  } catch (error) {
    db.error = error instanceof Error ? error.message : String(error)
    issues.push(`db:${db.error}`)
    // Health should keep the local tool server reachable even before DB bootstrap.
  }

  try {
    const { getLocalStatus } = await import('./ia/local-llm')
    ia = {
      ...ia,
      local_model: getLocalStatus(),
    }
  } catch {
    // Optional local LLM dependency can be unavailable in tests or minimal installs.
  }

  try {
    const { getIaChatReadiness } = await import('./ia/readiness')
    const readiness = await getIaChatReadiness()
    ia = {
      ...ia,
      ativo: readiness.ok,
      readiness,
    }
  } catch (error) {
    ia = {
      ...ia,
      readiness_error: error instanceof Error ? error.message : String(error),
    }
    issues.push(`readiness:${ia.readiness_error}`)
    // Keep health endpoint alive even if config/readiness lookup fails during bootstrap.
  }

  return {
    status: issues.length > 0 ? 'degraded' : 'ok',
    app: 'FlowKit',
    version,
    tools: IA_TOOLS.length,
    db,
    ia,
    ...(issues.length > 0 ? { issues } : {}),
  }
}

export function startToolServer(options: { port?: number; host?: string } = {}) {
  if (httpServer) stopToolServer()
  activePort = options.port ?? resolveToolServerPort()
  activeHost = options.host ?? DEFAULT_TOOL_SERVER_HOST
  activeAuthToken = prepareToolServerAuthToken(activePort)
  httpServer = createServer(async (req, res) => {
    try {
      if (!isLoopbackHost(req.headers.host)) {
        return json(res, { status: 'error', message: 'Acesso permitido apenas via loopback local.' }, 403)
      }

      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const pathname = url.pathname
      const failure = authFailure(req, pathname)
      if (failure) {
        return json(res, { status: 'error', message: failure.message }, failure.status)
      }

      if (req.method === 'GET' && pathname === '/health') {
        return json(res, await getHealthPayload())
      }
      if (req.method === 'GET' && pathname === '/tools') {
        return json(res, IA_TOOLS.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })))
      }
      if (req.method === 'GET' && pathname === '/chat/preflight') {
        const { getIaTaskReadiness } = await import('./ia/readiness')
        const readiness = await getIaTaskReadiness('cli_chat', { validateLocal: true })
        return json(res, { status: readiness.ok ? 'ok' : 'error', readiness, message: readiness.message }, readiness.ok ? 200 : 409)
      }
      if (req.method === 'POST' && pathname === '/tool') {
        const body = JSON.parse(await readBody(req))
        const { name, args } = body
        if (!name || !IA_TOOLS.find(t => t.name === name)) {
          return json(res, { status: 'error', message: `Tool '${name}' nao existe` }, 400)
        }
        const result = await executeTool(name, args ?? {})
        return json(res, result)
      }
      if (req.method === 'GET' && pathname === '/jobs') {
        return json(res, { jobs: listJobs() })
      }
      const jobMatch = pathname.match(/^\/jobs\/([^/]+)(?:\/(cancel|pause|resume))?$/)
      if (jobMatch && req.method === 'GET' && !jobMatch[2]) {
        const id = decodeURIComponent(jobMatch[1])
        const job = getJob(id)
        if (!job) return json(res, { status: 'error', message: `Job "${id}" nao encontrado.` }, 404)
        return json(res, { job })
      }
      if (jobMatch && req.method === 'POST' && jobMatch[2] === 'cancel') {
        const id = decodeURIComponent(jobMatch[1])
        try {
          return json(res, { job: cancelJob(id) })
        } catch (err) {
          return json(res, { status: 'error', message: err instanceof Error ? err.message : String(err) }, 404)
        }
      }
      if (jobMatch && req.method === 'POST' && jobMatch[2] === 'pause') {
        const id = decodeURIComponent(jobMatch[1])
        try {
          return json(res, { job: pauseJob(id) })
        } catch (err) {
          return json(res, { status: 'error', message: err instanceof Error ? err.message : String(err) }, 404)
        }
      }
      if (jobMatch && req.method === 'POST' && jobMatch[2] === 'resume') {
        const id = decodeURIComponent(jobMatch[1])
        try {
          return json(res, { job: resumeJob(id) })
        } catch (err) {
          return json(res, { status: 'error', message: err instanceof Error ? err.message : String(err) }, 404)
        }
      }
      if (req.method === 'POST' && pathname === '/rag/import') {
        const body = JSON.parse(await readBody(req)) as {
          path?: string
          group_name?: string
          auto_enrich?: boolean
          auto_metadata?: boolean
          recursive?: boolean
          filters?: string[]
        }
        if (!body.path?.trim()) {
          return json(res, { status: 'error', message: 'Campo "path" é obrigatório.' }, 400)
        }
        if (!body.group_name?.trim()) {
          return json(res, { status: 'error', message: 'Campo "group_name" é obrigatório.' }, 400)
        }

        const { startBulkRagImport } = await import('./knowledge/bulk-import')
        const job = startBulkRagImport({
          path: body.path,
          group_name: body.group_name,
          auto_enrich: body.auto_enrich,
          auto_metadata: body.auto_metadata,
          recursive: body.recursive,
          filters: body.filters,
        })
        return json(res, { status: 'ok', job })
      }
      if (req.method === 'GET' && pathname === '/rag/jobs') {
        const { listKnowledgeImportJobs } = await import('./knowledge/bulk-persistence')
        return json(res, { jobs: await listKnowledgeImportJobs() })
      }
      const ragJobMatch = pathname.match(/^\/rag\/jobs\/(\d+)(?:\/(cancel|pause|resume))?$/)
      if (ragJobMatch && req.method === 'GET' && !ragJobMatch[2]) {
        const id = Number(ragJobMatch[1])
        const { getKnowledgeImportJob, listKnowledgeImportFiles } = await import('./knowledge/bulk-persistence')
        const importJob = await getKnowledgeImportJob(id)
        if (!importJob) return json(res, { status: 'error', message: `RAG job "${id}" nao encontrado.` }, 404)
        return json(res, { job: importJob, files: await listKnowledgeImportFiles(id) })
      }
      if (ragJobMatch && req.method === 'POST') {
        const id = Number(ragJobMatch[1])
        const action = ragJobMatch[2]
        const {
          cancelBulkRagImportJob,
          pauseBulkRagImportJob,
          resumeBulkRagImportJob,
        } = await import('./knowledge/bulk-import')
        if (action === 'pause') {
          try {
            return json(res, { status: 'ok', ...(await pauseBulkRagImportJob(id)) })
          } catch (err) {
            const statusCode = typeof (err as { statusCode?: unknown }).statusCode === 'number'
              ? (err as { statusCode: number }).statusCode
              : 500
            return json(res, { status: 'error', message: err instanceof Error ? err.message : String(err) }, statusCode)
          }
        }
        if (action === 'resume') {
          try {
            return json(res, { status: 'ok', ...(await resumeBulkRagImportJob(id)) })
          } catch (err) {
            const statusCode = typeof (err as { statusCode?: unknown }).statusCode === 'number'
              ? (err as { statusCode: number }).statusCode
              : 500
            return json(res, { status: 'error', message: err instanceof Error ? err.message : String(err) }, statusCode)
          }
        }
        if (action === 'cancel') {
          try {
            return json(res, { status: 'ok', ...(await cancelBulkRagImportJob(id)) })
          } catch (err) {
            const statusCode = typeof (err as { statusCode?: unknown }).statusCode === 'number'
              ? (err as { statusCode: number }).statusCode
              : 500
            return json(res, { status: 'error', message: err instanceof Error ? err.message : String(err) }, statusCode)
          }
        }
      }
      const ragEnrichMatch = pathname.match(/^\/rag\/groups\/(\d+)\/enrich$/)
      if (ragEnrichMatch && req.method === 'POST') {
        const body = JSON.parse(await readBody(req) || '{}') as {
          provider?: 'auto' | 'local' | 'gemini' | 'openrouter'
          modelo?: string
          force_all?: boolean
        }
        const groupId = Number(ragEnrichMatch[1])
        const { getKnowledgeEnrichmentConfig, buildKnowledgeEnrichmentModel } = await import('./knowledge/enrichment-config')
        const { enrichAllChunksWithModel } = await import('./knowledge/enrichment')
        const config = await getKnowledgeEnrichmentConfig()
        const explicitOverride = Boolean(body.provider || body.modelo)
        try {
          const model = await buildKnowledgeEnrichmentModel({
            ...config,
            ...(body.provider ? { provider: body.provider } : {}),
            ...(body.modelo ? { modelo: body.modelo } : {}),
            ...(typeof body.force_all === 'boolean' ? { force_all_default: body.force_all } : {}),
          }, {
            explicitOverride,
          })
          if (!model) return json(res, { status: 'error', message: 'Nenhum modelo de enrichment disponivel.' }, 400)
          const result = await enrichAllChunksWithModel(model, {
            bulkGroupId: groupId,
            forceAll: body.force_all ?? config.force_all_default,
          })
          if (result.batches_failed > 0 && result.chunks_enriquecidos === 0) {
            return json(res, {
              status: 'error',
              message: `${result.batches_failed} batch(es) de enrichment falharam.`,
              result,
            }, 500)
          }
          return json(res, { status: result.batches_failed > 0 ? 'partial' : 'ok', result })
        } catch (err) {
          return json(res, { status: 'error', message: err instanceof Error ? err.message : String(err) }, 400)
        }
      }
      if (req.method === 'POST' && pathname === '/terminal/exec') {
        const body = JSON.parse(await readBody(req)) as {
          command?: string
          cwd?: string
          timeout_ms?: number
          max_output_chars?: number
          wait?: boolean
          env?: Record<string, string>
        }
        if (!body.command?.trim()) {
          return json(res, { status: 'error', message: 'Campo "command" é obrigatório.' }, 400)
        }

        const { runTerminalCommandWithConfig, resolveTerminalExecInput, startTerminalCommand } = await import('./terminal/harness')
        const input = {
          command: body.command,
          cwd: body.cwd,
          timeout_ms: body.timeout_ms,
          max_output_chars: body.max_output_chars,
          env: body.env,
        }
        if (body.wait !== false) {
          const execResult = await runTerminalCommandWithConfig(input, 'api')
          return json(res, { status: execResult.status, result: execResult.result, config: execResult.config })
        }
        const resolved = await resolveTerminalExecInput(input)
        const job = startTerminalCommand(resolved.input, 'api')
        return json(res, { status: 'ok', job, config: resolved.config })
      }
      if (req.method === 'POST' && pathname === '/terminal/open-cli') {
        const body = JSON.parse(await readBody(req) || '{}') as { command?: string; cwd?: string }
        const { openCliInSystemTerminal } = await import('./terminal/harness')
        return json(res, { status: 'ok', result: await openCliInSystemTerminal(body) })
      }
      if (req.method === 'GET' && pathname === '/terminal/ai-status') {
        const cwd = url.searchParams.get('cwd') ?? undefined
        const { getAiTerminalReadiness } = await import('./ia/runtime-readiness')
        return json(res, { status: 'ok', readiness: await getAiTerminalReadiness({ cwd }) })
      }
      if (req.method === 'POST' && pathname === '/terminal/open-ai-terminal') {
        const body = JSON.parse(await readBody(req) || '{}') as { cwd?: string }
        const { openAiTerminalInSystemTerminal } = await import('./terminal/harness')
        const result = await openAiTerminalInSystemTerminal(body)
        return json(res, { status: result.status === 'blocked' || result.status === 'failed' ? 'error' : 'ok', result }, result.status === 'blocked' ? 409 : 200)
      }
      if (req.method === 'GET' && pathname === '/terminal/sessions') {
        const { listTerminalSessions } = await import('./terminal/sessions')
        return json(res, { sessions: listTerminalSessions() })
      }
      if (req.method === 'POST' && pathname === '/terminal/sessions') {
        const body = JSON.parse(await readBody(req) || '{}') as { cwd?: string }
        const { startTerminalSession } = await import('./terminal/sessions')
        return json(res, { status: 'ok', session: startTerminalSession(body) })
      }
      const terminalSessionMatch = pathname.match(/^\/terminal\/sessions\/([^/]+)(?:\/(write|resize|kill))?$/)
      if (terminalSessionMatch && req.method === 'GET' && !terminalSessionMatch[2]) {
        const id = decodeURIComponent(terminalSessionMatch[1])
        const { getTerminalSession } = await import('./terminal/sessions')
        const session = getTerminalSession(id)
        if (!session) return json(res, { status: 'error', message: `Sessao terminal "${id}" nao encontrada.` }, 404)
        return json(res, { session })
      }
      if (terminalSessionMatch && req.method === 'POST') {
        const id = decodeURIComponent(terminalSessionMatch[1])
        const action = terminalSessionMatch[2]
        const body = JSON.parse(await readBody(req) || '{}') as { data?: string; cols?: number; rows?: number }
        const { writeTerminalSession, resizeTerminalSession, killTerminalSession } = await import('./terminal/sessions')
        try {
          if (action === 'write') return json(res, { status: 'ok', session: writeTerminalSession(id, body.data ?? '') })
          if (action === 'resize') return json(res, { status: 'ok', session: resizeTerminalSession(id, body.cols ?? 80, body.rows ?? 24) })
          if (action === 'kill') return json(res, { status: 'ok', session: killTerminalSession(id) })
        } catch (err) {
          return json(res, { status: 'error', message: err instanceof Error ? err.message : String(err) }, 404)
        }
      }
      if (req.method === 'POST' && pathname === '/terminal/read-file') {
        const body = JSON.parse(await readBody(req)) as { path?: string; max_bytes?: number }
        if (!body.path?.trim()) {
          return json(res, { status: 'error', message: 'Campo "path" é obrigatório.' }, 400)
        }
        const { readHarnessFile } = await import('./terminal/harness')
        return json(res, { status: 'ok', file: await readHarnessFile(body.path, body.max_bytes) })
      }
      if (req.method === 'POST' && pathname === '/terminal/write-file') {
        const body = JSON.parse(await readBody(req)) as { path?: string; content?: string }
        if (!body.path?.trim()) {
          return json(res, { status: 'error', message: 'Campo "path" é obrigatório.' }, 400)
        }
        const { writeHarnessFile } = await import('./terminal/harness')
        return json(res, { status: 'ok', file: await writeHarnessFile(body.path, body.content ?? '') })
      }
      if (req.method === 'POST' && pathname === '/chat') {
        const body = JSON.parse(await readBody(req)) as {
          message?: string
          history?: IaMensagem[]
          context?: unknown
          conversation_id?: string
          stream?: boolean
        }
        const message = body.message?.trim()
        if (!message) {
          return json(res, { status: 'error', message: 'Campo "message" é obrigatório.' }, 400)
        }
        if (body.stream) {
          return json(res, { status: 'error', message: 'Streaming ainda não é suportado neste endpoint.' }, 400)
        }

        const { getIaTaskReadiness } = await import('./ia/readiness')
        const readiness = await getIaTaskReadiness('cli_chat', { validateLocal: true })
        if (!readiness.ok) {
          return json(res, {
            status: 'error',
            message: readiness.action ? `${readiness.message} ${readiness.action}` : readiness.message,
            readiness,
          }, 409)
        }

        const { iaEnviarMensagem } = await import('./ia/cliente')
        const result = await iaEnviarMensagem(
          message,
          body.history ?? [],
          normalizeChatContext(body.context),
          body.conversation_id,
          undefined,
          { task: 'cli_chat' },
        )

        return json(res, {
          status: 'ok',
          response: result.resposta,
          actions: result.acoes,
        })
      }
      if (req.method === 'GET' && pathname === '/discovery') {
        const syntheticCtx: IaContexto = {
          rota: '/mcp',
          pagina: 'externo',
        }
        const briefing = await buildContextBriefing(syntheticCtx)
        return json(res, { discovery: briefing })
      }
      if (req.method === 'GET' && pathname === '/instructions') {
        const { buildMcpInstructions } = await import('./ia/system-prompt')
        return json(res, { instructions: buildMcpInstructions() })
      }
      json(res, { status: 'error', message: 'Not found' }, 404)
    } catch (err) {
      json(res, { status: 'error', message: String(err) }, 500)
    }
  })

  httpServer.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') {
      console.warn(`[TOOL-SERVER] Porta ${activePort} em uso — MCP server nao vai funcionar`)
    } else {
      console.error('[TOOL-SERVER] Erro:', e)
    }
  })

  httpServer.listen(activePort, activeHost, () => {
    const address = httpServer?.address()
    if (address && typeof address === 'object') activePort = address.port
    console.log(`[TOOL-SERVER] Listening on ${activeHost}:${activePort}`)
  })

  return httpServer
}

export function stopToolServer() {
  httpServer?.close()
  httpServer = null
}
