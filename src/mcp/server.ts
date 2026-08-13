import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { buildToolServerAuthHeaders, resolveToolServerUrl } from '../shared/tool-server-url'

// ---------------------------------------------------------------------------
// Tool Server connection (Electron HTTP bridge on localhost)
// ---------------------------------------------------------------------------

const TOOL_SERVER = resolveToolServerUrl()

async function callToolServer(name: string, args: Record<string, unknown>): Promise<any> {
  const resp = await fetch(`${TOOL_SERVER}/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildToolServerAuthHeaders() },
    body: JSON.stringify({ name, args }),
  })
  if (!resp.ok) throw new Error(`Tool server error: ${resp.status}`)
  return resp.json()
}

async function fetchJson(url: string): Promise<any> {
  const resp = await fetch(url, {
    headers: buildToolServerAuthHeaders(),
  })
  if (!resp.ok) throw new Error(`HTTP error: ${resp.status}`)
  return resp.json()
}

async function postJson(pathname: string, body: Record<string, unknown>): Promise<any> {
  const resp = await fetch(`${TOOL_SERVER}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildToolServerAuthHeaders() },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`HTTP error: ${resp.status} ${text}`)
  }
  return resp.json()
}

// ---------------------------------------------------------------------------
// Friendly error wrapper — if the Electron app isn't running we don't want
// to blow up the MCP client with a raw fetch error.
// ---------------------------------------------------------------------------

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
    return 'FlowKit nao esta rodando. Abra o app primeiro.'
  }
  return `Erro: ${msg}`
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFlowKitMcpServer(): McpServer {
  const server = new McpServer({
    name: 'flowkit',
    version: '1.0.0',
  })

  // =========================================================================
  // TOOLS
  // =========================================================================

  // --- 1. consultar_contexto -----------------------------------------------
  server.tool(
    'consultar_contexto',
    'Consulta a base de conhecimento do FlowKit. Permite buscar documentos, explorar o grafo de relacoes, listar fontes ou checar o status do sistema.',
    {
      entidade: z.enum(['conhecimento', 'grafo', 'fontes', 'status']),
      filtros: z
        .object({
          consulta: z.string().optional(),
          limite: z.number().optional(),
        })
        .optional(),
    },
    async ({ entidade, filtros }) => {
      try {
        let result: any

        switch (entidade) {
          case 'conhecimento':
            result = await callToolServer('buscar_conhecimento', {
              consulta: filtros?.consulta ?? '',
            })
            break
          case 'grafo':
            result = await callToolServer('explorar_relacoes', {
              consulta: filtros?.consulta ?? '',
            })
            break
          case 'fontes':
            result = await callToolServer('listar_conhecimento', {})
            break
          case 'status':
            result = await callToolServer('status_sistema', {})
            break
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: friendlyError(err) }],
          isError: true,
        }
      }
    },
  )

  // --- 2. editar_ficha -----------------------------------------------------
  server.tool(
    'editar_ficha',
    'Cria ou deleta memorias e documentos no FlowKit.',
    {
      entidade: z.enum(['memoria', 'documento']),
      operacao: z.enum(['criar', 'deletar']),
      dados: z.record(z.string(), z.unknown()),
    },
    async ({ entidade, operacao, dados }) => {
      try {
        let result: any

        if (entidade === 'memoria' && operacao === 'criar') {
          result = await callToolServer('salvar_memoria', {
            conteudo: dados.conteudo,
          })
        } else if (entidade === 'memoria' && operacao === 'deletar') {
          result = await callToolServer('remover_memoria', {
            id: dados.id,
          })
        } else if (entidade === 'documento' && operacao === 'criar') {
          result = await callToolServer('salvar_conhecimento', {
            titulo: dados.titulo,
            conteudo: dados.conteudo,
          })
        } else {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Operacao "${operacao}" nao suportada para entidade "${entidade}".`,
              },
            ],
            isError: true,
          }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: friendlyError(err) }],
          isError: true,
        }
      }
    },
  )

  // --- 3. executar_acao ----------------------------------------------------
  server.tool(
    'executar_acao',
    'Executa acoes administrativas no FlowKit (ex: backup).',
    {
      acao: z.enum(['backup']),
    },
    async ({ acao }) => {
      try {
        let result: any

        switch (acao) {
          case 'backup':
            result = await callToolServer('fazer_backup', {})
            break
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: friendlyError(err) }],
          isError: true,
        }
      }
    },
  )

  // --- 4. terminal_exec ----------------------------------------------------
  server.tool(
    'terminal_exec',
    'Executa comando shell no computador local pelo app FlowKit aberto.',
    {
      command: z.string().min(1),
      cwd: z.string().optional(),
      timeout_ms: z.number().int().min(100).max(120_000).optional(),
      wait: z.boolean().default(true),
    },
    async ({ command, cwd, timeout_ms, wait }) => {
      try {
        const result = await postJson('/terminal/exec', { command, cwd, timeout_ms, wait })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: friendlyError(err) }],
          isError: true,
        }
      }
    },
  )

  // --- 5. terminal_open_cli -----------------------------------------------
  server.tool(
    'terminal_open_cli',
    'Abre o FlowKit CLI no Terminal do sistema pelo app aberto.',
    {
      command: z.string().optional(),
      cwd: z.string().optional(),
    },
    async ({ command, cwd }) => {
      try {
        const result = await postJson('/terminal/open-cli', { command, cwd })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: friendlyError(err) }],
          isError: true,
        }
      }
    },
  )

  // --- 6. terminal_read_file ----------------------------------------------
  server.tool(
    'terminal_read_file',
    'Le arquivo local pelo app FlowKit aberto.',
    {
      path: z.string().min(1),
      max_bytes: z.number().int().min(1).optional(),
    },
    async ({ path, max_bytes }) => {
      try {
        const result = await postJson('/terminal/read-file', { path, max_bytes })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: friendlyError(err) }],
          isError: true,
        }
      }
    },
  )

  // =========================================================================
  // RESOURCES
  // =========================================================================

  // --- 1. knowledge://sources ----------------------------------------------
  server.resource('knowledge-sources', 'knowledge://sources', async (uri) => {
    try {
      const data = await callToolServer('listar_conhecimento', {})
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      }
    } catch (err) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/plain',
            text: friendlyError(err),
          },
        ],
      }
    }
  })

  // --- 2. knowledge://stats ------------------------------------------------
  server.resource('knowledge-stats', 'knowledge://stats', async (uri) => {
    try {
      const data = await callToolServer('status_sistema', {})
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      }
    } catch (err) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/plain',
            text: friendlyError(err),
          },
        ],
      }
    }
  })

  // --- 3. memory://list ----------------------------------------------------
  server.resource('memory-list', 'memory://list', async (uri) => {
    try {
      const data = await fetchJson(`${TOOL_SERVER}/discovery`)
      const memorias = data?.memorias ?? data?.memories ?? data
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(memorias, null, 2),
          },
        ],
      }
    } catch (err) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/plain',
            text: friendlyError(err),
          },
        ],
      }
    }
  })

  // --- 4. system://instructions --------------------------------------------
  server.resource('system-instructions', 'system://instructions', async (uri) => {
    try {
      const data = await fetchJson(`${TOOL_SERVER}/instructions`)
      const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/plain',
            text,
          },
        ],
      }
    } catch (err) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/plain',
            text: friendlyError(err),
          },
        ],
      }
    }
  })

  // --- 5. app://health -------------------------------------------------------
  server.resource('app-health', 'app://health', async (uri) => {
    try {
      const data = await fetchJson(`${TOOL_SERVER}/health`)
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      }
    } catch (err) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/plain',
            text: friendlyError(err),
          },
        ],
      }
    }
  })

  return server
}
